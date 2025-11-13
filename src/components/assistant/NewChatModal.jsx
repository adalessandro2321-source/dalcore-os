import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FolderOpen } from "lucide-react";

export default function NewChatModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const chatTitle = title.trim() || 'New Chat';

    onCreate({
      title: chatTitle,
      scope_type: 'Company',
      scope_id: null
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
        <DialogHeader>
          <DialogTitle className="heading">Start New Conversation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Conversation Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q4 Financial Analysis"
              className="bg-white border-gray-300 text-gray-900"
            />
            <p className="text-xs text-gray-600 mt-1">
              Leave blank for automatic title generation
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              Start Chat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}