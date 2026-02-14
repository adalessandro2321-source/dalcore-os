import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from "../components/shared/StatusBadge";
import {
  FolderOpen,
  ArrowLeft,
  FileText,
  ClipboardList,
  DollarSign,
  Edit,
  Calendar,
  CheckCircle,
  TrendingUp,
  Brain,
  RefreshCw,
  FileEdit
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectFolders from "../components/project/ProjectFolders";
import ProjectDailyLogs from "../components/project/ProjectDailyLogs";
import ProjectFinancials from "../components/project/ProjectFinancials";
import EditProjectModal from "../components/project/EditProjectModal";
import ProjectSchedule from "../components/schedule/ProjectSchedule";
import MaterialCosts from "../components/project/MaterialCosts";
import DailyLogRiskSuggestions from "../components/project/DailyLogRiskSuggestions";
import ProjectAIInsights from "../components/project/ProjectAIInsights";
import BudgetModule from "../components/budget/BudgetModule";
import ChangeOrdersTab from "../components/project/ChangeOrdersTab";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";

export default function ProjectDetail() {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showEditObligationModal, setShowEditObligationModal] = React.useState(false);
  const [editingObligation, setEditingObligation] = React.useState(null);
  const [isRecalculating, setIsRecalculating] = React.useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  const queryClient = useQueryClient();

  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: company } = useQuery({
    queryKey: ['company', project?.client_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === project?.client_id);
    },
    enabled: !!project?.client_id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => base44.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: budget } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: async () => {
      const budgets = await base44.entities.ProjectBudget.filter({ project_id: projectId });
      return budgets[0];
    },
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  const { data: performanceObligations = [] } = useQuery({
    queryKey: ['performanceObligations', projectId],
    queryFn: async () => {
      const all = await base44.entities.PerformanceObligation.list();
      return all.filter(po => po.project_id === projectId);
    },
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: async () => {
      const all = await base44.entities.ChangeOrder.list();
      return all.filter(co => co.project_id === projectId);
    },
    enabled: !!projectId,
  });

  // Auto-calculate project progress on mount and when data changes
  React.useEffect(() => {
    if (projectId && (tasks.length > 0 || budget || performanceObligations.length > 0)) {
      recalculateProjectProgress();
    }
  }, [tasks, budget, performanceObligations, projectId]); // Added projectId to dependencies for safety.

  React.useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'dailylogs') {
      setTimeout(() => {
        const dailylogsTab = document.querySelector('[data-value="dailylogs"]');
        if (dailylogsTab) {
          dailylogsTab.click();
        }
      }, 100);
    } else if (hash === 'schedule') {
      setTimeout(() => {
        const scheduleTab = document.querySelector('[data-value="schedule"]');
        if (scheduleTab) {
          scheduleTab.click();
        }
      }, 100);
    }
  }, []);

  const recalculateProjectProgress = async () => {
    if (!projectId || isRecalculating) return;
    
    setIsRecalculating(true);
    try {
      // Calculate progress from multiple sources
      let taskProgress = 0;
      let costProgress = 0;
      let obligationProgress = 0;
      
      // 1. Task-based progress (weighted by duration)
      if (tasks.length > 0) {
        let totalDuration = 0;
        let completedDuration = 0;
        
        tasks.forEach(task => {
          const duration = task.duration_days || 1; // Default to 1 day if duration is 0 or null
          const completion = task.percent_complete || 0;
          totalDuration += duration;
          completedDuration += (duration * completion / 100);
        });
        
        taskProgress = totalDuration > 0 
          ? (completedDuration / totalDuration) * 100
          : 0;
      }

      // 2. Cost-based progress (if budget data available)
      if (budget?.forecast_at_completion > 0 && budget?.actual_costs != null) { // Check for null/undefined as actual_costs can be 0
        costProgress = (budget.actual_costs / budget.forecast_at_completion) * 100;
      }

      // 3. Performance obligation progress
      if (performanceObligations.length > 0) {
        const totalValue = performanceObligations.reduce((sum, po) => sum + (po.allocated_value || 0), 0);
        const completedValue = performanceObligations
          .filter(po => po.status === 'Completed')
          .reduce((sum, po) => sum + (po.allocated_value || 0), 0);
        
        obligationProgress = totalValue > 0 ? (completedValue / totalValue) * 100 : 0;
      }

      // Use weighted average, prioritizing task progress
      let finalProgress = 0;
      let weightSum = 0;

      if (tasks.length > 0) {
        finalProgress += taskProgress * 0.5; // 50% weight on tasks
        weightSum += 0.5;
      }
      if (budget && budget?.forecast_at_completion > 0) { // Only apply cost weight if budget has a valid forecast
        finalProgress += costProgress * 0.3; // 30% weight on cost
        weightSum += 0.3;
      }
      if (performanceObligations.length > 0) {
        finalProgress += obligationProgress * 0.2; // 20% weight on obligations
        weightSum += 0.2;
      }

      finalProgress = weightSum > 0 ? Math.round(finalProgress / weightSum) : 0;
      finalProgress = Math.min(100, Math.max(0, finalProgress)); // Clamp between 0-100

      // Only update if progress has changed significantly
      if (project && Math.abs((project.percent_complete || 0) - finalProgress) >= 1) { // Only update if difference is 1% or more
        await base44.entities.Project.update(projectId, {
          percent_complete: finalProgress
        });
        
        // Refetch project data to show updated progress
        refetchProject();
      }
    } catch (error) {
      console.error('Error recalculating project progress:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const updateObligationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PerformanceObligation.update(id, data),
    onSuccess: (updatedObligation) => {
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      queryClient.invalidateQueries({ queryKey: ['performanceObligations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      setShowEditObligationModal(false);
      setEditingObligation(null);
      // Trigger progress recalculation
      setTimeout(() => recalculateProjectProgress(), 500);
    },
  });

  const handleEditObligation = (obligation) => {
    setEditingObligation(obligation);
    setShowEditObligationModal(true);
  };

  const handleSaveObligation = () => {
    if (editingObligation) {
      updateObligationMutation.mutate({
        id: editingObligation.id,
        data: editingObligation
      });
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading project...</p>
      </div>
    );
  }

  // Calculate revised contract value
  const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
  const approvedCOValue = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
  const revisedContractValue = (project.contract_value || 0) + approvedCOValue;

  // Calculate performance obligation metrics
  const totalAllocated = performanceObligations.reduce((sum, po) => sum + (po.allocated_value || 0), 0);
  const completedValue = performanceObligations
    .filter(po => po.status === 'Completed')
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);
  const pendingValue = performanceObligations
    .filter(po => ['Not Started', 'In Progress'].includes(po.status))
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);
  const completedCount = performanceObligations.filter(po => po.status === 'Completed').length;
  const totalCount = performanceObligations.length;

  return (
    <div className="space-y-6">
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
            onClick={recalculateProjectProgress}
            disabled={isRecalculating}
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700"
            title="Recalculate Progress"
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          </Button>
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
              {project.contract_value ? (project.contract_value).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-gray-600">Progress (Live)</p>
              {isRecalculating && (
                <RefreshCw className="w-3 h-3 text-[#1B4D3E] animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-gray-900">{project.percent_complete || 0}%</p>
              <div className="flex-1 bg-gray-300 rounded-full h-2">
                <div
                  className="bg-[#1B4D3E] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${project.percent_complete || 0}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Auto-updates from tasks, costs & obligations
            </p>
          </CardContent>
        </Card>
      </div>

      <DailyLogRiskSuggestions projectId={projectId} />

      <Tabs defaultValue="financials" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="financials" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Financials & CTC
          </TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Budget Tracking
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <Brain className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="obligations" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Performance Obligations
          </TabsTrigger>
          <TabsTrigger value="changeorders" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileEdit className="w-4 h-4 mr-2" />
            Change Orders
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="materials" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Material & Misc Costs
          </TabsTrigger>
          <TabsTrigger value="schedule" data-value="schedule" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="dailylogs" data-value="dailylogs" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            Daily Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financials">
          <ProjectFinancials projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetModule projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="ai-insights">
          <ProjectAIInsights projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="changeorders">
          <ChangeOrdersTab projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="obligations">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Allocated</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAllocated)}</p>
                      <p className="text-xs text-gray-600 mt-1">{totalCount} obligations</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-[#0E351F]" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Revenue Recognized</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(completedValue)}</p>
                      <p className="text-xs text-gray-600 mt-1">{completedCount} completed</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Pending Recognition</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(pendingValue)}</p>
                      <p className="text-xs text-gray-600 mt-1">{totalCount - completedCount} pending</p>
                    </div>
                    <Calendar className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contract Value Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-900 font-semibold mb-1">Contract Value Breakdown</p>
                    <p className="text-sm text-blue-800">
                      Original Contract: {formatCurrency(project.contract_value || 0)}
                      {approvedCOValue !== 0 && (
                        <span className="ml-2">+ {formatCurrency(approvedCOValue)} Approved COs</span>
                      )}
                      <span className="ml-2 font-semibold">= {formatCurrency(revisedContractValue)} Revised</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Obligations Table */}
            {performanceObligations.length > 0 ? (
              <Card className="bg-white border-gray-200">
                <CardHeader className="border-b border-gray-300">
                  <div className="flex items-center justify-between">
                    <CardTitle>Performance Obligations</CardTitle>
                    <Button
                      onClick={() => window.location.href = createPageUrl('Finance') + '#obligations'}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Manage All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5F4F3] border-b border-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Obligation</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">% of Contract</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Allocated Value</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Est. Complete</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actual Complete</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {performanceObligations.map((obligation) => {
                          const isPending = ['Not Started', 'In Progress'].includes(obligation.status);
                          const isCompleted = obligation.status === 'Completed';
                          
                          return (
                            <tr key={obligation.id} className={`hover:bg-gray-50 ${isPending ? 'bg-orange-50' : isCompleted ? 'bg-green-50' : ''}`}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{obligation.name}</p>
                                {obligation.description && (
                                  <p className="text-xs text-gray-600 mt-1">{obligation.description}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-900">
                                {obligation.percentage_of_contract.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                {formatCurrency(obligation.allocated_value)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StatusBadge status={obligation.status} />
                              </td>
                              <td className="px-4 py-3 text-center text-gray-900">
                                {obligation.estimated_completion_date ? formatDate(obligation.estimated_completion_date) : '-'}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-900">
                                {obligation.completion_date ? formatDate(obligation.completion_date) : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditObligation(obligation)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white border-gray-200">
                <CardContent className="p-12 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No Performance Obligations Yet</p>
                  <p className="text-sm">Performance obligations help track revenue recognition milestones for this project.</p>
                  <Button
                    onClick={() => window.location.href = createPageUrl('Finance') + '#obligations'}
                    className="mt-4 bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                  >
                    Add Performance Obligations
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <ProjectFolders projectId={projectId} />
        </TabsContent>

        <TabsContent value="materials">
          <MaterialCosts projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="schedule">
          <ProjectSchedule projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="dailylogs">
          <ProjectDailyLogs projectId={projectId} projectName={project.name} />
        </TabsContent>
      </Tabs>

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

      {/* Quick Edit Performance Obligation Status Modal */}
      {showEditObligationModal && editingObligation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="bg-[#F5F4F3] border-gray-300 max-w-md w-full">
            <CardHeader className="border-b border-gray-300">
              <CardTitle>Update: {editingObligation.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={editingObligation.status}
                  onValueChange={(value) => setEditingObligation({...editingObligation, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingObligation.status === 'Completed' && (
                <div>
                  <Label>Completion Date</Label>
                  <Input
                    type="date"
                    value={editingObligation.completion_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingObligation({...editingObligation, completion_date: e.target.value ? new Date(e.target.value + 'T12:00:00.000Z').toISOString() : null})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editingObligation.notes || ''}
                  onChange={(e) => setEditingObligation({...editingObligation, notes: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditObligationModal(false);
                    setEditingObligation(null);
                  }}
                  className="border-gray-300 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveObligation}
                  className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                  disabled={updateObligationMutation.isPending}
                >
                  {updateObligationMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}