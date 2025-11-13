import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Video, Trash2 } from "lucide-react";

export default function Photos() {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [photoToDelete, setPhotoToDelete] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: photos = [] } = useQuery({
    queryKey: ['photos'],
    queryFn: () => base44.entities.Photo.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId) => base44.entities.Photo.delete(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setShowDeleteConfirm(false);
      setPhotoToDelete(null);
    },
  });

  const handleDeleteClick = (photo) => {
    setPhotoToDelete(photo);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (photoToDelete) {
      deleteMutation.mutate(photoToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Photos & Media</h2>
        <p className="text-gray-600 mt-1">Project documentation and progress photos</p>
      </div>

      {photos.length === 0 ? (
        <Card className="bg-[#F5F4F3] border-gray-200 p-12">
          <div className="text-center">
            <ImageIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-600">No photos uploaded yet.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="bg-[#F5F4F3] border-gray-200 overflow-hidden group cursor-pointer hover:border-blue-500/50 transition-colors relative">
              <div className="aspect-square bg-white flex items-center justify-center relative">
                {photo.type === 'Video' ? (
                  <Video className="w-12 h-12 text-gray-500" />
                ) : (
                  <img 
                    src={photo.file_url} 
                    alt={photo.caption || 'Project photo'}
                    className="w-full h-full object-cover"
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(photo)}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-600 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {photo.caption && (
                <div className="p-3">
                  <p className="text-sm text-gray-900 line-clamp-2">{photo.caption}</p>
                  {photo.area && (
                    <p className="text-xs text-gray-600 mt-1">{photo.area}</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete this photo?
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Photo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}