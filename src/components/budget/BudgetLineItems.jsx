import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  Upload,
  Loader2
} from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";

const BUDGET_CATEGORIES = [
  "Labor - Field",
  "Labor - Supervision", 
  "Labor - Project Management",
  "Materials",
  "Subcontractors",
  "Equipment Rental",
  "Permits & Fees",
  "Insurance",
  "Utilities",
  "Waste Disposal",
  "Professional Services",
  "Contingency",
  "Other"
];

export default function BudgetLineItems({ projectId, estimate, onTotalsChange }) {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [formData, setFormData] = React.useState({
    category: "",
    description: "",
    budgeted_amount: 0,
    revised_amount: 0,
    notes: ""
  });
  const [importing, setImporting] = React.useState(false);
  
  const queryClient = useQueryClient();

  const { data: lineItems = [], isLoading } = useQuery({
    queryKey: ['budgetLineItems', projectId],
    queryFn: () => base44.entities.BudgetLineItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', projectId],
    queryFn: () => base44.entities.Bill.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BudgetLineItem.create({
      ...data,
      project_id: projectId,
      revised_amount: data.revised_amount || data.budgeted_amount
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', projectId] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BudgetLineItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', projectId] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BudgetLineItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', projectId] });
    },
  });

  const resetForm = () => {
    setFormData({ category: "", description: "", budgeted_amount: 0, revised_amount: 0, notes: "" });
    setEditingItem(null);
    setShowAddModal(false);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      description: item.description,
      budgeted_amount: item.budgeted_amount || 0,
      revised_amount: item.revised_amount || item.budgeted_amount || 0,
      notes: item.notes || ""
    });
    setShowAddModal(true);
  };

  const importFromEstimate = async () => {
    if (!estimate) return;
    setImporting(true);

    try {
      const itemsToCreate = [];

      // Import labor
      if (estimate.labor_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Labor - Field",
          description: "Labor from estimate",
          budgeted_amount: estimate.labor_cost,
          revised_amount: estimate.labor_cost,
          is_from_estimate: true
        });
      }

      // Import admin/PM
      if (estimate.administration_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Labor - Project Management",
          description: "Administration from estimate",
          budgeted_amount: estimate.administration_cost,
          revised_amount: estimate.administration_cost,
          is_from_estimate: true
        });
      }

      // Import materials
      if (estimate.material_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Materials",
          description: "Materials from estimate",
          budgeted_amount: estimate.materials_cost_plus_tax || estimate.material_cost,
          revised_amount: estimate.materials_cost_plus_tax || estimate.material_cost,
          is_from_estimate: true
        });
      }

      // Import subcontractors
      if (estimate.subcontractor_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Subcontractors",
          description: "Subcontractors from estimate",
          budgeted_amount: estimate.subcontractor_cost,
          revised_amount: estimate.subcontractor_cost,
          is_from_estimate: true
        });
      }

      // Import permits
      if (estimate.permit_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Permits & Fees",
          description: "Permits from estimate",
          budgeted_amount: estimate.permit_cost,
          revised_amount: estimate.permit_cost,
          is_from_estimate: true
        });
      }

      // Import overhead/burden
      if (estimate.burden_overhead_cost > 0) {
        itemsToCreate.push({
          project_id: projectId,
          category: "Other",
          description: "Overhead/Burden from estimate",
          budgeted_amount: estimate.burden_overhead_cost,
          revised_amount: estimate.burden_overhead_cost,
          is_from_estimate: true
        });
      }

      // Create all items
      for (const item of itemsToCreate) {
        await base44.entities.BudgetLineItem.create(item);
      }

      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', projectId] });
    } catch (error) {
      console.error('Import error:', error);
    }
    setImporting(false);
  };

  // Calculate actuals from bills by category
  const getActualsByCategory = React.useMemo(() => {
    const categoryMap = {
      "Labor - Field": 0,
      "Labor - Supervision": 0,
      "Labor - Project Management": 0,
      "Materials": 0,
      "Subcontractors": 0,
      "Equipment Rental": 0,
      "Permits & Fees": 0,
      "Insurance": 0,
      "Utilities": 0,
      "Waste Disposal": 0,
      "Professional Services": 0,
      "Contingency": 0,
      "Other": 0
    };

    bills.forEach(bill => {
      if (bill.status === 'Paid' || bill.status === 'Approved') {
        const amount = bill.amount || 0;
        switch (bill.category) {
          case 'Labor - Field':
            categoryMap["Labor - Field"] += amount;
            break;
          case 'Labor - Site Supervision':
            categoryMap["Labor - Supervision"] += amount;
            break;
          case 'Project Management':
            categoryMap["Labor - Project Management"] += amount;
            break;
          case 'Materials':
            categoryMap["Materials"] += amount;
            break;
          case 'Subcontractor':
            categoryMap["Subcontractors"] += amount;
            break;
          case 'Equipment Rental':
            categoryMap["Equipment Rental"] += amount;
            break;
          case 'Permits & Inspections':
            categoryMap["Permits & Fees"] += amount;
            break;
          case 'Job-Specific Insurance':
            categoryMap["Insurance"] += amount;
            break;
          case 'Site Utilities':
            categoryMap["Utilities"] += amount;
            break;
          case 'Waste Disposal':
            categoryMap["Waste Disposal"] += amount;
            break;
          case 'Professional Services':
            categoryMap["Professional Services"] += amount;
            break;
          default:
            categoryMap["Other"] += amount;
        }
      }
    });

    return categoryMap;
  }, [bills]);

  // Enhance line items with actuals
  const enhancedLineItems = React.useMemo(() => {
    return lineItems.map(item => {
      const actual = getActualsByCategory[item.category] || 0;
      const revised = item.revised_amount || item.budgeted_amount || 0;
      const variance = revised - actual;
      const variancePercent = revised > 0 ? ((variance / revised) * 100) : 0;
      
      return {
        ...item,
        actual_amount: actual,
        variance,
        variance_percent: variancePercent
      };
    });
  }, [lineItems, getActualsByCategory]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const result = {
      budgeted: enhancedLineItems.reduce((sum, i) => sum + (i.budgeted_amount || 0), 0),
      revised: enhancedLineItems.reduce((sum, i) => sum + (i.revised_amount || i.budgeted_amount || 0), 0),
      actual: enhancedLineItems.reduce((sum, i) => sum + (i.actual_amount || 0), 0),
      variance: 0
    };
    result.variance = result.revised - result.actual;
    return result;
  }, [enhancedLineItems]);

  React.useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(totals);
    }
  }, [totals, onTotalsChange]);

  const getVarianceColor = (variance) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVarianceBadge = (variance, percent) => {
    if (variance > 0) {
      return <Badge className="bg-green-100 text-green-800">Under by {Math.abs(percent).toFixed(1)}%</Badge>;
    }
    if (variance < 0) {
      return <Badge className="bg-red-100 text-red-800">Over by {Math.abs(percent).toFixed(1)}%</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">On Budget</Badge>;
  };

  const exportCSV = () => {
    const csv = [
      ['Category', 'Description', 'Original Budget', 'Revised Budget', 'Actual', 'Variance', 'Variance %', 'Notes'],
      ...enhancedLineItems.map(item => [
        item.category,
        item.description,
        item.budgeted_amount || 0,
        item.revised_amount || item.budgeted_amount || 0,
        item.actual_amount || 0,
        item.variance || 0,
        (item.variance_percent || 0).toFixed(2) + '%',
        item.notes || ''
      ]),
      ['TOTALS', '', totals.budgeted, totals.revised, totals.actual, totals.variance, '', '']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_line_items.csv';
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 mb-1">Original Budget</p>
            <p className="text-xl font-bold text-blue-900">{formatCurrency(totals.budgeted)}</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-700 mb-1">Revised Budget</p>
            <p className="text-xl font-bold text-indigo-900">{formatCurrency(totals.revised)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-700 mb-1">Actual Spent</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.actual)}</p>
          </CardContent>
        </Card>
        <Card className={totals.variance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="p-4">
            <p className={`text-xs mb-1 ${totals.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Variance
            </p>
            <p className={`text-xl font-bold ${totals.variance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {formatCurrency(totals.variance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-[#0E351F] hover:bg-[#14503C] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Line Item
        </Button>
        {estimate && lineItems.length === 0 && (
          <Button
            onClick={importFromEstimate}
            disabled={importing}
            variant="outline"
            className="border-blue-300 text-blue-700"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import from Estimate
          </Button>
        )}
        <Button
          onClick={exportCSV}
          variant="outline"
          className="border-gray-300"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Line Items Table */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Budget Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enhancedLineItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No budget line items yet.</p>
              <p className="text-sm mt-1">Add line items or import from your estimate.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Category</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Original</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Revised</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Actual</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Variance</th>
                    <th className="text-center p-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-center p-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enhancedLineItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-gray-900">{item.description}</td>
                      <td className="p-3 text-sm text-right text-gray-600">
                        {formatCurrency(item.budgeted_amount || 0)}
                      </td>
                      <td className="p-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(item.revised_amount || item.budgeted_amount || 0)}
                      </td>
                      <td className="p-3 text-sm text-right text-gray-900">
                        {formatCurrency(item.actual_amount || 0)}
                      </td>
                      <td className={`p-3 text-sm text-right font-medium ${getVarianceColor(item.variance)}`}>
                        {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance || 0)}
                      </td>
                      <td className="p-3 text-center">
                        {getVarianceBadge(item.variance, item.variance_percent)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr className="font-semibold">
                    <td colSpan={2} className="p-3 text-sm">TOTALS</td>
                    <td className="p-3 text-sm text-right">{formatCurrency(totals.budgeted)}</td>
                    <td className="p-3 text-sm text-right">{formatCurrency(totals.revised)}</td>
                    <td className="p-3 text-sm text-right">{formatCurrency(totals.actual)}</td>
                    <td className={`p-3 text-sm text-right ${getVarianceColor(totals.variance)}`}>
                      {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-white border-gray-200 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Budget Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Line item description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Original Budget</Label>
                <Input
                  type="number"
                  value={formData.budgeted_amount}
                  onChange={(e) => setFormData({ ...formData, budgeted_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Revised Budget</Label>
                <Input
                  type="number"
                  value={formData.revised_amount || formData.budgeted_amount}
                  onChange={(e) => setFormData({ ...formData, revised_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.category || !formData.description || createMutation.isPending || updateMutation.isPending}
              className="bg-[#0E351F] hover:bg-[#14503C] text-white"
            >
              {editingItem ? 'Update' : 'Add'} Line Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}