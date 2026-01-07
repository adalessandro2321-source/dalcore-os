import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderId } = await req.json();

    const driveToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Query for Google Docs files in the folder (or root if no folder specified)
    let query = "mimeType='application/vnd.google-apps.document'";
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,webViewLink)`,
      {
        headers: {
          'Authorization': `Bearer ${driveToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to fetch Google Drive files', details: error }, { status: response.status });
    }

    const data = await response.json();
    const files = data.files || [];

    // Sync templates to database
    const syncedTemplates = [];
    for (const file of files) {
      // Check if template already exists
      const existing = await base44.asServiceRole.entities.Template.filter({
        name: file.name
      });

      if (existing.length === 0) {
        // Create new template
        const template = await base44.asServiceRole.entities.Template.create({
          name: file.name,
          type: 'Other',
          file_url: file.webViewLink,
          description: `Synced from Google Drive on ${new Date().toLocaleDateString()}`,
          is_active: true,
          google_drive_id: file.id
        });
        syncedTemplates.push({ action: 'created', template });
      } else {
        // Update existing template
        const template = await base44.asServiceRole.entities.Template.update(existing[0].id, {
          file_url: file.webViewLink,
          google_drive_id: file.id
        });
        syncedTemplates.push({ action: 'updated', template });
      }
    }

    return Response.json({ 
      success: true,
      synced: syncedTemplates.length,
      templates: syncedTemplates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});