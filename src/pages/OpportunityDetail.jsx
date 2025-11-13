import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, FileText, Plus, Clock, CheckCircle, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import EditOpportunityModal from "../components/opportunity/EditOpportunityModal";
import OpportunityFolders from "../components/opportunity/OpportunityFolders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";

export default function OpportunityDetail() {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showDeleteEstimateConfirm, setShowDeleteEstimateConfirm] = React.useState(false);
  const [estimateToDeleteId, setEstimateToDeleteId] = React.useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const opportunityId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: opportunity } = useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: async () => {
      const opps = await base44.entities.Opportunity.list();
      return opps.find(o => o.id === opportunityId);
    },
    enabled: !!opportunityId,
  });

  const { data: client } = useQuery({
    queryKey: ['client', opportunity?.client_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === opportunity?.client_id);
    },
    enabled: !!opportunity?.client_id,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates', opportunityId],
    queryFn: async () => {
      const allEstimates = await base44.entities.Estimate.list('-created_date');
      return allEstimates.filter(e => e.opportunity_id === opportunityId);
    },
    enabled: !!opportunityId,
  });

  const { data: estimate } = useQuery({
    queryKey: ['estimate', opportunity?.estimate_id],
    queryFn: async () => {
      if (!opportunity?.estimate_id) return null;
      const allEstimates = await base44.entities.Estimate.list();
      return allEstimates.find(e => e.id === opportunity.estimate_id);
    },
    enabled: !!opportunity?.estimate_id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', opportunity?.project_id],
    queryFn: async () => {
      if (!opportunity?.project_id) return null;
      const allProjects = await base44.entities.Project.list();
      return allProjects.find(p => p.id === opportunity.project_id);
    },
    enabled: !!opportunity?.project_id,
  });

  const deleteMutation = useMutation({
    mutationFn: (oppId) => base44.entities.Opportunity.delete(oppId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      navigate(createPageUrl('Opportunities'));
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(opportunityId);
  };

  const deleteEstimateMutation = useMutation({
    mutationFn: (estimateId) => base44.entities.Estimate.delete(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      setShowDeleteEstimateConfirm(false);
      setEstimateToDeleteId(null);
    },
    onError: (error) => {
      console.error("Failed to delete estimate:", error);
    },
  });

  const handleDeleteEstimate = () => {
    if (estimateToDeleteId) {
      deleteEstimateMutation.mutate(estimateToDeleteId);
    }
  };

  const createProjectFromOpportunityMutation = useMutation({
    mutationFn: async () => {
      const projectData = {
        number: opportunity.name.split(' ').map(w => w[0]).join('').toUpperCase() + '-' + Date.now().toString().slice(-6),
        name: opportunity.name,
        client_id: opportunity.client_id,
        opportunity_id: opportunity.id,
        estimate_id: opportunity.estimate_id || null,
        contract_value: estimate?.estimated_selling_price || opportunity.estimated_value || 0,
        status: 'Planning',
        description: opportunity.description || '',
        notes: opportunity.notes || ''
      };

      const newProject = await base44.entities.Project.create(projectData);

      // Create initial budget with estimate baseline if estimate exists
      if (estimate) {
        await base44.entities.ProjectBudget.create({
          project_id: newProject.id,
          estimate_id: estimate.id,
          original_contract_value: estimate.estimated_selling_price || 0,
          revised_contract_value: estimate.estimated_selling_price || 0,
          baseline_total_cost: estimate.estimated_project_cost || 0,
          baseline_labor_cost: estimate.labor_cost || 0,
          baseline_materials_cost: estimate.material_cost || 0,
          baseline_subcontractor_cost: estimate.subcontractor_cost || 0,
          baseline_admin_cost: estimate.administration_cost || 0,
          baseline_overhead_cost: estimate.burden_overhead_cost || 0,
          baseline_gp: estimate.estimated_profit || 0,
          uncommitted_forecast: estimate.estimated_project_cost || 0,
          forecast_at_completion: estimate.estimated_project_cost || 0,
          cost_to_complete: estimate.estimated_project_cost || 0
        });
      }

      // Transfer all documents from opportunity to project
      const opportunityDocuments = await base44.entities.Document.filter({ opportunity_id: opportunityId });
      
      if (opportunityDocuments.length > 0) {
        await Promise.all(
          opportunityDocuments.map(doc => 
            base44.entities.Document.update(doc.id, {
              project_id: newProject.id,
              opportunity_id: null // Remove opportunity link
            })
          )
        );
      }

      // Update opportunity with project link and stage
      await base44.entities.Opportunity.update(opportunity.id, {
        project_id: newProject.id,
        stage: 'Awarded'
      });

      return newProject;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', newProject.id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      navigate(createPageUrl(`ProjectDetail?id=${newProject.id}`));
    },
  });

  if (!opportunity) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading opportunity...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Opportunities")}>
            <Button variant="outline" size="icon" className="bg-white border-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{opportunity.name}</h2>
            <p className="text-gray-600 mt-1">{client?.name || 'Client'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Opportunity
          </Button>
          <StatusBadge status={opportunity.stage} />
        </div>
      </div>

      {opportunity.stage === 'Under Contract' && opportunity.project_id && (
        <Card className="bg-blue-50 border-blue-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">✅ This opportunity is under contract</p>
                <p className="text-sm text-blue-700 mt-1">The project has been created and is being managed in Projects.</p>
              </div>
              <Link to={createPageUrl(`ProjectDetail?id=${opportunity.project_id}`)}>
                <Button className="bg-[#0E351F] hover:bg-[#3B5B48] text-white">
                  View Project →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!opportunity.project_id && estimate && ['Qualified', 'Bidding', 'Awarded'].includes(opportunity.stage) && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle className="w-5 h-5" />
              Ready to Convert to Project
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm text-green-800 mb-4">
                  This opportunity has an estimate ready. Convert it to a project to begin tracking actual costs against the estimated baseline. All documents will be transferred automatically.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Estimated Selling Price</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(estimate.estimated_selling_price || 0)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Estimated Profit</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(estimate.estimated_profit || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {estimate.estimated_selling_price > 0 ?
                        ((estimate.estimated_profit / estimate.estimated_selling_price) * 100).toFixed(1) : 0}% margin
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Cost Breakdown Baseline</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Labor:</span>
                      <span className="font-medium">{formatCurrency(estimate.labor_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Materials:</span>
                      <span className="font-medium">{formatCurrency(estimate.material_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subcontractors:</span>
                      <span className="font-medium">{formatCurrency(estimate.subcontractor_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Admin:</span>
                      <span className="font-medium">{formatCurrency(estimate.administration_cost || 0)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 font-semibold">
                    <span className="text-gray-700">Total Estimated Cost:</span>
                    <span>{formatCurrency(estimate.estimated_project_cost || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => createProjectFromOpportunityMutation.mutate()}
              disabled={createProjectFromOpportunityMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {createProjectFromOpportunityMutation.isPending ? (
                'Creating Project & Transferring Documents...'
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Convert to Project with Estimate Baseline
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Estimated Value</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(opportunity.estimated_value || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Probability</p>
            <p className="text-lg font-semibold text-gray-900">
              {opportunity.probability || 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Bid Due Date</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(opportunity.bid_due_date) || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="details" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FolderOpen className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="estimates" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Estimates ({estimates.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900">{opportunity.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-gray-900">{opportunity.notes || 'No notes'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Project Start Date</p>
                <p className="text-gray-900">{formatDate(opportunity.project_start_date) || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Assigned To</p>
                <p className="text-gray-900">{opportunity.assigned_to || 'Unassigned'}</p>
              </div>
              {opportunity.project_id && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Converted to Project</p>
                  <Link
                    to={createPageUrl(`ProjectDetail?id=${opportunity.project_id}`)}
                    className="text-[#1B4D3E] hover:underline"
                  >
                    View Project
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <OpportunityFolders opportunityId={opportunityId} />
        </TabsContent>

        <TabsContent value="estimates">
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <div className="flex items-center justify-between">
                <CardTitle>Estimates</CardTitle>
                <Button
                  onClick={() => navigate(createPageUrl(`CreateEstimate?opportunityId=${opportunityId}`))}
                  className="bg-[#0E351F] hover:bg-[#14503C] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Estimate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {estimates.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-600 mb-4">No estimates created yet.</p>
                  <Button
                    onClick={() => navigate(createPageUrl(`CreateEstimate?opportunityId=${opportunityId}`))}
                    className="bg-[#0E351F] hover:bg-[#14503C] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Estimate
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-300">
                  {estimates.map((est) => (
                    <div
                      key={est.id}
                      className="p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => navigate(createPageUrl(`CreateEstimate?id=${est.id}`))}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{est.name}</p>
                              <p className="text-sm text-gray-600">
                                Version {est.version} • Created {formatDate(est.created_date)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(est.estimated_selling_price || 0)}
                            </p>
                            <StatusBadge status={est.status} />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEstimateToDeleteId(est.id);
                              setShowDeleteEstimateConfirm(true);
                            }}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardContent className="p-6 text-gray-600">
              No activity log available yet.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showEditModal && (
        <EditOpportunityModal
          opportunity={opportunity}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            setShowEditModal(false);
          }}
        />
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{opportunity.name}</span>?
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
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Opportunity'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteEstimateConfirm} onOpenChange={setShowDeleteEstimateConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete the estimate
              {estimates.find(e => e.id === estimateToDeleteId)?.name && (
                <span className="font-semibold text-gray-900"> "{estimates.find(e => e.id === estimateToDeleteId).name}"</span>
              )}?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteEstimateConfirm(false);
                  setEstimateToDeleteId(null);
                }}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteEstimate}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteEstimateMutation.isPending}
              >
                {deleteEstimateMutation.isPending ? 'Deleting...' : 'Delete Estimate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}