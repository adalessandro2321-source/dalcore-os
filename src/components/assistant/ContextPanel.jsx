import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FolderOpen, Users, Calendar, Database, Globe } from "lucide-react"; // Added Database and Globe

export default function ContextPanel({ thread, messages }) {
  const [scopeType, setScopeType] = React.useState(thread?.scope_type || 'Company');

  // Extract unique citations from messages
  const citations = React.useMemo(() => {
    const allCitations = messages
      .filter(m => m.citations && m.citations.length > 0)
      .flatMap(m => m.citations);
    
    // Deduplicate by record_id or url_slug
    const uniqueCitations = Array.from(
      new Map(allCitations.map(c => [
        c.source_type === 'web' ? c.url_slug : c.record_id, 
        c
      ])).values()
    );
    
    return uniqueCitations;
  }, [messages]);

  // Group citations by type and source
  const citationsByType = React.useMemo(() => {
    const groups = {
      internal: {},
      web: {}
    };
    
    citations.forEach(citation => {
      const sourceGroup = citation.source_type === 'web' ? 'web' : 'internal';
      const type = citation.source_type === 'web' ? 'External Sources' : citation.record_type;
      
      if (!groups[sourceGroup][type]) {
        groups[sourceGroup][type] = [];
      }
      groups[sourceGroup][type].push(citation);
    });
    
    return groups;
  }, [citations]);

  const hasAnyCitations = Object.keys(citationsByType.internal).length > 0 || Object.keys(citationsByType.web).length > 0;

  return (
    <Card className="w-80 flex flex-col bg-white border-[#C9C8AF]">
      <CardHeader className="border-b border-[#C9C8AF]">
        <CardTitle className="text-sm">Context & Sources</CardTitle>
      </CardHeader>

      <div className="p-4 border-b border-[#C9C8AF]">
        <label className="text-xs font-medium text-[#5A7765] mb-2 block">Scope</label>
        <Select value={scopeType} onValueChange={setScopeType}>
          <SelectTrigger className="bg-[#F5F4F3] border-[#C9C8AF]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#C9C8AF]">
            <SelectItem value="Company">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Company-wide</span>
              </div>
            </SelectItem>
            <SelectItem value="Project">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span>Project</span>
              </div>
            </SelectItem>
            <SelectItem value="Vendor">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Vendor</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 p-4">
        {!hasAnyCitations ? (
          <div className="text-center py-8 text-[#5A7765]">
            <p className="text-sm">No sources yet</p>
            <p className="text-xs mt-1">Citations will appear here</p>
          </div>
        ) : (
          <div className="space-y-6"> {/* Increased space between sections */}
            {/* Internal Sources */}
            {Object.keys(citationsByType.internal).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#181E18] mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Company Data
                </h3>
                <div className="space-y-4"> {/* Space between different internal record types */}
                  {Object.entries(citationsByType.internal).map(([type, citations]) => (
                    <div key={type}>
                      <h4 className="text-xs font-semibold text-[#5A7765] mb-2">{type}s</h4>
                      <div className="space-y-2">
                        {citations.map((citation, idx) => (
                          <div
                            key={`${citation.record_id}-${idx}`} // Use record_id for key if available, fallback to idx
                            className="p-2 bg-[#F5F4F3] rounded-md border border-[#C9C8AF]"
                          >
                            <p className="text-xs font-medium text-[#181E18]">{citation.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Sources */}
            {Object.keys(citationsByType.web).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#181E18] mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  External Research
                </h3>
                <div className="space-y-4"> {/* Space between different external record types (though usually only one) */}
                  {Object.entries(citationsByType.web).map(([type, citations]) => (
                    <div key={type}> {/* 'type' here will likely be 'External Sources' */}
                      <div className="space-y-2">
                        {citations.map((citation, idx) => (
                          <a
                            key={`${citation.url_slug}-${idx}`} // Use url_slug for key if available, fallback to idx
                            href={citation.url_slug}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 bg-blue-50 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <p className="text-xs font-medium text-blue-900">{citation.label}</p>
                            {citation.domain && <p className="text-xs text-blue-700 mt-1">{citation.domain}</p>}
                            {citation.published_at && (
                              <p className="text-xs text-blue-600 mt-1">
                                {new Date(citation.published_at).toLocaleDateString()}
                              </p>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}