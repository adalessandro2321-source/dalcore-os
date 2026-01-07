import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateId, projectId } = await req.json();

    // Get template
    const templates = await base44.asServiceRole.entities.Template.filter({ id: templateId });
    if (templates.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }
    const template = templates[0];

    // Get project
    const projects = await base44.asServiceRole.entities.Project.filter({ id: projectId });
    if (projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const project = projects[0];

    let newDocUrl = template.file_url;
    let newDocName = `${template.name} - ${project.name}`;

    // If it's a Google Drive document, make a copy
    if (template.google_drive_id) {
      const driveToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

      const copyResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${template.google_drive_id}/copy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${driveToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newDocName
          })
        }
      );

      if (!copyResponse.ok) {
        const error = await copyResponse.text();
        return Response.json({ error: 'Failed to copy document', details: error }, { status: copyResponse.status });
      }

      const newDoc = await copyResponse.json();

      // Get the web view link
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${newDoc.id}?fields=webViewLink`,
        {
          headers: {
            'Authorization': `Bearer ${driveToken}`,
          }
        }
      );

      const fileData = await fileResponse.json();
      newDocUrl = fileData.webViewLink;
    }

    // Map template type to document folder
    const folderMapping = {
      'Proposal': 'Proposals',
      'Contract': 'Contracts',
      'Invoice': 'Invoices',
      'Change Order': 'Change Orders',
      'Estimate': 'Estimates',
      'Quote': 'Quotes',
      'Report': 'Correspondences'
    };

    const folder = folderMapping[template.type] || 'Documents';

    // Create document record
    const document = await base44.asServiceRole.entities.Document.create({
      name: newDocName,
      project_id: projectId,
      folder: folder,
      file_url: newDocUrl,
      type: template.type,
      description: `Created from template: ${template.name}`,
    });

    return Response.json({
      success: true,
      document,
      documentUrl: newDocUrl
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});