import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Download, Trash2, Plus, FolderPlus } from "lucide-react";
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
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
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
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) throw new Error('Project not found');

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

      const folder = folderMapping[selectedTemplate.type] || 'Documents';

      // Create document record in the project
      await base44.entities.Document.create({
        name: `${selectedTemplate.name} - ${project.name}`,
        project_id: selectedProjectId,
        folder: folder,
        file_url: selectedTemplate.file_url,
        type: selectedTemplate.type,
        description: `Created from template: ${selectedTemplate.name}`,
      });

      queryClient.invalidateQueries({ queryKey: ['documents', selectedProjectId] });
      setShowUseTemplateModal(false);
      setSelectedTemplate(null);
      setSelectedProjectId('');
    } catch (error) {
      console.error('Template assignment error:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Template Repository</h2>
          <p className="text-gray-600 mt-1">Manage document templates for proposals, contracts, and more</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Template
        </Button>
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
                            Use in Project
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
                This template will be added to the project's <span className="font-medium text-[#2A6B5A]">
                  {selectedTemplate?.type === 'Proposal' ? 'Proposals' :
                   selectedTemplate?.type === 'Contract' ? 'Contracts' :
                   selectedTemplate?.type === 'Invoice' ? 'Invoices' :
                   selectedTemplate?.type === 'Change Order' ? 'Change Orders' :
                   selectedTemplate?.type === 'Estimate' ? 'Estimates' :
                   selectedTemplate?.type === 'Quote' ? 'Quotes' :
                   selectedTemplate?.type === 'Report' ? 'Correspondences' : 'Documents'}
                </span> folder
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
                {assigning ? 'Adding to Project...' : 'Add to Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}