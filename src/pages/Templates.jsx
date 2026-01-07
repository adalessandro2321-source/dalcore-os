import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Download, Trash2, Plus, FolderPlus, RefreshCw, FileDown, Edit, ExternalLink } from "lucide-react";
import { listGoogleDriveTemplates } from "@/functions/listGoogleDriveTemplates";
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
  const [showBrowseDriveModal, setShowBrowseDriveModal] = React.useState(false);
  const [driveFiles, setDriveFiles] = React.useState([]);
  const [loadingDrive, setLoadingDrive] = React.useState(false);
  const [selectedDriveFiles, setSelectedDriveFiles] = React.useState([]);
  const [importingType, setImportingType] = React.useState('');
  const queryClient = useQueryClient();

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

  const handleBrowseGoogleDrive = async () => {
    setLoadingDrive(true);
    setShowBrowseDriveModal(true);
    try {
      const response = await listGoogleDriveTemplates({});
      if (response.data.success) {
        setDriveFiles(response.data.files);
      }
    } catch (error) {
      alert('Failed to load Google Drive files: ' + error.message);
      setShowBrowseDriveModal(false);
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedDriveFiles.length === 0 || !importingType) return;
    
    setSyncing(true);
    let imported = 0;
    for (const file of selectedDriveFiles) {
      try {
        await importGoogleDriveTemplate({
          fileId: file.id,
          fileName: file.name,
          type: importingType
        });
        imported++;
      } catch (error) {
        console.error(`Failed to import ${file.name}:`, error);
      }
    }
    
    alert(`✅ Imported ${imported} template(s) from Google Drive!`);
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setShowBrowseDriveModal(false);
    setSelectedDriveFiles([]);
    setImportingType('');
    setSyncing(false);
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
            onClick={handleBrowseGoogleDrive}
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

      {/* Browse Google Drive Modal */}
      <Dialog open={showBrowseDriveModal} onOpenChange={setShowBrowseDriveModal}>
        <DialogContent className="max-w-3xl bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Import Templates from Google Drive</DialogTitle>
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

            <div>
              <Label>Select Google Docs to Import</Label>
              <div className="mt-2 border border-gray-300 rounded-lg bg-white max-h-96 overflow-y-auto">
                {loadingDrive ? (
                  <div className="p-8 text-center text-gray-600">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading your Google Drive...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-8 text-center text-gray-600">
                    No Google Docs found in your Drive
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {driveFiles.map((file) => (
                      <label
                        key={file.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                          file.isImported ? 'opacity-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={file.isImported}
                          checked={selectedDriveFiles.some(f => f.id === file.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDriveFiles([...selectedDriveFiles, file]);
                            } else {
                              setSelectedDriveFiles(selectedDriveFiles.filter(f => f.id !== file.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{file.name}</p>
                          {file.isImported && (
                            <p className="text-xs text-green-600">Already imported</p>
                          )}
                        </div>
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBrowseDriveModal(false);
                  setSelectedDriveFiles([]);
                  setImportingType('');
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleImportSelected}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={selectedDriveFiles.length === 0 || !importingType || syncing}
              >
                {syncing ? 'Importing...' : `Import ${selectedDriveFiles.length} Template(s)`}
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