import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const driveToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Query for all Google Docs files
    const query = "mimeType='application/vnd.google-apps.document'";

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=100`,
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
    
    // Check which templates are already imported
    const existingTemplates = await base44.asServiceRole.entities.Template.list();
    const importedDriveIds = new Set(existingTemplates.filter(t => t.google_drive_id).map(t => t.google_drive_id));

    const files = (data.files || []).map(file => ({
      ...file,
      isImported: importedDriveIds.has(file.id)
    }));

    return Response.json({ success: true, files });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});