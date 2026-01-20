import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  FolderOpen,
  Calendar,
  Users,
  ArrowRight,
  FileText,
  Plus,
  Bell,
  Construction,
  Briefcase,
  Target
} from "lucide-react";
import { formatDate } from "../components/shared/DateFormatter";
import { format, subDays } from "date-fns";
import CTCWidget from "../components/dashboard/CTCWidget";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list(),
  });

  const { data: risks = [] } = useQuery({
    queryKey: ['risks'],
    queryFn: () => base44.entities.Risk.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders'],
    queryFn: () => base44.entities.ChangeOrder.list(),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['projectBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  const { data: performanceObligations = [] } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.getMe(),
  });

  const updateRiskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Risk.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
    },
  });

  const updateChangeOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChangeOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
    },
  });

  const today = new Date();

  // Calculate current year Revenue metrics
  const currentYear = new Date().getFullYear();

  // Revenue Recognized: Completed obligations in current year
  const currentYearRevenueRecognized = performanceObligations
    .filter(po => {
      if (po.status !== 'Completed' || !po.completion_date) return false;
      const completionYear = new Date(po.completion_date).getFullYear();
      return completionYear === currentYear;
    })
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  // Revenue Pending Recognition: Not Started + In Progress obligations (all, not year-filtered)
  const currentYearRevenuePending = performanceObligations
    .filter(po => ['Not Started', 'In Progress'].includes(po.status))
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  // Total Revenue (Recognized + Pending for current year)
  const currentYearTotalRevenue = currentYearRevenueRecognized + currentYearRevenuePending;

  const activeProjects = projects.filter(p => p.status === 'Active');
  const completedProjects = projects.filter(p => p.status === 'Completed');
  const totalContractValue = projects.reduce((sum, p) => sum + (p.contract_value || 0), 0);


  // Only show budget alerts for ACTIVE projects (not completed/closed)
  const projectsWithAlerts = activeProjects.filter(p => {
    const budget = budgets.find(b => b.project_id === p.id);
    return budget && (budget.cost_to_complete < 0 || budget.gp_forecast < 0);
  });

  const arOpen = invoices
    .filter(i => ['Sent', 'Partial'].includes(i.status))
    .reduce((sum, i) => sum + (i.balance_open || 0), 0);

  const apOpen = bills
    .filter(b => ['Approved', 'Partial'].includes(b.status))
    .reduce((sum, b) => sum + (b.balance_open || 0), 0);

  // Only show overdue items for ACTIVE projects
  const overdueInvoices = invoices.filter(i => {
    const project = projects.find(p => p.id === i.project_id);
    return i.due_date &&
           new Date(i.due_date) < today &&
           ['Sent', 'Partial'].includes(i.status) &&
           project &&
           ['Active', 'Planning'].includes(project.status);
  });

  const overdueBills = bills.filter(b => {
    const project = projects.find(p => p.id === b.project_id);
    return b.due_date &&
           new Date(b.due_date) < today &&
           ['Approved', 'Partial'].includes(b.status) &&
           project &&
           ['Active', 'Planning'].includes(project.status);
  });

  const criticalRisks = risks.filter(r => {
    const project = projects.find(p => p.id === r.project_id);
    return r.impact === 'High' &&
           ['Identified', 'Monitoring'].includes(r.status) &&
           project &&
           ['Active', 'Planning'].includes(project.status);
  });

  const overdueTasks = tasks.filter(t =>
    t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
  );

  // Include Lead, Qualified, Bidding, AND Awarded opportunities (not yet converted to projects)
  const activeOpportunities = opportunities.filter(o =>
    ['Lead', 'Qualified', 'Bidding', 'Awarded'].includes(o.stage) && o.stage !== 'Under Contract'
  );

  const pipelineValue = activeOpportunities.reduce((sum, o) =>
    sum + ((o.estimated_value || 0) * (o.probability || 0) / 100), 0
  );

  // Only show pending COs for ACTIVE projects
  const pendingCOs = changeOrders.filter(co => {
    const project = projects.find(p => p.id === co.project_id);
    return co.status === 'Pending' &&
           project &&
           ['Active', 'Planning'].includes(project.status);
  });

  const pendingCOValue = pendingCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);

  // All risks on active projects (not just critical ones)
  const activeProjectRisks = risks.filter(r => {
    const project = projects.find(p => p.id === r.project_id);
    return ['Identified', 'Monitoring'].includes(r.status) &&
           project &&
           ['Active', 'Planning'].includes(project.status);
  }).sort((a, b) => {
    // Sort by severity: High Impact first, then by probability
    const impactWeight = { High: 3, Medium: 2, Low: 1 };
    const probWeight = { High: 3, Medium: 2, Low: 1 };
    const scoreA = impactWeight[a.impact] * probWeight[a.probability];
    const scoreB = impactWeight[b.impact] * probWeight[b.probability];
    return scoreB - scoreA;
  });

  const upcomingTasks = tasks
    .filter(t => {
      if (!t.start_date) return false;
      const startDate = new Date(t.start_date);
      const next7Days = subDays(today, -7);
      return startDate <= next7Days && startDate >= today && t.percent_complete < 100;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || '-';
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || '-';
  };

  const handleResolveRisk = (e, riskId) => {
    e.stopPropagation();
    updateRiskMutation.mutate({
      id: riskId,
      data: {
        status: 'Mitigated',
        mitigation_complete_date: new Date().toISOString(),
        mitigation_complete_by: currentUser?.email || ''
      }
    });
  };

  const handleApproveChangeOrder = (e, coId) => {
    e.stopPropagation();
    updateChangeOrderMutation.mutate({
      id: coId,
      data: { status: 'Approved' }
    });
  };

  const handleRejectChangeOrder = (e, coId) => {
    e.stopPropagation();
    updateChangeOrderMutation.mutate({
      id: coId,
      data: { status: 'Rejected' }
    });
  };

  const totalActionItems = projectsWithAlerts.length + criticalRisks.length + pendingCOs.length + overdueInvoices.length + overdueBills.length;

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Executive Dashboard</h2>
          <p className="text-gray-600 mt-1">Real-time construction operations overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-gray-300">
            <Calendar className="w-4 h-4 mr-2" />
            {format(today, 'MMM d, yyyy')}
          </Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-emerald-100 mb-1">Active Projects</p>
                <p className="text-3xl font-bold">{activeProjects.length}</p>
                <p className="text-xs text-emerald-100 mt-1">{projects.length} total</p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-emerald-100 mb-1">{currentYear} Revenue</p>
                <p className="text-3xl font-bold">{formatCurrency(currentYearTotalRevenue)}</p>
                <p className="text-xs text-emerald-100 mt-1">
                  {formatCurrency(currentYearRevenueRecognized)} recognized
                </p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">Pipeline Value</p>
                <p className="text-3xl font-bold">{formatCurrency(pipelineValue)}</p>
                <p className="text-xs text-blue-100 mt-1">{activeOpportunities.length} opportunities</p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-purple-100 mb-1">Total Contract Value</p>
                <p className="text-3xl font-bold">{formatCurrency(totalContractValue)}</p>
                <p className="text-xs text-purple-100 mt-1">{completedProjects.length} completed</p>
              </div>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown Card */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            {currentYear} Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
              <div className="flex justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Revenue Recognized</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(currentYearRevenueRecognized)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {performanceObligations.filter(po => po.status === 'Completed' && po.completion_date && new Date(po.completion_date).getFullYear() === currentYear).length} obligations completed
              </p>
            </div>

            <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex justify-center mb-3">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Pending Recognition</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(currentYearRevenuePending)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {performanceObligations.filter(po => ['Not Started', 'In Progress'].includes(po.status)).length} obligations pending
              </p>
            </div>

            <div className="text-center p-6 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex justify-center mb-3">
                <DollarSign className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Total {currentYear} Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(currentYearTotalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {((currentYearTotalRevenue > 0 ? (currentYearRevenueRecognized / currentYearTotalRevenue) : 0) * 100).toFixed(0)}% recognized
              </p>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Action Items Section - Only for active projects */}
      {(projectsWithAlerts.length > 0 || criticalRisks.length > 0 || pendingCOs.length > 0 || overdueInvoices.length > 0 || overdueBills.length > 0) && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="border-b border-red-200">
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Urgent Action Items ({projectsWithAlerts.length + criticalRisks.length + pendingCOs.length + overdueInvoices.length + overdueBills.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {/* Budget Alert Projects */}
              {projectsWithAlerts.map(project => {
                const budget = budgets.find(b => b.project_id === project.id);
                const issues = [];
                if (budget?.cost_to_complete < 0) {
                  issues.push(`Negative CTC: ${formatCurrency(budget.cost_to_complete)}`);
                }
                if (budget?.gp_forecast < 0) {
                  issues.push(`Negative GP: ${formatCurrency(budget.gp_forecast)}`);
                }

                return (
                  <div
                    key={project.id}
                    className="flex items-start gap-3 p-4 bg-white rounded-lg border border-red-200"
                  >
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-sm text-red-600 mt-1">{issues.join(' • ')}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Forecast at Completion: {formatCurrency(budget?.forecast_at_completion || 0)} •
                        Contract: {formatCurrency(budget?.revised_contract_value || 0)}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => navigate(createPageUrl('ProjectDetail') + `?id=${project.id}`)}
                          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                        >
                          Review Budget
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(createPageUrl('ProjectDetail') + `?id=${project.id}#dailylogs`)}
                          className="border-gray-300"
                        >
                          Update Forecast
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Critical Risks */}
              {criticalRisks.map(risk => (
                <div
                  key={risk.id}
                  className="flex items-start gap-3 p-4 bg-white rounded-lg border border-orange-200"
                >
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{risk.title}</p>
                    <p className="text-sm text-orange-600 mt-1">
                      {risk.category} • High Impact • {risk.probability} Probability
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {getProjectName(risk.project_id)}
                      {risk.description && ` • ${risk.description}`}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={(e) => handleResolveRisk(e, risk.id)}
                        disabled={updateRiskMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Mitigated
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(createPageUrl('Risks'))}
                        className="border-gray-300"
                      >
                        View All Risks
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pending Change Orders */}
              {pendingCOs.map(co => (
                <div
                  key={co.id}
                  className="flex items-start gap-3 p-4 bg-white rounded-lg border border-blue-200"
                >
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      Change Order {co.number || `#${co.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Cost Impact: {formatCurrency(co.cost_impact || 0)}
                      {co.schedule_impact_days > 0 && ` • Schedule: ${co.schedule_impact_days} days`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {getProjectName(co.project_id)} • {co.reason || 'No reason specified'}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={(e) => handleApproveChangeOrder(e, co.id)}
                        disabled={updateChangeOrderMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => handleRejectChangeOrder(e, co.id)}
                        disabled={updateChangeOrderMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(createPageUrl('ChangeOrderDetail') + `?id=${co.id}`)}
                        className="border-gray-300"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Overdue Invoices */}
              {overdueInvoices.map(invoice => {
                const daysOverdue = Math.floor((today - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={invoice.id}
                    className="flex items-start gap-3 p-4 bg-white rounded-lg border border-orange-200"
                  >
                    <Clock className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Invoice {invoice.number}</p>
                      <p className="text-sm text-orange-600 mt-1">
                        {daysOverdue} days overdue • Balance: {formatCurrency(invoice.balance_open || 0)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {getProjectName(invoice.project_id)} • {getCompanyName(invoice.client_id)} • Due: {formatDate(invoice.due_date)}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => navigate(createPageUrl('InvoiceDetail') + `?id=${invoice.id}`)}
                          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Record Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`mailto:${companies.find(c => c.id === invoice.client_id)?.email || ''}?subject=Payment Reminder - Invoice ${invoice.number}`)}
                          className="border-gray-300"
                        >
                          Send Reminder
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Overdue Bills */}
              {overdueBills.map(bill => {
                const daysOverdue = Math.floor((today - new Date(bill.due_date)) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={bill.id}
                    className="flex items-start gap-3 p-4 bg-white rounded-lg border border-red-200"
                  >
                    <Clock className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Bill {bill.number}</p>
                      <p className="text-sm text-red-600 mt-1">
                        {daysOverdue} days overdue • Balance: {formatCurrency(bill.balance_open || 0)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {getProjectName(bill.project_id)} • {getCompanyName(bill.vendor_id)} • Due: {formatDate(bill.due_date)}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => navigate(createPageUrl('BillDetail') + `?id=${bill.id}`)}
                          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Pay Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(createPageUrl('BillDetail') + `?id=${bill.id}`)}
                          className="border-gray-300"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Project Risks Section - New comprehensive risk view */}
      {activeProjectRisks.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="border-b border-amber-200">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5" />
                Active Project Risks ({activeProjectRisks.length})
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(createPageUrl('Risks'))}
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                Manage All Risks
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {activeProjectRisks.slice(0, 5).map(risk => {
                const riskScore = (() => {
                  const scoreMap = { Low: 1, Medium: 2, High: 3 };
                  return scoreMap[risk.probability] * scoreMap[risk.impact];
                })();

                const getRiskColor = () => {
                  if (riskScore >= 6) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
                  if (riskScore >= 4) return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
                  return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
                };

                const colors = getRiskColor();

                return (
                  <div
                    key={risk.id}
                    className={`flex items-start gap-3 p-4 bg-white rounded-lg border ${colors.border} hover:bg-gray-50 cursor-pointer transition-colors`}
                    onClick={() => navigate(createPageUrl('Risks'))}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} flex-shrink-0 mt-0.5`}>
                      <span className={`text-sm font-bold ${colors.text}`}>{riskScore}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{risk.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                              {risk.category}
                            </span>
                            <span className="text-xs text-gray-600">
                              {risk.impact} Impact • {risk.probability} Probability
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2">{getProjectName(risk.project_id)}</p>
                          {risk.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{risk.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveRisk(e, risk.id);
                          }}
                          disabled={updateRiskMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mitigated
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl('Risks'));
                          }}
                          className="border-gray-300"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeProjectRisks.length > 5 && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(createPageUrl('Risks'))}
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    View All {activeProjectRisks.length} Risks
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CTCWidget projects={projects} budgets={budgets} />

        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Sales Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Active Opportunities</p>
                  <p className="text-2xl font-bold text-gray-900">{activeOpportunities.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Weighted Pipeline</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(pipelineValue)}</p>
                </div>
              </div>

              {activeOpportunities.slice(0, 5).map(opp => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate(createPageUrl('OpportunityDetail') + `?id=${opp.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{opp.name}</p>
                    <p className="text-sm text-gray-600">{getCompanyName(opp.client_id)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(opp.estimated_value || 0)}</p>
                    <p className="text-xs text-gray-600">{opp.probability}% probability</p>
                  </div>
                </div>
              ))}

              {activeOpportunities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active opportunities</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {upcomingTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{task.name}</p>
                    <p className="text-sm text-gray-600">{getProjectName(task.project_id)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Starts: {formatDate(task.start_date)}
                    </p>
                  </div>
                </div>
              ))}

              {upcomingTasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming tasks</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="flex items-center gap-2">
              <Construction className="w-5 h-5" />
              Active Projects Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {activeProjects.slice(0, 5).map(project => {
                const budget = budgets.find(b => b.project_id === project.id);
                const hasAlert = budget && (budget.cost_to_complete < 0 || budget.gp_forecast < 0);

                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => navigate(createPageUrl('ProjectDetail') + `?id=${project.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{project.name}</p>
                        {hasAlert && <AlertTriangle className="w-4 h-4 text-red-600" />}
                      </div>
                      <p className="text-sm text-gray-600">{getCompanyName(project.client_id)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(project.contract_value || 0)}
                      </p>
                      {budget && (
                        <p className={`text-xs ${budget.gp_forecast >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          GP: {formatCurrency(budget.gp_forecast || 0)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeProjects.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active projects</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}