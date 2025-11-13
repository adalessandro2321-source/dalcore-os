import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, ExternalLink, Trash2 } from "lucide-react";

export default function DocumentViewer({ fileUrl, fileName, onDelete, showDelete = false }) {
  if (!fileUrl) return null;

  const getFileType = (url) => {
    const extension = url.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'other';
  };

  const fileType = getFileType(fileUrl);

  const handleView = () => {
    window.open(fileUrl, '_blank');
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg hover:border-[#1B4D3E] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {fileName || 'Document'}
        </p>
        <p className="text-xs text-gray-500">
          {fileType === 'image' ? 'Image' : fileType === 'pdf' ? 'PDF Document' : 'File'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleView}
          className="text-gray-600 hover:text-[#1B4D3E]"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="text-gray-600 hover:text-[#1B4D3E]"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-600 hover:text-[#1B4D3E]"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
        {showDelete && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-gray-600 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}