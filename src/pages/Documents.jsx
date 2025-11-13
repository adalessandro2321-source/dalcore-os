
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Removed: import DataTable from "../components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Edit, Trash2 } from "lucide-react"; // Removed ExternalLink, Added Edit
import { format } from "date-fns";

// New imports for Card and DocumentViewer
import { Card, CardContent } from "@/components/ui/card";
import DocumentViewer from "../components/shared/DocumentViewer";

export default function Documents() {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [documentToDelete, setDocumentToDelete] = React.useState(null); // Renamed from docToDelete
  const [showEditModal, setShowEditModal] = React.useState(false); // New state for edit modal
  const [editingDocument, setEditingDocument] = React.useState(null); // New state for document being edited

  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities.Document.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowDeleteConfirm(false);
      setDocumentToDelete(null); // Renamed
    },
  });

  // Helper function for formatting date, using date-fns
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return "Invalid Date";
    }
  };

  // Placeholder for getProjectName. In a real application, this might fetch project details
  // or use a context/store to retrieve project names based on IDs.
  const getProjectName = (projectId) => {
    if (!projectId) return "No Project";
    // For now, return a generic name or the ID itself.
    // Example: return projectsMap[projectId]?.name || `Project ID: ${projectId}`;
    return `Project ID: ${projectId}`;
  };

  const handleDeleteClick = (e, doc) => {
    e.stopPropagation(); // Prevent card's onClick from firing if it exists
    setDocumentToDelete(doc); // Renamed
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (documentToDelete) { // Renamed
      deleteMutation.mutate(documentToDelete.id); // Renamed
    }
  };

  // The `columns` array is no longer needed as we are using a card layout instead of DataTable.
  // const columns = [...] removed

  // For the purpose of this implementation, `filteredDocuments` is assumed to be `documents`
  // as no filtering UI or logic was provided in the outline.
  const filteredDocuments = documents;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
        <p className="text-gray-600 mt-1">Project plans, specs, and contracts</p>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <p className="text-gray-600">Loading documents...</p>
        ) : filteredDocuments.length === 0 ? (
          <p className="text-gray-600">No documents yet.</p>
        ) : (
          filteredDocuments.map((doc) => (
            <Card key={doc.id} className="bg-white border-gray-200 hover:border-[#1B4D3E] transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">{doc.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                        <span className="font-medium">{doc.folder || "N/A Folder"}</span>
                        <span>•</span>
                        <span>{doc.type || "N/A Type"}</span>
                        <span>•</span>
                        <span>{getProjectName(doc.project_id)}</span>
                        <span>•</span>
                        <span>v{doc.version || "N/A"}</span>
                        <span>•</span>
                        <span>{formatDate(doc.created_date)}</span>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
                      )}
                      {doc.file_url && doc.file_url !== 'placeholder' && (
                        <DocumentViewer
                          fileUrl={doc.file_url}
                          fileName={doc.name}
                          showDelete={false} // Assuming DocumentViewer has a showDelete prop
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card's onClick from firing if it exists
                        setEditingDocument(doc);
                        setShowEditModal(true);
                      }}
                      className="text-gray-600 hover:text-[#1B4D3E]"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, doc)}
                      className="text-gray-600 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{documentToDelete?.name}</span>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Document'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 
        Edit Document Modal - Not fully implemented in the outline,
        but the state (`showEditModal`, `editingDocument`) is set up for it.
        A `<Dialog>` component similar to the delete modal would typically go here.
      */}
      {/* 
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document: {editingDocument?.name}</DialogTitle>
          </DialogHeader>
          {editingDocument && <EditDocumentForm document={editingDocument} onSave={() => setShowEditModal(false)} />}
        </DialogContent>
      </Dialog>
      */}
    </div>
  );
}
