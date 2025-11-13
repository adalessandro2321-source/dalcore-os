
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Edit,
  AlertTriangle,
  Plus,
  Target // Added Target icon for estimate banner
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { useNavigate } from "react-router-dom";
import BudgetAIAnalysis from "./BudgetAIAnalysis";

export default function ProjectFinancials({ projectId, project }) {
  const [showForecastModal, setShowForecastModal] = React.useState(false);
  const [forecastValue, setForecastValue] = React.useState(0);
  const [recalculating, setRecalculating] = React.useState(false);
  const [showDebug, setShowDebug] = React.useState(false);
  const [showChangeOrderModal, setShowChangeOrderModal] = React.useState(false);
  const [newChangeOrder, setNewChangeOrder] = React.useState({
    description: '',
    cost_impact: 0,
    status: 'Pending'
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Helper function for creating page URLs (can be moved to a utility file if needed)
  const createPageUrl = (path) => `/${path}`;

  const { data: budget, isLoading } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: async () => {
      const budgets = await base44.entities.ProjectBudget.filter({ project_id: projectId });
      return budgets[0];
    },
    enabled: !!projectId,
  });

  // NEW: Query to fetch the linked estimate
  const { data: estimate } = useQuery({
    queryKey: ['estimate', project?.estimate_id],
    queryFn: async () => {
      if (!project?.estimate_id) return null;
      // Assuming base44.entities.Estimate.list() returns all and we filter client-side.
      // If a direct filter by ID is supported (e.g., base44.entities.Estimate.filter({ id: project.estimate_id })), it would be more efficient.
      const estimates = await base44.entities.Estimate.list();
      return estimates.find(e => e.id === project.estimate_id);
    },
    enabled: !!project?.estimate_id,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: () => base44.entities.ChangeOrder.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', projectId],
    queryFn: () => base44.entities.Bill.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', projectId],
    queryFn: () => base44.entities.Invoice.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', projectId],
    queryFn: () => base44.entities.Payment.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: materialCosts = [] } = useQuery({
    queryKey: ['materialCosts', projectId],
    queryFn: async () => {
      const costs = await base44.entities.MaterialCost.filter({ project_id: projectId });
      return costs;
    },
    enabled: !!projectId,
  });

  const updateForecastMutation = useMutation({
    mutationFn: async (forecast) => {
      if (!budget) {
        await base44.entities.ProjectBudget.create({
          project_id: projectId,
          original_contract_value: project.contract_value || 0,
          uncommitted_forecast: forecast
        });
      } else {
        await base44.entities.ProjectBudget.update(budget.id, {
          uncommitted_forecast: forecast
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      setShowForecastModal(false);
    },
  });

  const addChangeOrderMutation = useMutation({
    mutationFn: async (coData) => {
      await base44.entities.ChangeOrder.create({
        ...coData,
        project_id: projectId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      setShowChangeOrderModal(false);
      setNewChangeOrder({ description: '', cost_impact: 0, status: 'Pending' });
      recalculateBudget(); // Recalculate budget after adding a new CO
    },
    onError: (error) => {
      console.error("Error adding change order:", error);
      // Optionally show a user-friendly error message
    }
  });

  const recalculateBudget = async () => {
    if (!projectId || !project || recalculating) return;
    
    setRecalculating(true);
    try {
      const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
      const approved_co_value = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
      
      const original_contract_value = project.contract_value || 0;
      const revised_contract_value = original_contract_value + approved_co_value;

      let billActualCosts = 0;
      // Initialize COGS categorization totals
      let cogs_labor_field = 0;
      let cogs_labor_supervision = 0;
      let cogs_materials_from_bills = 0; // Bills contributing to materials COGS
      let cogs_subcontractors = 0;
      let cogs_equipment = 0; 
      let cogs_other = 0;

      bills.forEach(bill => {
        let billAmount = 0;
        if (bill.status === 'Paid' || bill.status === 'Approved') {
          billAmount = bill.amount || 0;
        } else if (bill.status === 'Partial') {
          billAmount = (bill.amount || 0) - (bill.balance_open || 0);
        }
        billActualCosts += billAmount; // Sum for overall actual costs from bills

        // Categorize for COGS - Assuming 'type' field exists on Bill entity
        // If 'type' is not available, this categorization will need to be refined based on actual Bill entity structure
        switch (bill.type) { 
          case 'labor_field':
            cogs_labor_field += billAmount;
            break;
          case 'labor_supervision':
            cogs_labor_supervision += billAmount;
            break;
          case 'materials':
            cogs_materials_from_bills += billAmount;
            break;
          case 'subcontractor':
            cogs_subcontractors += billAmount;
            break;
          case 'equipment': 
            cogs_equipment += billAmount;
            break;
          default:
            cogs_other += billAmount;
            break;
        }
      });

      const approvedMaterialCostsFromMaterialEntity = materialCosts
        .filter(m => m.approved === true)
        .reduce((sum, m) => sum + (m.amount || 0), 0);
      
      // Total COGS Materials is sum from bills and material entities
      const cogs_materials = cogs_materials_from_bills + approvedMaterialCostsFromMaterialEntity;

      const totalMaterialCosts = materialCosts.reduce((sum, m) => sum + (m.amount || 0), 0); // Total committed material costs
      const actual_costs = billActualCosts + approvedMaterialCostsFromMaterialEntity; // Overall actuals from bills and approved material costs
      const totalBillCosts = bills.reduce((sum, b) => sum + (b.amount || 0), 0); // Total amount of all bills (committed)
      const committed_costs = totalBillCosts + totalMaterialCosts; // All bills (committed) + all material costs (committed)

      const ap_open = bills
        .filter(b => ['Draft', 'Pending', 'Approved', 'Partial'].includes(b.status))
        .reduce((sum, b) => {
          if (b.status === 'Partial') {
            return sum + (b.balance_open || 0);
          }
          return sum + (b.amount || 0);
        }, 0);

      const ar_invoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

      const ar_collected = invoices.reduce((sum, inv) => {
        if (!inv.balance_open || inv.balance_open === 0) {
          return sum + (inv.total || 0);
        } else {
          return sum + ((inv.total || 0) - (inv.balance_open || 0));
        }
      }, 0);

      const ar_open = ar_invoiced - ar_collected;
      const uncommitted_forecast = budget?.uncommitted_forecast || 0;
      const forecast_at_completion = committed_costs + uncommitted_forecast;
      const cost_to_complete = forecast_at_completion - actual_costs;
      const percent_complete_cost = forecast_at_completion > 0 ? (actual_costs / forecast_at_completion) * 100 : 0;
      const gp_forecast = revised_contract_value - forecast_at_completion;

      const budgetData = {
        project_id: projectId,
        original_contract_value,
        approved_co_value,
        revised_contract_value,
        committed_costs,
        actual_costs,
        ap_open,
        ar_invoiced,
        ar_collected,
        ar_open,
        uncommitted_forecast,
        forecast_at_completion,
        cost_to_complete,
        percent_complete_cost,
        gp_forecast,
        last_recalculated: new Date().toISOString(),
        // NEW: COGS fields based on actual expenses
        cogs_labor_field,
        cogs_labor_supervision,
        cogs_materials,
        cogs_subcontractors,
        cogs_equipment,
        cogs_other,
        // NEW: Baseline fields from estimate (if available)
        baseline_total_cost: estimate?.total_cost || 0,
        baseline_gp: estimate?.gross_profit || 0,
        baseline_labor_cost: (estimate?.labor_cost || 0) + (estimate?.supervision_cost || 0), // Assuming combined labor cost from estimate
        baseline_materials_cost: estimate?.material_cost || 0,
        baseline_subcontractor_cost: estimate?.subcontractor_cost || 0,
        baseline_equipment_cost: estimate?.equipment_cost || 0, 
      };

      if (!budget) {
        await base44.entities.ProjectBudget.create(budgetData);
      } else {
        await base44.entities.ProjectBudget.update(budget.id, budgetData);
      }

      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
    } catch (error) {
      console.error('Recalculation error:', error);
    }
    setRecalculating(false);
  };

  // No explicit useEffect for recalculation on estimate change to avoid potential loops
  // or unintended frequent recalculations. Recalculate is triggered manually or by specific mutations.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading financials...</p>
      </div>
    );
  }

  const exportCSV = () => {
    if (!budget) return;

    const csv = [
      ['Metric', 'Value'],
      ['Project', project.name],
      ['Original Contract', budget.original_contract_value || 0],
      ['Approved Change Orders', budget.approved_co_value || 0],
      ['Revised Contract Value', budget.revised_contract_value || 0],
      ['Actual Costs', budget.actual_costs || 0],
      ['Committed Costs', budget.committed_costs || 0],
      ['Forecast at Completion (EAC)', budget.forecast_at_completion || 0],
      ['Cost to Complete (CTC)', budget.cost_to_complete || 0],
      ['AP Open', budget.ap_open || 0],
      ['AR Invoiced', budget.ar_invoiced || 0],
      ['AR Collected', budget.ar_collected || 0],
      ['AR Open', budget.ar_open || 0],
      ['% Complete (Cost)', (budget.percent_complete_cost || 0).toFixed(2)],
      ['GP Forecast', budget.gp_forecast || 0],
      // Add COGS fields to export
      ['COGS - Labor Field', budget.cogs_labor_field || 0],
      ['COGS - Labor Supervision', budget.cogs_labor_supervision || 0],
      ['COGS - Materials', budget.cogs_materials || 0],
      ['COGS - Subcontractors', budget.cogs_subcontractors || 0],
      ['COGS - Equipment', budget.cogs_equipment || 0],
      ['COGS - Other', budget.cogs_other || 0],
      // Add Baseline fields to export if estimate exists
      ...(estimate && budget.baseline_total_cost !== undefined ? [ // Only export if estimate existed during budget recalculation
        ['Baseline Total Cost', budget.baseline_total_cost || 0],
        ['Baseline GP', budget.baseline_gp || 0],
        ['Baseline Labor Cost', budget.baseline_labor_cost || 0],
        ['Baseline Materials Cost', budget.baseline_materials_cost || 0],
        ['Baseline Subcontractor Cost', budget.baseline_subcontractor_cost || 0],
        ['Baseline Equipment Cost', budget.baseline_equipment_cost || 0],
      ] : [])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.number}_WIP_CTC_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getHealthColor = (value, threshold = 0) => {
    if (value > threshold) return 'text-[#2A6B5A]';
    if (value < 0) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="space-y-6">
      {/* AI Budget Analysis */}
      <BudgetAIAnalysis projectId={projectId} project={project} budget={budget} />

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => navigate(createPageUrl(`CreateInvoice?returnTo=project&projectId=${projectId}`))}
          className="bg-[#0E351F] hover:bg-[#14503C] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
        <Button
          onClick={() => navigate(createPageUrl(`CreateBill?returnTo=project&projectId=${projectId}`))}
          variant="outline"
          className="border-[#C9C8AF] text-[#0E351F]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Bill
        </Button>
        <Button
          onClick={() => setShowChangeOrderModal(true)}
          variant="outline"
          className="border-[#C9C8AF] text-[#0E351F]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Change Order
        </Button>
      </div>

      {/* Estimate Baseline Banner - show if project has linked estimate AND budget data is loaded */}
      {estimate && budget && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="border-b border-blue-200">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Target className="w-5 h-5" />
                Estimate Baseline Comparison
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl(`CreateEstimate?id=${estimate.id}`))}
                className="text-blue-700 hover:text-blue-800"
              >
                View Original Estimate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Baseline vs Forecast Cost</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(budget.baseline_total_cost || 0)}
                  </p>
                  <span className="text-sm text-gray-600">→</span>
                  <p className={`text-xl font-bold ${
                    (budget.forecast_at_completion || 0) > (budget.baseline_total_cost || 0) 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {formatCurrency(budget.forecast_at_completion || 0)}
                  </p>
                </div>
                <p className={`text-xs mt-1 ${
                  (budget.forecast_at_completion || 0) > (budget.baseline_total_cost || 0)
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {(budget.baseline_total_cost || 0) > 0 ? (
                    <>
                      {((budget.forecast_at_completion - (budget.baseline_total_cost || 0)) / (budget.baseline_total_cost || 1) * 100).toFixed(1)}% 
                      {(budget.forecast_at_completion || 0) > (budget.baseline_total_cost || 0) ? ' over' : ' under'} baseline
                    </>
                  ) : '-'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Baseline vs Forecast GP</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(budget.baseline_gp || 0)}
                  </p>
                  <span className="text-sm text-gray-600">→</span>
                  <p className={`text-xl font-bold ${
                    (budget.gp_forecast || 0) < (budget.baseline_gp || 0)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {formatCurrency(budget.gp_forecast || 0)}
                  </p>
                </div>
                <p className={`text-xs mt-1 ${
                  (budget.gp_forecast || 0) < (budget.baseline_gp || 0)
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {budget.baseline_gp !== undefined && budget.gp_forecast !== undefined ? (
                    <>
                      {formatCurrency(budget.gp_forecast - (budget.baseline_gp || 0))} 
                      {(budget.gp_forecast || 0) < (budget.baseline_gp || 0) ? ' less' : ' more'} than estimate
                    </>
                  ) : '-'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Cost Categories Variance</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Labor:</span>
                    <span className={
                      ((budget.cogs_labor_field || 0) + (budget.cogs_labor_supervision || 0)) > (budget.baseline_labor_cost || 0)
                        ? 'text-red-600'
                        : 'text-green-600'
                    }>
                      {(budget.baseline_labor_cost || 0) > 0 ? 
                        `${((( (budget.cogs_labor_field || 0) + (budget.cogs_labor_supervision || 0)) - (budget.baseline_labor_cost || 0)) / (budget.baseline_labor_cost || 1) * 100).toFixed(0)}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Materials:</span>
                    <span className={
                      (budget.cogs_materials || 0) > (budget.baseline_materials_cost || 0)
                        ? 'text-red-600'
                        : 'text-green-600'
                    }>
                      {(budget.baseline_materials_cost || 0) > 0 ?
                        `${(((budget.cogs_materials || 0) - (budget.baseline_materials_cost || 0)) / (budget.baseline_materials_cost || 1) * 100).toFixed(0)}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subcontractors:</span>
                    <span className={
                      (budget.cogs_subcontractors || 0) > (budget.baseline_subcontractor_cost || 0)
                        ? 'text-red-600'
                        : 'text-green-600'
                    }>
                      {(budget.baseline_subcontractor_cost || 0) > 0 ?
                        `${(((budget.cogs_subcontractors || 0) - (budget.baseline_subcontractor_cost || 0)) / (budget.baseline_subcontractor_cost || 1) * 100).toFixed(0)}%`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={recalculateBudget}
            disabled={recalculating}
            className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate CTC
          </Button>
          <Button
            onClick={() => {
              setForecastValue(budget?.uncommitted_forecast || 0);
              setShowForecastModal(true);
            }}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Update Forecast
          </Button>
          <Button
            onClick={() => setShowDebug(!showDebug)}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </Button>
        </div>
        <Button
          onClick={exportCSV}
          variant="outline"
          className="border-gray-300 text-gray-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {showDebug && (
        <Card className="bg-yellow-50 border-yellow-300">
          <CardHeader>
            <CardTitle className="text-lg">Debug Info - AR Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">Invoices for this project ({invoices.length} total):</p>
              {invoices.length === 0 ? (
                <p className="text-gray-600">No invoices found</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => {
                    const collected = (!inv.balance_open || inv.balance_open === 0) 
                      ? (inv.total || 0) 
                      : (inv.total || 0) - (inv.balance_open || 0);
                    
                    return (
                      <div key={inv.id} className="p-3 bg-white rounded border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><strong>Invoice:</strong> {inv.number || inv.id.slice(0, 8)}</div>
                          <div><strong>Status:</strong> {inv.status}</div>
                          <div><strong>Total:</strong> {formatCurrency(inv.total || 0)}</div>
                          <div><strong>Balance Open:</strong> {formatCurrency(inv.balance_open || 0)}</div>
                          <div className="col-span-2"><strong>Collected:</strong> {formatCurrency(collected)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3 bg-green-100 rounded font-semibold">
                    Total AR Invoiced: {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
                  </div>
                  <div className="p-3 bg-blue-100 rounded font-semibold">
                    Total AR Collected: {formatCurrency(invoices.reduce((sum, inv) => {
                      if (!inv.balance_open || inv.balance_open === 0) {
                        return sum + (inv.total || 0);
                      } else {
                        return sum + ((inv.total || 0) - (inv.balance_open || 0));
                      }
                    }, 0))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {budget?.last_recalculated && (
        <p className="text-sm text-gray-600">
          Last updated: {formatDate(budget.last_recalculated, 'MMM d, yyyy h:mm a')}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Revised Contract</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(budget?.revised_contract_value || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  +{formatCurrency(budget?.approved_co_value || 0)} COs
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cost to Complete</p>
                <p className={`text-2xl font-bold ${getHealthColor(budget?.cost_to_complete || 0)}`}>
                  {formatCurrency(budget?.cost_to_complete || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {(budget?.percent_complete_cost || 0).toFixed(1)}% complete
                </p>
              </div>
              {(budget?.cost_to_complete || 0) < 0 ? (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              ) : (
                <TrendingUp className="w-8 h-8 text-[#2A6B5A]" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">GP Forecast</p>
                <p className={`text-2xl font-bold ${getHealthColor(budget?.gp_forecast || 0)}`}>
                  {formatCurrency(budget?.gp_forecast || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {budget?.revised_contract_value > 0 ? 
                    ((budget.gp_forecast / budget.revised_contract_value) * 100).toFixed(1) : 0}% margin
                </p>
              </div>
              {(budget?.gp_forecast || 0) > 0 ? (
                <TrendingUp className="w-8 h-8 text-[#2A6B5A]" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">AR Open</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(budget?.ar_open || 0)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  AP: {formatCurrency(budget?.ap_open || 0)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="text-lg">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Actual Costs</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(budget?.actual_costs || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Committed Costs</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(budget?.committed_costs || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Uncommitted Forecast</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(budget?.uncommitted_forecast || 0)}
              </span>
            </div>
            <div className="h-px bg-gray-300 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Forecast at Completion (EAC)</span>
              <span className="font-bold text-gray-900 text-lg">
                {formatCurrency(budget?.forecast_at_completion || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="text-lg">Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">AR Invoiced</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(budget?.ar_invoiced || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">AR Collected</span>
              <span className="font-semibold text-[#2A6B5A]">
                {formatCurrency(budget?.ar_collected || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">AR Outstanding</span>
              <span className="font-semibold text-yellow-700">
                {formatCurrency(budget?.ar_open || 0)}
              </span>
            </div>
            <div className="h-px bg-gray-300 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-gray-600">AP Open</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(budget?.ap_open || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-600">Cost Progress</span>
            <span className="text-sm font-semibold text-gray-900">
              {(budget?.percent_complete_cost || 0).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-[#1B4D3E] to-[#2A6B5A] h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(budget?.percent_complete_cost || 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-600">
            <span>{formatCurrency(budget?.actual_costs || 0)} spent</span>
            <span>{formatCurrency(budget?.forecast_at_completion || 0)} EAC</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForecastModal} onOpenChange={setShowForecastModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Update Uncommitted Forecast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="forecastValue">Uncommitted Work Forecast</Label>
              <Input
                id="forecastValue"
                type="number"
                value={forecastValue}
                onChange={(e) => setForecastValue(parseFloat(e.target.value) || 0)}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Enter forecasted remaining costs"
              />
              <p className="text-xs text-gray-600 mt-1">
                Estimate the cost of work not yet committed to subcontractors or vendors
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg space-y-2 text-sm border border-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Actual Costs:</span>
                <span className="text-gray-900">{formatCurrency(budget?.actual_costs || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Committed (not yet paid):</span>
                <span className="text-gray-900">
                  {formatCurrency((budget?.committed_costs || 0) - (budget?.actual_costs || 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">New Forecast:</span>
                <span className="text-gray-900">{formatCurrency(forecastValue)}</span>
              </div>
              <div className="h-px bg-gray-300 my-2" />
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700">New EAC:</span>
                <span className="text-gray-900">
                  {formatCurrency((budget?.actual_costs || 0) + 
                    ((budget?.committed_costs || 0) - (budget?.actual_costs || 0)) + 
                    forecastValue)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowForecastModal(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateForecastMutation.mutate(forecastValue)}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={updateForecastMutation.isPending}
              >
                {updateForecastMutation.isPending ? 'Updating...' : 'Update Forecast'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangeOrderModal} onOpenChange={setShowChangeOrderModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Add New Change Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="coDescription">Description</Label>
              <Input
                id="coDescription"
                type="text"
                value={newChangeOrder.description}
                onChange={(e) => setNewChangeOrder({...newChangeOrder, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Description of the change order"
              />
            </div>
            <div>
              <Label htmlFor="coCostImpact">Cost Impact</Label>
              <Input
                id="coCostImpact"
                type="number"
                value={newChangeOrder.cost_impact}
                onChange={(e) => setNewChangeOrder({...newChangeOrder, cost_impact: parseFloat(e.target.value) || 0})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Enter cost impact"
              />
              <p className="text-xs text-gray-600 mt-1">
                Enter a positive value for additional costs/revenue, negative for reductions.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setShowChangeOrderModal(false)}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addChangeOrderMutation.mutate(newChangeOrder)}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
              disabled={addChangeOrderMutation.isPending || !newChangeOrder.description}
            >
              {addChangeOrderMutation.isPending ? 'Adding...' : 'Add Change Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
