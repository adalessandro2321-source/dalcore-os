import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from "../components/shared/StatusBadge";
import { 
  FolderOpen, 
  ArrowLeft,
  FileText,
  ClipboardList,
  DollarSign,
  Edit
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectFolders from "../components/project/ProjectFolders";
import ProjectDailyLogs from "../components/project/ProjectDailyLogs";
import ProjectFinancials from "../components/project/ProjectFinancials";
import EditProjectModal from "../components/project/EditProjectModal";

export default function ProjectDetail() {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: company } = useQuery({
    queryKey: ['company', project?.client_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === project?.client_id);
    },
    enabled: !!project?.client_id,
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading project...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Projects")}>
            <Button variant="outline" size="icon" className="bg-white border-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
            <p className="text-gray-600 mt-1">{project.number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Project
          </Button>
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Client</p>
            <p className="text-lg font-semibold text-gray-900">{company?.name || '-'}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Contract Value</p>
            <p className="text-lg font-semibold text-gray-900">
              {project.contract_value ? `$${(project.contract_value / 1000000).toFixed(2)}M` : '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Progress</p>
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-gray-900">{project.percent_complete || 0}%</p>
              <div className="flex-1 bg-gray-300 rounded-full h-2">
                <div 
                  className="bg-[#1B4D3E] h-2 rounded-full transition-all"
                  style={{ width: `${project.percent_complete || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financials" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="financials" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Financials & CTC
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="dailylogs" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            Daily Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financials">
          <ProjectFinancials projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="documents">
          <ProjectFolders projectId={projectId} />
        </TabsContent>

        <TabsContent value="dailylogs">
          <ProjectDailyLogs projectId={projectId} projectName={project.name} />
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}