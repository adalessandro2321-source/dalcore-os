import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, fileName, type } = await req.json();

    const driveToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    // Get file details
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink`,
      {
        headers: {
          'Authorization': `Bearer ${driveToken}`,
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to fetch file details', details: error }, { status: response.status });
    }

    const file = await response.json();

    // Create template in database
    const template = await base44.asServiceRole.entities.Template.create({
      name: fileName,
      type: type,
      file_url: file.webViewLink,
      description: `Imported from Google Drive on ${new Date().toLocaleDateString()}`,
      is_active: true,
      google_drive_id: file.id
    });

    return Response.json({ 
      success: true,
      template
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});