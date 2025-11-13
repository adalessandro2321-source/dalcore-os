import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import StatusBadge from "../shared/StatusBadge";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { Eye, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function ClientProjects({ projects, company }) {
  const [selectedProject, setSelectedProject] = React.useState(null);
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);

  const { data: projectBudget } = useQuery({
    queryKey: ['projectBudget', selectedProject?.id],
    queryFn: async () => {
      const budgets = await base44.entities.ProjectBudget.filter({ 
        project_id: selectedProject.id 
      });
      return budgets[0];
    },
    enabled: !!selectedProject?.id,
  });

  const { data: projectInvoices = [] } = useQuery({
    queryKey: ['projectInvoices', selectedProject?.id],
    queryFn: () => base44.entities.Invoice.filter({ project_id: selectedProject.id }),
    enabled: !!selectedProject?.id,
  });

  const handleViewDetails = (project) => {
    setSelectedProject(project);
    setShowDetailsModal(true);
  };

  if (projects.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-12 text-center">
          <p className="text-gray-600">No projects yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => (
          <Card key={project.id} className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{project.number}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-semibold text-gray-900">
                    {project.percent_complete || 0}%
                  </span>
                </div>
                <Progress value={project.percent_complete || 0} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Contract Value</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(project.contract_value || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Target Completion</p>
                  <p className="font-semibold text-gray-900">
                    {formatDate(project.target_completion_date) || 'TBD'}
                  </p>
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 line-clamp-2 pt-2">
                  {project.description}
                </p>
              )}

              <Button
                onClick={() => handleViewDetails(project)}
                className="w-full bg-[#0E351F] hover:bg-[#3B5B48] text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Project Details Modal */}
      {showDetailsModal && selectedProject && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-4xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{selectedProject.name}</DialogTitle>
                <StatusBadge status={selectedProject.status} />
              </div>
            </DialogHeader>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Progress Section */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="text-base">Project Progress</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Overall Completion</span>
                      <span className="text-lg font-bold text-[#0E351F]">
                        {selectedProject.percent_complete || 0}%
                      </span>
                    </div>
                    <Progress value={selectedProject.percent_complete || 0} className="h-3" />
                  </div>
                </CardContent>
              </Card>

              {/* Project Details */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="text-base">Project Information</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Project Number</p>
                      <p className="font-semibold text-gray-900">{selectedProject.number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <StatusBadge status={selectedProject.status} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Start Date</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(selectedProject.start_date) || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Target Completion</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(selectedProject.target_completion_date) || 'TBD'}
                      </p>
                    </div>
                    {selectedProject.address && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Address</p>
                        <p className="font-semibold text-gray-900">
                          {selectedProject.address}
                          {selectedProject.city && `, ${selectedProject.city}`}
                          {selectedProject.state && ` ${selectedProject.state}`}
                          {selectedProject.zip && ` ${selectedProject.zip}`}
                        </p>
                      </div>
                    )}
                    {selectedProject.description && (
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 mb-1">Description</p>
                        <p className="text-gray-900">{selectedProject.description}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card className="bg-white border-gray-200">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="text-base">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Contract Value</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(selectedProject.contract_value || 0)}
                      </p>
                    </div>
                    {projectBudget && (
                      <>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Invoiced to Date</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(projectBudget.ar_invoiced || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Collected</p>
                          <p className="text-xl font-semibold text-gray-900">
                            {formatCurrency(projectBudget.ar_collected || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Outstanding</p>
                          <p className="text-xl font-semibold text-orange-600">
                            {formatCurrency(projectBudget.ar_open || 0)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Invoices */}
              {projectInvoices.length > 0 && (
                <Card className="bg-white border-gray-200">
                  <CardHeader className="border-b border-gray-200">
                    <CardTitle className="text-base">Recent Invoices</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-200">
                      {projectInvoices.slice(0, 5).map((invoice) => (
                        <div key={invoice.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{invoice.number}</p>
                              <p className="text-sm text-gray-600">
                                {formatDate(invoice.created_date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(invoice.total || 0)}
                              </p>
                              <StatusBadge status={invoice.status} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}