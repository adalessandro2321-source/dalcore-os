import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, FolderOpen, DollarSign, Calendar, AlertTriangle, Image, File, Globe, ExternalLink } from "lucide-react";

export default function CitationChip({ citation }) {
  const getIcon = () => {
    if (citation.source_type === 'web') {
      return <Globe className="w-3 h-3" />;
    }
    
    switch (citation.record_type) {
      case 'Project':
        return <FolderOpen className="w-3 h-3" />;
      case 'ChangeOrder':
      case 'Invoice':
      case 'Bill':
      case 'Payment':
        return <DollarSign className="w-3 h-3" />;
      case 'Task':
        return <Calendar className="w-3 h-3" />;
      case 'Risk':
        return <AlertTriangle className="w-3 h-3" />;
      case 'Photo':
        return <Image className="w-3 h-3" />;
      case 'Document':
        return <File className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getPageUrl = () => {
    if (citation.source_type === 'web') {
      return citation.url_slug; // External URL
    }
    
    if (citation.url_slug) return citation.url_slug;
    
    // Generate URL based on record type
    switch (citation.record_type) {
      case 'Project':
        return createPageUrl(`ProjectDetail?id=${citation.record_id}`);
      case 'Invoice':
        return createPageUrl(`InvoiceDetail?id=${citation.record_id}`);
      case 'Bill':
        return createPageUrl(`BillDetail?id=${citation.record_id}`);
      default:
        return null;
    }
  };

  const url = getPageUrl();
  const isExternal = citation.source_type === 'web';

  const chip = (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
      isExternal 
        ? 'bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100'
        : 'bg-[#E8E7DD] border border-[#C9C8AF] text-[#181E18] hover:bg-[#C9C8AF]'
    }`}>
      {getIcon()}
      <span className="font-medium">{citation.label}</span>
      {citation.domain && (
        <span className="text-xs opacity-70">({citation.domain})</span>
      )}
      {isExternal && <ExternalLink className="w-3 h-3 ml-1" />}
    </div>
  );

  return url ? (
    isExternal ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {chip}
      </a>
    ) : (
      <Link to={url} target="_blank">
        {chip}
      </Link>
    )
  ) : (
    chip
  );
}