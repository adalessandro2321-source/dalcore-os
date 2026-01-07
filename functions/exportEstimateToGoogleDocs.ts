import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { estimateId, templateId } = await req.json();

    // Get estimate data
    const estimate = await base44.asServiceRole.entities.Estimate.filter({ id: estimateId });
    if (estimate.length === 0) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }
    const estimateData = estimate[0];

    // Get template
    const template = await base44.asServiceRole.entities.Template.filter({ id: templateId });
    if (template.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }
    const templateData = template[0];

    if (!templateData.google_drive_id) {
      return Response.json({ error: 'Template is not a Google Drive document' }, { status: 400 });
    }

    const driveToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');
    const docsToken = await base44.asServiceRole.connectors.getAccessToken('googledocs');

    // Copy the template document
    const copyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateData.google_drive_id}/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${driveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${estimateData.name} - Estimate ${estimateData.number || ''} - ${new Date().toLocaleDateString()}`
        })
      }
    );

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      return Response.json({ error: 'Failed to copy template', details: error }, { status: copyResponse.status });
    }

    const newDoc = await copyResponse.json();

    // Replace placeholders in the document
    const requests = [
      {
        replaceAllText: {
          containsText: { text: '{{ESTIMATE_NUMBER}}', matchCase: false },
          replaceText: estimateData.number || 'N/A'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{PROJECT_NAME}}', matchCase: false },
          replaceText: estimateData.name || 'N/A'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{PROJECT_ADDRESS}}', matchCase: false },
          replaceText: estimateData.project_address || 'N/A'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{ESTIMATE_DATE}}', matchCase: false },
          replaceText: estimateData.estimate_date ? new Date(estimateData.estimate_date).toLocaleDateString() : 'N/A'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{CONTRACT_VALUE}}', matchCase: false },
          replaceText: estimateData.estimated_selling_price?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{MATERIAL_COST}}', matchCase: false },
          replaceText: estimateData.material_cost?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{LABOR_COST}}', matchCase: false },
          replaceText: estimateData.labor_cost?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'
        }
      },
      {
        replaceAllText: {
          containsText: { text: '{{TOTAL_COST}}', matchCase: false },
          replaceText: estimateData.estimated_project_cost?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0.00'
        }
      }
    ];

    const updateResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${newDoc.id}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${docsToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      return Response.json({ error: 'Failed to update document', details: error }, { status: updateResponse.status });
    }

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

    return Response.json({
      success: true,
      documentId: newDoc.id,
      documentUrl: fileData.webViewLink,
      documentName: newDoc.name
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});