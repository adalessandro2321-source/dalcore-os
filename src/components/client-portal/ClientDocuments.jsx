import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Folder } from "lucide-react";
import { formatDate } from "../shared/DateFormatter";

export default function ClientDocuments({ companyId, projects }) {
  const [selectedProject, setSelectedProject] = React.useState('all');
  const [selectedFolder, setSelectedFolder] = React.useState('all');

  const { data: documents = [] } = useQuery({
    queryKey: ['clientDocuments', companyId, selectedProject],
    queryFn: async () => {
      const allDocs = await base44.entities.Document.list('-created_date');
      
      // Filter documents for client's projects
      const projectIds = projects.map(p => p.id);
      return allDocs.filter(doc => 
        projectIds.includes(doc.project_id) &&
        (selectedProject === 'all' || doc.project_id === selectedProject)
      );
    },
    enabled: !!companyId && projects.length > 0,
  });

  const filteredDocuments = selectedFolder === 'all' 
    ? documents 
    : documents.filter(doc => doc.folder === selectedFolder);

  const folders = ['Contracts', 'Proposals', 'Invoices', 'Photos', 'Drawings & Specs', 'Change Orders'];

  const handleDownload = (doc) => {
    window.open(doc.file_url, '_blank');
  };

  if (projects.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No projects yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Filter by Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">Filter by Folder</label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="all">All Folders</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder} value={folder}>
                      {folder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle>Project Documents</CardTitle>
            <span className="text-sm text-gray-600">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p>No documents available</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredDocuments.map((doc) => {
                const project = projects.find(p => p.id === doc.project_id);
                
                return (
                  <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <FileText className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{doc.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {doc.folder}
                            </span>
                            <span>•</span>
                            <span>{project?.name}</span>
                            <span>•</span>
                            <span>{formatDate(doc.created_date)}</span>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-gray-600 mt-2">{doc.description}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(doc)}
                        variant="outline"
                        size="sm"
                        className="border-gray-300 text-gray-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}