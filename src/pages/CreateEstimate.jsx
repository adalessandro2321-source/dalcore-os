import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Save, Download, Sparkles } from "lucide-react";
import { formatCurrency } from "../components/shared/DateFormatter";
import { format } from "date-fns";
import SmartQuoteUpload from "../components/estimate/SmartQuoteUpload";

const DEFAULT_SUBCONTRACTORS = [
  "Demolition Contractor",
  "Concrete Footing",
  "Rough Plumbing",
  "Rough Electrical",
  "Concrete/Foundation",
  "Waterproofing & Damp Proofing",
  "Framing/Shell",
  "Steel Fabricator & Erector",
  "Truss",
  "Roofing",
  "Masonry",
  "Siding",
  "Window & Door",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Insulation",
  "Drywall",
  "Painting",
  "Flooring",
  "Millwork & Trim",
  "Cabinetry & Countertop",
  "Tile",
  "Glass & Mirror",
  "Fireplace",
  "Security & Low-Voltage Wiring Contractor",
  "Lighting & Electrical Fixtures Installer",
  "Deck & Porch",
  "Fence & Gate",
  "Driveway/Walkway",
  "Landscaping",
  "Post-Construction Cleaning"
];

export default function CreateEstimate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const opportunityId = urlParams.get('opportunityId');
  const estimateId = urlParams.get('id');

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showSmartQuoteUpload, setShowSmartQuoteUpload] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    opportunity_id: opportunityId || "",
    project_address: "",
    description: "",
    estimate_date: format(new Date(), 'yyyy-MM-dd'),
    estimate_by: "",
    labor_rate: 65,
    labor_hours: 0, // General labor hours (not in task items)
    administration_rate: 75,
    markup_percent: 20,
    gross_profit_margin_percent: 16.67,
    sales_tax_rate: 7,
    general_production_cost_factor: 1,
    admin_hours_per_8_labor_hours: 0,
    permit_cost: 0,
    permit_notes: "", // Added permit_notes field
    task_line_items: [],
    subcontractor_line_items: DEFAULT_SUBCONTRACTORS.map(name => ({
      name,
      unit_cost: 0,
      sub_cost: 0,
      labor_hours: 0,
      total: 0,
      notes: "" // Added notes field
    })),
    status: "Draft",
    sold_contract_price: 0, // Added for the new input
    notes: "" // General notes for the entire estimate
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const opportunity = opportunities.find(o => o.id === (opportunityId || formData.opportunity_id));

  const { data: existingEstimate } = useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const estimates = await base44.entities.Estimate.list();
      return estimates.find(e => e.id === estimateId);
    },
    enabled: !!estimateId,
  });

  React.useEffect(() => {
    if (user && !formData.estimate_by) {
      setFormData(prev => ({ ...prev, estimate_by: user.email }));
    }
  }, [user]);

  React.useEffect(() => {
    if (opportunity && !formData.name) {
      setFormData(prev => ({
        ...prev,
        name: opportunity.name,
        description: opportunity.description || ""
      }));
    }
  }, [opportunity]);

  React.useEffect(() => {
    if (existingEstimate) {
      // When loading an existing estimate, preserve the opportunity_id from URL if present
      setFormData({
        ...existingEstimate,
        opportunity_id: opportunityId || existingEstimate.opportunity_id || ""
      });
    }
  }, [existingEstimate, opportunityId]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Saving estimate with data:', data);
      let savedEstimate;
      if (estimateId) {
        savedEstimate = await base44.entities.Estimate.update(estimateId, data);
      } else {
        savedEstimate = await base44.entities.Estimate.create(data);
      }
      
      // If linking to a project, update the project's estimate_id
      if (data.project_id) {
        await base44.entities.Project.update(data.project_id, {
          estimate_id: savedEstimate.id
        });
      }
      
      return savedEstimate;
    },
    onSuccess: (estimate) => {
      console.log('Estimate saved successfully:', estimate);
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimates', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      if (formData.project_id) {
        navigate(createPageUrl(`ProjectDetail?id=${formData.project_id}`));
      } else if (opportunityId || formData.opportunity_id) {
        navigate(createPageUrl(`OpportunityDetail?id=${opportunityId || formData.opportunity_id}`));
      } else {
        navigate(createPageUrl('Estimates'));
      }
    },
    onError: (error) => {
      console.error('Failed to save estimate:', error);
      alert(`Failed to save estimate: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Estimate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      if (opportunityId) {
        navigate(createPageUrl(`OpportunityDetail?id=${opportunityId}`));
      } else {
        navigate(createPageUrl('Estimates'));
      }
    },
  });

  const handleDelete = () => {
    if (estimateId) {
      deleteMutation.mutate(estimateId);
    }
  };

  const handleQuoteExtracted = ({ type, data, fileUrl }) => {
    if (type === 'subcontractor') {
      // Find matching subcontractor by trade type or vendor name
      const subIndex = formData.subcontractor_line_items.findIndex(sub =>
        sub.name.toLowerCase().includes(data.trade_type?.toLowerCase() || '') ||
        sub.name.toLowerCase().includes(data.vendor_name?.toLowerCase() || '')
      );

      if (subIndex !== -1) {
        // Update existing subcontractor
        updateSubcontractorLineItem(subIndex, 'sub_cost', data.total_amount || 0);
        if (data.labor_hours) {
          updateSubcontractorLineItem(subIndex, 'labor_hours', data.labor_hours);
        }
        if (data.notes || data.description) {
          updateSubcontractorLineItem(subIndex, 'notes', data.notes || data.description || '');
        }
      } else {
        // Add as new subcontractor line item
        setFormData(prev => ({
          ...prev,
          subcontractor_line_items: [
            ...prev.subcontractor_line_items,
            {
              name: data.vendor_name || data.trade_type || 'New Subcontractor',
              unit_cost: 0,
              sub_cost: data.total_amount || 0,
              labor_hours: data.labor_hours || 0,
              total: data.total_amount || 0,
              notes: data.notes || data.description || ''
            }
          ]
        }));
      }
    } else {
      // Materials quote - add to task line items
      if (data.items && data.items.length > 0) {
        const newItems = data.items.map(item => ({
          description: item.description || 'Material',
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost || 0,
          material_cost: (item.quantity || 1) * (item.unit_cost || 0),
          labor_hours: 0,
          total: (item.quantity || 1) * (item.unit_cost || 0),
          notes: data.vendor_name ? `Quote from ${data.vendor_name}` : ''
        }));

        setFormData(prev => ({
          ...prev,
          task_line_items: [...prev.task_line_items, ...newItems]
        }));
      } else {
        // Add as single line item if no items array
        setFormData(prev => ({
          ...prev,
          task_line_items: [
            ...prev.task_line_items,
            {
              description: `Materials from ${data.vendor_name || 'Vendor'}`,
              quantity: 1,
              unit_cost: data.total || data.subtotal || 0,
              material_cost: data.total || data.subtotal || 0,
              labor_hours: 0,
              total: data.total || data.subtotal || 0,
              notes: data.quote_number ? `Quote #${data.quote_number}` : ''
            }
          ]
        }));
      }
    }

    setShowSmartQuoteUpload(false);
  };

  // Calculate all totals
  const calculations = React.useMemo(() => {
    // Task line items totals - ONLY materials from task items
    const taskMaterialCost = formData.task_line_items.reduce((sum, item) =>
      sum + ((item.quantity || 0) * (item.unit_cost || 0)), 0
    );
    const taskLaborHours = formData.task_line_items.reduce((sum, item) =>
      sum + (item.labor_hours || 0), 0
    );

    // Subcontractor labor hours (if tracked)
    const subLaborHours = formData.subcontractor_line_items.reduce((sum, item) =>
      sum + (item.labor_hours || 0), 0
    );

    // General labor hours (additional labor not tracked in task items)
    const generalLaborHours = formData.labor_hours || 0;

    // Material cost should ONLY include task materials, NOT subcontractor costs
    const totalMaterialCost = taskMaterialCost;
    const totalLaborHours = taskLaborHours + subLaborHours + generalLaborHours;

    // Sales tax on materials
    const salesTaxAmount = totalMaterialCost * (formData.sales_tax_rate / 100);

    // Materials with tax
    const materialsCostPlusTax = totalMaterialCost + salesTaxAmount;

    // Burden/overhead on materials (only the additional burden amount)
    const burdenOverheadCost = materialsCostPlusTax * (formData.general_production_cost_factor - 1);

    // Materials with tax AND burden (for internal calculations)
    const materialsCostWithTaxAndBurden = materialsCostPlusTax + burdenOverheadCost;

    // Calculate admin hours (including general labor hours)
    const totalAdminHours = (totalLaborHours / 8) * formData.admin_hours_per_8_labor_hours;

    // Labor and admin costs
    const laborCost = totalLaborHours * formData.labor_rate;
    const administrationCost = totalAdminHours * formData.administration_rate;

    // Subcontractor cost - separate from materials
    const subcontractorCost = formData.subcontractor_line_items.reduce((sum, item) =>
      sum + (item.total || 0), 0
    );

    // Estimated project cost (sum of all costs before profit/markup)
    const estimatedProjectCost = materialsCostWithTaxAndBurden + laborCost + administrationCost +
                                 formData.permit_cost + subcontractorCost;

    // Estimated profit (using markup percentage)
    const estimatedProfit = estimatedProjectCost * (formData.markup_percent / 100);

    // Estimated selling price
    const estimatedSellingPrice = estimatedProjectCost + estimatedProfit;

    return {
      material_cost: totalMaterialCost,
      sales_tax_amount: salesTaxAmount,
      materials_cost_plus_tax: materialsCostPlusTax,
      materials_cost_with_tax_and_burden: materialsCostWithTaxAndBurden,
      total_labor_hours: totalLaborHours,
      total_admin_hours: totalAdminHours,
      labor_cost: laborCost,
      administration_cost: administrationCost,
      subcontractor_cost: subcontractorCost,
      burden_overhead_cost: burdenOverheadCost,
      estimated_project_cost: estimatedProjectCost,
      estimated_profit: estimatedProfit,
      estimated_selling_price: estimatedSellingPrice
    };
  }, [formData]);

  const handleSave = () => {
    const dataToSave = {
      ...formData,
      ...calculations,
      // Ensure opportunity_id is always included, prioritizing URL param, then existing form data
      opportunity_id: opportunityId || formData.opportunity_id || ""
    };
    console.log('Data being saved:', dataToSave);
    createMutation.mutate(dataToSave);

    // If linking to a project, update the project's estimate_id
    if (formData.project_id && !estimateId) {
      // Will be handled after estimate is created
    }
  };

  const handleExportPDF = () => {
    // Calculate markup factor (1 + markup%)
    const markupFactor = 1 + (formData.markup_percent / 100);
    const salesTaxRateDecimal = formData.sales_tax_rate / 100;
    const generalProductionCostFactor = formData.general_production_cost_factor || 1;

    // Build line items array with FLOATED general labor costs
    const lineItems = [];

    // Calculate the general labor costs that need to be distributed
    const generalLaborHours = formData.labor_hours || 0;
    const generalLaborCost = generalLaborHours * formData.labor_rate;
    const generalAdminHours = (generalLaborHours / 8) * formData.admin_hours_per_8_labor_hours;
    const generalAdminCost = generalAdminHours * formData.administration_rate;
    const totalGeneralLaborAndAdminCostsToFloat = generalLaborCost + generalAdminCost;

    // Calculate total base costs for all items (before markup) to determine distribution
    let totalBaseCostForFloatingDistribution = 0;

    // Calculate base costs for task items
    const taskItemBaseCosts = formData.task_line_items.map(item => {
      const materialCostRaw = (item.quantity || 0) * (item.unit_cost || 0);
      const laborHoursItem = item.labor_hours || 0;

      const materialCostWithTax = materialCostRaw * (1 + salesTaxRateDecimal);
      const materialCostWithTaxAndBurden = materialCostWithTax * generalProductionCostFactor;
      const laborCostItem = laborHoursItem * formData.labor_rate;
      const adminHoursItem = (laborHoursItem / 8) * formData.admin_hours_per_8_labor_hours;
      const adminCostItem = adminHoursItem * formData.administration_rate;

      const baseCost = materialCostWithTaxAndBurden + laborCostItem + adminCostItem;
      totalBaseCostForFloatingDistribution += baseCost;
      return baseCost;
    });

    // Calculate base costs for subcontractor items
    const subItemBaseCosts = formData.subcontractor_line_items.map(sub => {
      const subCostRaw = sub.sub_cost || 0;
      const laborHoursSub = sub.labor_hours || 0;
      const laborCostSub = laborHoursSub * formData.labor_rate;
      const adminHoursSub = (laborHoursSub / 8) * formData.admin_hours_per_8_labor_hours;
      const adminCostSub = adminHoursSub * formData.administration_rate;

      const baseCost = subCostRaw + laborCostSub + adminCostSub;
      totalBaseCostForFloatingDistribution += baseCost;
      return baseCost;
    });

    // Add permits to total base cost
    const permitCostRaw = formData.permit_cost || 0;
    totalBaseCostForFloatingDistribution += permitCostRaw;

    // Task Line Items - with floated general labor
    formData.task_line_items.forEach((item, index) => {
      const baseCost = taskItemBaseCosts[index];

      // Calculate this item's share of general labor costs
      let shareOfFloatedCosts = 0;
      if (totalBaseCostForFloatingDistribution > 0) {
        shareOfFloatedCosts = (baseCost / totalBaseCostForFloatingDistribution) * totalGeneralLaborAndAdminCostsToFloat;
      }

      // Add the share to the base cost, then apply markup
      const costIncludingFloated = baseCost + shareOfFloatedCosts;
      const fullyLoadedPrice = costIncludingFloated * markupFactor;

      if (fullyLoadedPrice > 0) {
        lineItems.push({
          task: item.description || 'Task',
          cost: fullyLoadedPrice,
          notes: item.notes || ''
        });
      }
    });

    // Subcontractor Line Items - with floated general labor
    formData.subcontractor_line_items.forEach((sub, index) => {
      const baseCost = subItemBaseCosts[index];

      // Calculate this item's share of general labor costs
      let shareOfFloatedCosts = 0;
      if (totalBaseCostForFloatingDistribution > 0) {
        shareOfFloatedCosts = (baseCost / totalBaseCostForFloatingDistribution) * totalGeneralLaborAndAdminCostsToFloat;
      }

      // Add the share to the base cost, then apply markup
      const costIncludingFloated = baseCost + shareOfFloatedCosts;
      const fullyLoadedPrice = costIncludingFloated * markupFactor;

      // Include any subcontractor with a cost > 0 (includes sub_cost, labor hours, or floated costs)
      if (fullyLoadedPrice > 0) {
        lineItems.push({
          task: sub.name,
          cost: fullyLoadedPrice,
          notes: sub.notes || 'Licensed subcontractor'
        });
      }
    });

    // Permits - with floated general labor
    if (formData.permit_cost > 0) {
      // Calculate permit's share of general labor costs
      let shareOfFloatedCosts = 0;
      if (totalBaseCostForFloatingDistribution > 0) {
        shareOfFloatedCosts = (permitCostRaw / totalBaseCostForFloatingDistribution) * totalGeneralLaborAndAdminCostsToFloat;
      }

      // Add the share to the permit cost, then apply markup
      const costIncludingFloated = permitCostRaw + shareOfFloatedCosts;
      const permitWithMarkup = costIncludingFloated * markupFactor;

      lineItems.push({
        task: 'Permits & Fees',
        cost: permitWithMarkup,
        notes: formData.permit_notes || 'Required permits and inspections'
      });
    }

    // Generate HTML matching the exact template style
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Estimated Cost Breakdown - ${formData.name}</title>
  <style>
    @page {
      margin: 0.75in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #F5F5F5;
      color: #000000;
      padding: 60px 40px;
      line-height: 1.4;
    }

    h1 {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 30px;
      color: #000000;
      letter-spacing: 0.5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background-color: #FFFFFF;
      margin-bottom: 30px;
      border: 1px solid #000000;
    }

    th {
      background-color: #FFFFFF;
      font-weight: bold;
      text-align: left;
      padding: 14px 16px;
      border: 1px solid #000000;
      font-size: 15px;
      color: #000000;
    }

    td {
      padding: 14px 16px;
      border: 1px solid #000000;
      vertical-align: top;
      font-size: 14px;
      color: #000000;
    }

    tr.total-row {
      font-weight: bold;
    }

    .note {
      font-style: italic;
      color: #000000;
      font-size: 14px;
      margin-top: 10px;
      line-height: 1.5;
    }

    .header-info {
      margin-bottom: 40px;
      padding: 20px;
      background-color: #FFFFFF;
      border: 1px solid #CCCCCC;
      font-size: 14px;
    }

    .header-info p {
      margin: 6px 0;
      color: #000000;
    }

    .header-info strong {
      font-weight: bold;
    }

    @media print {
      body {
        padding: 0;
        background-color: #FFFFFF;
      }
      .no-print {
        display: none;
      }
    }

    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background-color: #0E351F;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: Arial, Helvetica, sans-serif;
    }

    .print-button:hover {
      background-color: #1B4D3E;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>

  <div class="header-info">
    <p><strong>Project:</strong> ${formData.name}</p>
    ${formData.project_address ? `<p><strong>Address:</strong> ${formData.project_address}</p>` : ''}
    <p><strong>Date:</strong> ${format(new Date(formData.estimate_date), 'MMMM d, yyyy')}</p>
    <p><strong>Prepared By:</strong> ${formData.estimate_by}</p>
  </div>

  <h1>Estimated Cost Breakdown</h1>

  <table>
    <thead>
      <tr>
        <th>Task</th>
        <th>Estimated Cost</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map(item => `
        <tr>
          <td>${item.task}</td>
          <td>${formatCurrency(item.cost)}</td>
          <td>${item.notes}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td>Total Estimated Cost</td>
        <td>${formatCurrency(calculations.estimated_selling_price)}</td>
        <td>Subject to contract terms</td>
      </tr>
    </tbody>
  </table>

  <p class="note">
    <strong>Note:</strong> Costs may vary based on final material selections and site conditions.
  </p>

  ${formData.description ? `
    <div style="margin-top: 30px; padding: 20px; background-color: #FFFFFF; border: 1px solid #CCCCCC;">
      <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Additional Notes:</strong></p>
      <p style="margin: 0; font-size: 14px; color: #000000;">${formData.description}</p>
    </div>
  ` : ''}
</body>
</html>
    `;

    // Open in new window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const addTaskLineItem = () => {
    setFormData(prev => ({
      ...prev,
      task_line_items: [...prev.task_line_items, {
        description: "",
        quantity: 0,
        unit_cost: 0,
        material_cost: 0,
        labor_hours: 0,
        total: 0,
        notes: "" // Added notes field
      }]
    }));
  };

  const updateTaskLineItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.task_line_items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Recalculate totals
      if (field === 'quantity' || field === 'unit_cost' || field === 'labor_hours') {
        newItems[index].material_cost = (newItems[index].quantity || 0) * (newItems[index].unit_cost || 0);
        newItems[index].total = newItems[index].material_cost +
                                ((newItems[index].labor_hours || 0) * prev.labor_rate);
      }

      return { ...prev, task_line_items: newItems };
    });
  };

  const removeTaskLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      task_line_items: prev.task_line_items.filter((_, i) => i !== index)
    }));
  };

  const updateSubcontractorLineItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.subcontractor_line_items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Recalculate total
      if (field === 'sub_cost' || field === 'labor_hours') {
        newItems[index].total = (newItems[index].sub_cost || 0) +
                                ((newItems[index].labor_hours || 0) * prev.labor_rate);
      }

      return { ...prev, subcontractor_line_items: newItems };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => opportunityId ? navigate(createPageUrl(`OpportunityDetail?id=${opportunityId}`)) : navigate(createPageUrl('Estimates'))}
            className="bg-white border-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {estimateId ? 'Edit Estimate' : 'Create New Estimate'}
            </h2>
            {opportunity && (
              <p className="text-gray-600 mt-1">For: {opportunity.name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowSmartQuoteUpload(true)}
            variant="outline"
            className="border-[#2A6B5A] text-[#1B4D3E]"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upload Quote
          </Button>
          {estimateId && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="border-gray-300 text-gray-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Estimate
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#0E351F] hover:bg-[#14503C] text-white"
            disabled={createMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {createMutation.isPending ? 'Saving...' : estimateId ? 'Update Estimate' : 'Save Estimate'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Project Info & Configuration */}
        <div className="space-y-6">
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Project Address</Label>
                <Input
                  value={formData.project_address}
                  onChange={(e) => setFormData({...formData, project_address: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="bg-white border-gray-300"
                  rows={3}
                />
              </div>

              <div>
                <Label>Estimate Date</Label>
                <Input
                  type="date"
                  value={formData.estimate_date}
                  onChange={(e) => setFormData({...formData, estimate_date: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Estimate By</Label>
                <Input
                  value={formData.estimate_by}
                  onChange={(e) => setFormData({...formData, estimate_by: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Awarded">Awarded</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Link to Opportunity or Project */}
              {!opportunityId && (
                <div className="pt-4 border-t border-gray-300">
                  <Label className="text-base font-semibold">Link to Record</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Optionally link this estimate to an opportunity or project
                  </p>

                  <div className="space-y-3">
                    <div>
                      <Label>Opportunity</Label>
                      <Select
                        value={formData.opportunity_id || "none"}
                        onValueChange={(value) => setFormData({
                          ...formData, 
                          opportunity_id: value === "none" ? "" : value,
                          project_id: value === "none" ? formData.project_id : "" // Clear project if opportunity selected
                        })}
                      >
                        <SelectTrigger className="bg-white border-gray-300">
                          <SelectValue placeholder="Select opportunity" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-300 max-h-60">
                          <SelectItem value="none">None</SelectItem>
                          {opportunities
                            .filter(o => o.stage !== 'Under Contract' && o.stage !== 'Lost')
                            .map(opp => (
                              <SelectItem key={opp.id} value={opp.id}>
                                {opp.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Project</Label>
                      <Select
                        value={formData.project_id || "none"}
                        onValueChange={(value) => setFormData({
                          ...formData, 
                          project_id: value === "none" ? "" : value,
                          opportunity_id: value === "none" ? formData.opportunity_id : "" // Clear opportunity if project selected
                        })}
                      >
                        <SelectTrigger className="bg-white border-gray-300">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-300 max-h-60">
                          <SelectItem value="none">None</SelectItem>
                          {projects.map(proj => (
                            <SelectItem key={proj.id} value={proj.id}>
                              {proj.number ? `${proj.number} - ` : ''}{proj.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Linking to a project sets it as the baseline estimate
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Estimate Notes</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="bg-white border-gray-300"
                  rows={4}
                  placeholder="Add any notes or assumptions for this estimate..."
                />
                <p className="text-xs text-gray-600 mt-1">
                  General notes about this estimate (internal use)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Labor Rate ($/hour)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.labor_rate ?? 0}
                  onChange={(e) => setFormData({...formData, labor_rate: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Labor Hours</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.labor_hours ?? 0}
                  onChange={(e) => setFormData({...formData, labor_hours: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                  placeholder="0"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Additional labor hours not tracked in task line items (e.g., permits, project management, supervision)
                </p>
              </div>

              <div>
                <Label>Administration Rate ($/hour)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.administration_rate ?? 0}
                  onChange={(e) => setFormData({...formData, administration_rate: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Markup (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.markup_percent ?? 0}
                  onChange={(e) => setFormData({...formData, markup_percent: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Sales Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sales_tax_rate ?? 0}
                  onChange={(e) => setFormData({...formData, sales_tax_rate: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>General Production Cost Factor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.general_production_cost_factor ?? 1}
                  onChange={(e) => setFormData({...formData, general_production_cost_factor: e.target.value === '' ? 1 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
                <p className="text-xs text-gray-600 mt-1">Typically 1.0 for no additional burden</p>
              </div>

              <div>
                <Label>Admin Hours per 8 Labor Hours</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.admin_hours_per_8_labor_hours ?? 0}
                  onChange={(e) => setFormData({...formData, admin_hours_per_8_labor_hours: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
                <div className="text-xs text-gray-600 mt-2 space-y-1">
                  <p><strong>How it works:</strong> For every 8 hours of labor, add this many admin/PM hours.</p>
                  <p><strong>Example:</strong> If you have 40 labor hours and set this to 1.0:</p>
                  <p className="ml-2">→ (40 ÷ 8) × 1.0 = 5 admin hours</p>
                  <p className="ml-2">→ 5 × ${formData.administration_rate}/hr = {formatCurrency(5 * formData.administration_rate)} admin cost</p>
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p><strong>Current calculation:</strong></p>
                    <p className="ml-2">→ {calculations.total_labor_hours.toFixed(1)} labor hours ÷ 8 = {(calculations.total_labor_hours / 8).toFixed(2)} periods</p>
                    <p className="ml-2">→ {(calculations.total_labor_hours / 8).toFixed(2)} × {formData.admin_hours_per_8_labor_hours} = {calculations.total_admin_hours.toFixed(2)} admin hours</p>
                    <p className="ml-2 font-semibold">→ Total Admin Cost: {formatCurrency(calculations.administration_cost)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-300">
                <Label className="text-base font-semibold">Permits & Fees</Label>
                <div className="space-y-3 mt-3">
                  <div>
                    <Label>Permit Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.permit_cost ?? 0}
                      onChange={(e) => setFormData({...formData, permit_cost: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      className="bg-white border-gray-300"
                    />
                  </div>

                  <div>
                    <Label>Permit Notes (for export)</Label>
                    <Input
                      value={formData.permit_notes}
                      onChange={(e) => setFormData({...formData, permit_notes: e.target.value})}
                      className="bg-white border-gray-300"
                      placeholder="e.g., Required permits and inspections"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Task Line Items & Subcontractors */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <Card className="bg-[#0E351F] border-gray-200 text-white">
            <CardHeader className="border-b border-gray-600">
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-300">Material Cost (Raw)</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.material_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Sales Tax (on materials)</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.sales_tax_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Material Cost (w/ tax)</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.materials_cost_plus_tax)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Burden/Overhead</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.burden_overhead_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Labor Cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.labor_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Administration Cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.administration_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Subcontractor Cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculations.subcontractor_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Permit Cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(formData.permit_cost)}</p>
                </div>
                <div className="col-span-2 border-t border-gray-600 pt-3">
                  <p className="text-gray-300">Estimated Project Cost</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculations.estimated_project_cost)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Estimated Profit</p>
                  <p className="text-xl font-bold text-green-400">{formatCurrency(calculations.estimated_profit)}</p>
                </div>
                <div>
                  <p className="text-gray-300">Estimated Selling Price</p>
                  <p className="text-xl font-bold text-green-400">{formatCurrency(calculations.estimated_selling_price)}</p>
                </div>
                <div className="col-span-2 pt-2">
                  <Label className="text-white">Sold Contract Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sold_contract_price || ''}
                    onChange={(e) => setFormData({...formData, sold_contract_price: parseFloat(e.target.value) || 0})}
                    className="bg-white border-gray-600 text-gray-900 mt-1"
                    placeholder="Enter if project is awarded"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Line Items */}
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Task / Materials Line Items</CardTitle>
                  <p className="text-xs text-gray-600 mt-1">Add tasks with materials AND labor hours for work your company will perform</p>
                </div>
                <Button
                  onClick={addTaskLineItem}
                  size="sm"
                  className="bg-[#0E351F] hover:bg-[#14503C] text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left p-2 text-gray-700">Description</th>
                      <th className="text-right p-2 text-gray-700">Qty</th>
                      <th className="text-right p-2 text-gray-700">Unit Cost</th>
                      <th className="text-right p-2 text-gray-700">Material Cost</th>
                      <th className="text-right p-2 text-gray-700">
                        <div>Labor Hrs</div>
                        <div className="text-xs font-normal text-gray-600">Enter hours here</div>
                      </th>
                      <th className="text-right p-2 text-gray-700">Total</th>
                      <th className="text-left p-2 text-gray-700">Notes</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.task_line_items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="p-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateTaskLineItem(index, 'description', e.target.value)}
                            className="bg-white border-gray-300 text-sm"
                            placeholder="Task description"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateTaskLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateTaskLineItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-24"
                          />
                        </td>
                        <td className="p-2 text-right text-gray-900">
                          {formatCurrency(item.material_cost || 0)}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.labor_hours}
                            onChange={(e) => updateTaskLineItem(index, 'labor_hours', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2 text-right text-gray-900 font-semibold">
                          {formatCurrency(item.total || 0)}
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.notes || ''}
                            onChange={(e) => updateTaskLineItem(index, 'notes', e.target.value)}
                            className="bg-white border-gray-300 text-sm"
                            placeholder="Notes for export"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTaskLineItem(index)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {formData.task_line_items.length === 0 && (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-gray-600">
                          No items yet. Click "Add Item" or "Upload Quote" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-400 font-semibold">
                      <td className="p-2 text-right" colSpan="4">Totals:</td>
                      <td className="p-2 text-right">{formData.task_line_items.reduce((sum, item) => sum + (item.labor_hours || 0), 0).toFixed(1)} hrs</td>
                      <td className="p-2 text-right">{formatCurrency(formData.task_line_items.reduce((sum, item) => sum + (item.total || 0), 0))}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Subcontractors */}
          <Card className="bg-[#F5F4F3] border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <div>
                <CardTitle>Subcontractors</CardTitle>
                <p className="text-xs text-gray-600 mt-1">Track subcontractor costs and their labor hours (optional)</p>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left p-2 text-gray-700">Subcontractor</th>
                      <th className="text-right p-2 text-gray-700">Unit Cost</th>
                      <th className="text-right p-2 text-gray-700">Sub Cost</th>
                      <th className="text-right p-2 text-gray-700">
                        <div>Labor Hrs</div>
                        <div className="text-xs font-normal text-gray-600">(Optional)</div>
                      </th>
                      <th className="text-right p-2 text-gray-700">Total</th>
                      <th className="text-left p-2 text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.subcontractor_line_items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="p-2 text-gray-900">{item.name}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateSubcontractorLineItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.sub_cost}
                            onChange={(e) => updateSubcontractorLineItem(index, 'sub_cost', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-24"
                            placeholder="Enter $ amount"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.labor_hours}
                            onChange={(e) => updateSubcontractorLineItem(index, 'labor_hours', parseFloat(e.target.value) || 0)}
                            className="bg-white border-gray-300 text-sm text-right w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2 text-right text-gray-900 font-semibold">
                          {formatCurrency(item.total || 0)}
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.notes || ''}
                            onChange={(e) => updateSubcontractorLineItem(index, 'notes', e.target.value)}
                            className="bg-white border-gray-300 text-sm"
                            placeholder="Notes for export"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-400 font-semibold">
                      <td className="p-2 text-right" colSpan="3">Totals:</td>
                      <td className="p-2 text-right">{formData.subcontractor_line_items.reduce((sum, item) => sum + (item.labor_hours || 0), 0).toFixed(1)} hrs</td>
                      <td className="p-2 text-right">{formatCurrency(formData.subcontractor_line_items.reduce((sum, item) => sum + (item.total || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Smart Quote Upload Modal */}
      <Dialog open={showSmartQuoteUpload} onOpenChange={setShowSmartQuoteUpload}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2A6B5A]" />
              Smart Quote Upload
            </DialogTitle>
          </DialogHeader>
          <SmartQuoteUpload
            opportunityId={opportunityId}
            estimateId={estimateId}
            onQuoteExtracted={handleQuoteExtracted}
            onCancel={() => setShowSmartQuoteUpload(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete this estimate?
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Estimate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}