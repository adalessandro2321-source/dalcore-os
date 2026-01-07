import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Download, Trash2, Plus, FolderPlus, RefreshCw, FileDown, Edit, ExternalLink } from "lucide-react";
import { importGoogleDriveTemplate } from "@/functions/importGoogleDriveTemplate";
import { copyTemplateToProject } from "@/functions/copyTemplateToProject";
import { exportEstimateToGoogleDocs } from "@/functions/exportEstimateToGoogleDocs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Templates() {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showUseTemplateModal, setShowUseTemplateModal] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [formData, setFormData] = React.useState({});
  const [uploading, setUploading] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = React.useState('');
  const [selectedTemplateForExport, setSelectedTemplateForExport] = React.useState(null);
  const [exporting, setExporting] = React.useState(false);
  const [showImportTypeModal, setShowImportTypeModal] = React.useState(false);
  const [importingType, setImportingType] = React.useState('');
  const [pickerInited, setPickerInited] = React.useState(false);
  const queryClient = useQueryClient();

  // Load Google Picker API
  React.useEffect(() => {
    const loadPicker = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', () => {
          setPickerInited(true);
        });
      };
      document.body.appendChild(script);
    };

    if (!window.gapi) {
      loadPicker();
    } else if (!pickerInited) {
      window.gapi.load('picker', () => {
        setPickerInited(true);
      });
    }
  }, []);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId) => base44.entities.Template.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const file = formData.file;
      if (!file) return;

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Template.create({
        name: formData.name,
        type: formData.type,
        file_url: file_url,
        description: formData.description,
      });

      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowCreateModal(false);
      setFormData({});
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate || !selectedProjectId) return;
    
    setAssigning(true);

    try {
      const response = await copyTemplateToProject({
        templateId: selectedTemplate.id,
        projectId: selectedProjectId
      });

      if (response.data.success) {
        alert('✅ Template copied to project!');
        queryClient.invalidateQueries({ queryKey: ['documents', selectedProjectId] });
        setShowUseTemplateModal(false);
        setSelectedTemplate(null);
        setSelectedProjectId('');
        
        // Open the new document
        if (response.data.documentUrl) {
          window.open(response.data.documentUrl, '_blank');
        }
      }
    } catch (error) {
      alert('Failed to copy template: ' + error.message);
    }
    setAssigning(false);
  };

  const templateTypes = [
    "Proposal",
    "Contract", 
    "Invoice",
    "Change Order",
    "Estimate",
    "Quote",
    "Report"
  ];

  const getTemplatesByType = (type) => {
    return templates.filter(t => t.type === type);
  };

  const handleOpenDrivePicker = () => {
    setShowImportTypeModal(true);
  };

  const handlePickerTypeSelected = async () => {
    if (!importingType) return;
    setShowImportTypeModal(false);

    try {
      // Get access token
      const tokenResponse = await base44.integrations.Core.InvokeLLM({
        prompt: "Return a simple object with a token field",
        response_json_schema: {
          type: "object",
          properties: {
            token: { type: "string" }
          }
        }
      });

      // For now, we'll use a simpler approach - just open a file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/vnd.google-apps.document';
      input.multiple = true;
      
      alert('⚠️ Due to Google Drive API restrictions, please:\n\n1. Open Google Drive in a new tab\n2. Right-click on your template document\n3. Select "Get link" and set to "Anyone with the link can view"\n4. Copy the document ID from the URL\n5. Come back and enter it here');
      
      const docId = prompt('Enter your Google Drive document ID:');
      if (docId) {
        setSyncing(true);
        const fileName = prompt('Enter a name for this template:');
        if (fileName) {
          try {
            await importGoogleDriveTemplate({
              fileId: docId.trim(),
              fileName: fileName,
              type: importingType
            });
            alert('✅ Template imported successfully!');
            queryClient.invalidateQueries({ queryKey: ['templates'] });
          } catch (error) {
            alert('Failed to import template: ' + error.message);
          }
        }
        setSyncing(false);
      }
      
      setImportingType('');
    } catch (error) {
      alert('Error: ' + error.message);
      setImportingType('');
    }
  };

  const handleExportEstimate = async () => {
    if (!selectedEstimateId || !selectedTemplateForExport) return;
    
    setExporting(true);
    try {
      const response = await exportEstimateToGoogleDocs({
        estimateId: selectedEstimateId,
        templateId: selectedTemplateForExport.id
      });
      
      if (response.data.success) {
        alert(`✅ Estimate exported to Google Docs!`);
        window.open(response.data.documentUrl, '_blank');
        setShowExportModal(false);
        setSelectedEstimateId('');
        setSelectedTemplateForExport(null);
      }
    } catch (error) {
      alert('Failed to export estimate: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Template Repository</h2>
          <p className="text-gray-600 mt-1">Manage document templates for proposals, contracts, and more</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleOpenDrivePicker}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Import from Google Drive
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {templateTypes.map((type) => {
          const typeTemplates = getTemplatesByType(type);
          
          return (
            <Card key={type} className="bg-[#F5F4F3] border-gray-200">
              <CardHeader className="border-b border-gray-300">
                <CardTitle className="flex items-center justify-between">
                  <span>{type} Templates</span>
                  <span className="text-sm font-normal text-gray-600">
                    {typeTemplates.length} {typeTemplates.length === 1 ? 'template' : 'templates'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {typeTemplates.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="w-10 h-10 mx-auto text-gray-500 mb-2" />
                    <p className="text-gray-600 text-sm">No {type.toLowerCase()} templates yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-300">
                    {typeTemplates.map((template) => (
                      <div key={template.id} className="p-4 hover:bg-[#EBEAE8] transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-[#1B4D3E]/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#2A6B5A]" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            {template.description && (
                              <p className="text-sm text-gray-600 mt-0.5">{template.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {template.google_drive_id && (
                            <a
                              href={template.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-700 hover:text-blue-900 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit in Google Docs
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowUseTemplateModal(true);
                            }}
                            className="text-[#2A6B5A] hover:text-[#1B4D3E] hover:bg-[#1B4D3E]/10"
                          >
                            <FolderPlus className="w-4 h-4 mr-2" />
                            Copy to Project
                          </Button>
                          <a
                            href={template.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(template.id)}
                            className="text-gray-600 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Add New Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Standard Proposal Template"
              />
            </div>

            <div>
              <Label>Template Type</Label>
              <Select
                value={formData.type || ''}
                onValueChange={(value) => setFormData({...formData, type: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {templateTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Template File</Label>
              <Input
                type="file"
                required
                onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
                className="bg-white border-gray-300 text-gray-900"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
              <p className="text-xs text-gray-600 mt-1">Supported: PDF, Word, Excel</p>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={2}
                placeholder="Optional description of when to use this template"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Add Template'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Use Template Modal */}
      <Dialog open={showUseTemplateModal} onOpenChange={setShowUseTemplateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Use Template in Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template</Label>
              <div className="p-3 bg-white border border-gray-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#2A6B5A]" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedTemplate?.name}</p>
                    <p className="text-sm text-gray-600">{selectedTemplate?.type}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>Select Project</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-xs text-gray-600">({project.number})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 mt-2">
                {selectedTemplate?.google_drive_id ? 
                  'A copy will be created in your Google Drive and' : 
                  'This template will be'
                } added to the project's <span className="font-medium text-[#2A6B5A]">
                  {selectedTemplate?.type === 'Proposal' ? 'Proposals' :
                   selectedTemplate?.type === 'Contract' ? 'Contracts' :
                   selectedTemplate?.type === 'Invoice' ? 'Invoices' :
                   selectedTemplate?.type === 'Change Order' ? 'Change Orders' :
                   selectedTemplate?.type === 'Estimate' ? 'Estimates' :
                   selectedTemplate?.type === 'Quote' ? 'Quotes' :
                   selectedTemplate?.type === 'Report' ? 'Correspondences' : 'Documents'}
                </span> folder. You can then edit it directly.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUseTemplateModal(false);
                  setSelectedTemplate(null);
                  setSelectedProjectId('');
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUseTemplate}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={!selectedProjectId || assigning}
              >
                {assigning ? 'Copying...' : 'Copy to Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Type Selection Modal */}
      <Dialog open={showImportTypeModal} onOpenChange={setShowImportTypeModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Import Template from Google Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Type</Label>
              <Select value={importingType} onValueChange={setImportingType}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {templateTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>How to import:</strong>
              </p>
              <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                <li>Select template type above</li>
                <li>Click "Continue" below</li>
                <li>You'll be asked to provide the Google Drive document ID</li>
                <li>Find it in your Drive document URL after /d/ (e.g., docs.google.com/document/d/<strong>YOUR_ID_HERE</strong>/edit)</li>
              </ol>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportTypeModal(false);
                  setImportingType('');
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePickerTypeSelected}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={!importingType || syncing}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Estimate Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Export Estimate to Google Docs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template</Label>
              <div className="p-3 bg-white border border-gray-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#2A6B5A]" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedTemplateForExport?.name}</p>
                    <p className="text-sm text-gray-600">Google Docs Template</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>Select Estimate</Label>
              <Select
                value={selectedEstimateId}
                onValueChange={setSelectedEstimateId}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Choose an estimate" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {estimates.map((estimate) => (
                    <SelectItem key={estimate.id} value={estimate.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{estimate.name}</span>
                        {estimate.number && (
                          <span className="text-xs text-gray-600">({estimate.number})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 mt-2">
                Available placeholders: {'{'}{'{'} ESTIMATE_NUMBER {'}'}{'}'},  {'{'}{'{'} PROJECT_NAME {'}'}{'}'},  {'{'}{'{'} PROJECT_ADDRESS {'}'}{'}'},  {'{'}{'{'} ESTIMATE_DATE {'}'}{'}'},  {'{'}{'{'} CONTRACT_VALUE {'}'}{'}'},  {'{'}{'{'} MATERIAL_COST {'}'}{'}'},  {'{'}{'{'} LABOR_COST {'}'}{'}'},  {'{'}{'{'} TOTAL_COST {'}'}{'}'} 
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedTemplateForExport(null);
                  setSelectedEstimateId('');
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleExportEstimate}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={!selectedEstimateId || exporting}
              >
                {exporting ? 'Exporting...' : 'Export to Google Docs'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}