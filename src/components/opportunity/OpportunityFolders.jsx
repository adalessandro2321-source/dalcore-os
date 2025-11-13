import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FolderOpen, 
  Upload, 
  FileText, 
  ArrowLeft,
  Trash2,
  Edit
} from "lucide-react";
import { formatDate } from "../shared/DateFormatter";
import DocumentViewer from "../shared/DocumentViewer";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FOLDERS = [
  "Contracts",
  "Correspondences",
  "Drawings & Specs",
  "Estimates",
  "Permits",
  "Photos",
  "Proposals",
  "Quotes",
  "Schedules"
];

export default function OpportunityFolders({ opportunityId }) {
  const [selectedFolder, setSelectedFolder] = React.useState(null);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingDocument, setEditingDocument] = React.useState(null);
  const [uploadData, setUploadData] = React.useState({});
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const queryClient = useQueryClient();

  // Query documents for this opportunity
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', opportunityId],
    queryFn: () => base44.entities.Document.filter({ opportunity_id: opportunityId }),
    enabled: !!opportunityId,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', opportunityId] });
      setShowEditModal(false);
      setEditingDocument(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities.Document.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', opportunityId] });
    },
  });

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      const file = uploadData.file;
      if (!file) {
        setError('Please select a file to upload.');
        setUploading(false);
        return;
      }

      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult || !uploadResult.file_url || typeof uploadResult.file_url !== 'string') {
        throw new Error('Invalid upload response - no file URL received.');
      }

      await base44.entities.Document.create({
        name: uploadData.name || file.name,
        opportunity_id: opportunityId,
        folder: selectedFolder,
        file_url: uploadResult.file_url,
        type: uploadData.type || 'Other',
        description: uploadData.description,
      });

      queryClient.invalidateQueries({ queryKey: ['documents', opportunityId] });
      setShowUploadModal(false);
      setUploadData({});
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload file. Please try again.');
    }
    setUploading(false);
  };

  const handleEditDocument = (doc) => {
    setEditingDocument({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      description: doc.description
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateDocumentMutation.mutate({
      id: editingDocument.id,
      data: {
        name: editingDocument.name,
        type: editingDocument.type,
        description: editingDocument.description
      }
    });
  };

  const getFolderDocuments = (folder) => {
    return documents.filter(d => d.folder === folder);
  };

  const getFolderCount = (folder) => {
    return getFolderDocuments(folder).length;
  };

  return (
    <>
      {selectedFolder ? (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFolder(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <CardTitle className="text-xl">{selectedFolder}</CardTitle>
              </div>
              <Button
                onClick={() => { setShowUploadModal(true); setError(null); }}
                variant="outline" 
                className="border-gray-300 text-gray-700" 
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-300">
              {getFolderDocuments(selectedFolder).length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-600 mb-4">No documents in this folder yet.</p>
                  <Button
                    onClick={() => { setShowUploadModal(true); setError(null); }}
                    variant="outline"
                    className="border-gray-300 text-gray-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              ) : (
                getFolderDocuments(selectedFolder).map((doc) => (
                  <div key={doc.id} id={`doc-${doc.id}`} className="p-4 hover:bg-[#EBEAE8] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <FileText className="w-5 h-5 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{doc.name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span>{doc.type}</span>
                            <span>•</span>
                            <span>v{doc.version}</span>
                            <span>•</span>
                            <span>{formatDate(doc.created_date)}</span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                          )}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {doc.tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {doc.file_url && doc.file_url !== 'placeholder' && (
                            <div className="mt-3">
                              <DocumentViewer 
                                fileUrl={doc.file_url} 
                                fileName={doc.name}
                                showDelete={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditDocument(doc)}
                          className="text-gray-600 hover:text-[#1B4D3E]"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Document Folders</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {FOLDERS.map((folder) => {
                const count = getFolderCount(folder);
                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className="p-4 bg-white hover:bg-gray-50 border border-gray-300 hover:border-[#1B4D3E]/50 rounded-lg transition-all group relative" 
                  >
                    <FolderOpen className="w-8 h-8 text-[#2A6B5A] mb-3 mx-auto group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-medium text-gray-900 text-center">{folder}</p>
                    <p className="text-xs text-gray-600 text-center mt-1">
                      {count} {count === 1 ? 'document' : 'documents'}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Document Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Document Name</Label>
              <Input
                value={editingDocument?.name || ''}
                onChange={(e) => setEditingDocument({...editingDocument, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Document Type</Label>
              <Select
                value={editingDocument?.type || ''}
                onValueChange={(value) => setEditingDocument({...editingDocument, type: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Plan">Plan</SelectItem>
                  <SelectItem value="Specification">Specification</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={editingDocument?.description || ''}
                onChange={(e) => setEditingDocument({...editingDocument, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={updateDocumentMutation.isPending}
              >
                {updateDocumentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Document to {selectedFolder}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <Label>File</Label>
              <Input
                type="file"
                required
                onChange={(e) => setUploadData({...uploadData, file: e.target.files[0]})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Document Name</Label>
              <Input
                value={uploadData.name || ''}
                onChange={(e) => setUploadData({...uploadData, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Leave blank to use filename"
              />
            </div>

            <div>
              <Label>Document Type</Label>
              <Select
                value={uploadData.type || ''}
                onValueChange={(value) => setUploadData({...uploadData, type: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Plan">Plan</SelectItem>
                  <SelectItem value="Specification">Specification</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="RFI">RFI</SelectItem>
                  <SelectItem value="Submittal">Submittal</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Input 
                value={uploadData.description || ''}
                onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}