import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DataTable from "../components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";

const CATEGORIES = [
  "Salaries & Wages",
  "Professional Services",
  "Office Rent",
  "Utilities",
  "Insurance",
  "Marketing",
  "Software & Technology",
  "Depreciation",
  "Interest",
  "Taxes",
  "Other"
];

export default function OperatingExpenses() {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    date: formatDate(new Date(), 'yyyy-MM-dd'),
    recurring: false
  });
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['operatingExpenses'],
    queryFn: () => base44.entities.OperatingExpense.list('-date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OperatingExpense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      setShowCreateModal(false);
      setFormData({ date: formatDate(new Date(), 'yyyy-MM-dd'), recurring: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OperatingExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDeleteClick = (e, expense) => {
    e.stopPropagation();
    if (confirm(`Delete expense: ${expense.description}?`)) {
      deleteMutation.mutate(expense.id);
    }
  };

  const columns = [
    {
      header: "Date",
      accessorKey: "date",
      cell: (row) => formatDate(row.date),
      sortable: true,
    },
    {
      header: "Category",
      accessorKey: "category",
      sortable: true,
    },
    {
      header: "Vendor",
      accessorKey: "vendor",
      sortable: true,
    },
    {
      header: "Description",
      accessorKey: "description",
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
      sortable: true,
    },
    {
      header: "Recurring",
      accessorKey: "recurring",
      cell: (row) => row.recurring ? (
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
          {row.recurring_frequency}
        </span>
      ) : '-',
    },
    {
      header: "Actions",
      sortable: false,
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => handleDeleteClick(e, row)}
          className="text-gray-600 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )
    }
  ];

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operating Expenses</h2>
          <p className="text-gray-600 mt-1">Track overhead and administrative costs</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Total Operating Expenses</p>
        <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        isLoading={isLoading}
        onCreateNew={() => setShowCreateModal(true)}
        emptyMessage="No operating expenses yet. Create your first one."
        searchPlaceholder="Search expenses..."
        additionalFilters={[
          {
            field: 'category',
            label: 'Category',
            options: CATEGORIES.map(c => ({ value: c, label: c }))
          }
        ]}
      />

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Operating Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date <span className="text-red-600">*</span></Label>
                <Input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Amount <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Category <span className="text-red-600">*</span></Label>
              <Select
                required
                value={formData.category || ''}
                onValueChange={(value) => setFormData({...formData, category: value})}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor</Label>
                <Input
                  value={formData.vendor || ''}
                  onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method || ''}
                  onValueChange={(value) => setFormData({...formData, payment_method: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="Wire">Wire</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300"
              />
            </div>

            <div>
              <Label>Reference Number</Label>
              <Input
                value={formData.reference_number || ''}
                onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                className="bg-white border-gray-300"
                placeholder="Check #, Transaction ID, etc."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={formData.recurring || false}
                onCheckedChange={(checked) => setFormData({...formData, recurring: checked})}
              />
              <label htmlFor="recurring" className="text-sm font-medium">
                Recurring Expense
              </label>
            </div>

            {formData.recurring && (
              <div>
                <Label>Frequency</Label>
                <Select
                  value={formData.recurring_frequency || ''}
                  onValueChange={(value) => setFormData({...formData, recurring_frequency: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-gray-300"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ date: formatDate(new Date(), 'yyyy-MM-dd'), recurring: false });
                }}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}