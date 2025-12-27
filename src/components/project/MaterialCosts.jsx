import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  X,
  Edit,
  Image as ImageIcon,
  Filter,
  AlertCircle,
  CreditCard,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import DocumentViewer from "../shared/DocumentViewer";
import { recalculateProjectBudget } from "../shared/BudgetRecalculation";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const CATEGORIES = ["Material", "Labor", "Tool", "Fuel", "Equipment Rental", "Dump Fee", "Permit", "Administration", "Misc"];

const CATEGORY_COLORS = {
  "Material": "#0E351F",        // Darkest Green - Primary material
  "Labor": "#3B5B48",           // Dark Green
  "Tool": "#5A7765",            // Mid Green
  "Fuel": "#C9C8AF",            // Light Olive
  "Equipment Rental": "#9FA097", // Gray
  "Dump Fee": "#5A7765",        // Mid Green (reuse)
  "Permit": "#181E18",          // Darkest Gray
  "Administration": "#3B5B48",   // Dark Green (reuse)
  "Misc": "#9FA097"             // Gray (reuse)
};

export default function MaterialCosts({ projectId, project }) {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showStatementModal, setShowStatementModal] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [editData, setEditData] = React.useState({});
  const [uploadingReceipt, setUploadingReceipt] = React.useState(null);
  const [filterCategory, setFilterCategory] = React.useState('all');
  const [filterApproved, setFilterApproved] = React.useState('all');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });
  const [extractingStatement, setExtractingStatement] = React.useState(false);
  const [extractedTransactions, setExtractedTransactions] = React.useState([]);
  const [expandedTransaction, setExpandedTransaction] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const [newCost, setNewCost] = React.useState({
    date: formatDate(new Date(), 'yyyy-MM-dd'),
    transaction: '',
    amount: '',
    item: 'Material',
    description: '',
    notes: '',
    approved: currentUser?.role === 'admin' // Initialize based on user role, defaults to false if currentUser is not loaded yet or not admin
  });

  const { data: materialCosts = [], isLoading } = useQuery({
    queryKey: ['materialCosts', projectId],
    queryFn: () => base44.entities.MaterialCost.filter({ project_id: projectId }, '-date'),
    enabled: !!projectId,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  // Add data quality check for bills without project_id
  const { data: allBills = [] } = useQuery({
    queryKey: ['allBills'],
    queryFn: () => base44.entities.Bill.list(),
  });

  // Fetch all material costs (not just for the current project) to check for unlinked ones
  const { data: allMaterialCosts = [] } = useQuery({
    queryKey: ['allMaterialCosts'],
    queryFn: () => base44.entities.MaterialCost.list(),
  });

  const cogsCategories = [
    'Labor - Field',
    'Labor - Site Supervision',
    'Materials',
    'Subcontractor',
    'Equipment Rental',
    'Permits & Inspections',
    'Waste Disposal',
    'Site Utilities',
    'Job-Specific Insurance',
    'Project Management'
  ];

  const billsWithoutProject = allBills.filter(b =>
    !b.project_id && b.category && cogsCategories.includes(b.category)
  );

  const materialCostsWithoutProject = allMaterialCosts.filter(m => !m.project_id);

  const approveMutation = useMutation({
    mutationFn: async (costId) => {
      await base44.entities.MaterialCost.update(costId, { approved: true });
      await recalculateProjectBudget(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const cost = await base44.entities.MaterialCost.create({
        ...data,
        project_id: projectId,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
        entered_by: currentUser?.email || '',
        approved: data.approved || false
      });
      // Recalculate budget if approved immediately
      if (data.approved) {
        await recalculateProjectBudget(projectId);
      }
      return cost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] }); // Invalidate if budget was recalculated
      setShowAddModal(false); // Changed from setShowCreateModal
      setNewCost({ // Changed from setFormData
        date: formatDate(new Date(), 'yyyy-MM-dd'), // Set default date
        transaction: '',
        amount: '',
        item: 'Material',
        description: '',
        notes: '',
        approved: currentUser?.role === 'admin'
      });
    },
    onError: (error) => {
      console.error('Error creating material cost:', error);
      alert('Failed to add cost. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const cost = await base44.entities.MaterialCost.update(id, data);
      await recalculateProjectBudget(projectId);
      return cost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingId(null);
      setEditData({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (costId) => {
      await base44.entities.MaterialCost.delete(costId);
      await recalculateProjectBudget(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const handleStartEdit = (cost) => {
    setEditingId(cost.id);
    setEditData({
      date: cost.date,
      transaction: cost.transaction,
      amount: cost.amount,
      item: cost.item,
      description: cost.description,
      notes: cost.notes
    });
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({ id: editingId, data: editData });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleToggleApprove = (cost) => {
    if (currentUser?.role === 'admin') {
      if (!cost.approved) { // If currently unapproved, approve it using approveMutation
        approveMutation.mutate(cost.id);
      } else { // If currently approved, disapprove it using updateMutation
        updateMutation.mutate({
          id: cost.id,
          data: { approved: false }
        });
      }
    }
  };

  const handleReceiptUpload = async (e, costId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingReceipt(costId);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateMutation.mutateAsync({
        id: costId,
        data: { receipt_image: file_url }
      });
    } catch (error) {
      console.error('Receipt upload error:', error);
    }
    setUploadingReceipt(null);
  };

  const handleExportCSV = () => {
    const csv = [
      ['Date', 'Transaction', 'Amount', 'Category', 'Description', 'Notes', 'Entered By', 'Approved'],
      ...filteredCosts.map(cost => [
        cost.date,
        cost.transaction,
        cost.amount,
        cost.item,
        cost.description || '',
        cost.notes || '',
        cost.entered_by,
        cost.approved ? 'Yes' : 'No'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.number}_material_costs_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').slice(1);
    
    const costsToCreate = lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma outside quotes
        const [date, transaction, amount, item, description, notes] = parts.map(cell => 
          cell.replace(/^"|"$/g, '').trim()
        );
        
        return {
          project_id: projectId,
          date,
          transaction,
          amount: parseFloat(amount) || 0,
          item: CATEGORIES.includes(item) ? item : 'Misc',
          description,
          notes,
          entered_by: currentUser?.email || '',
          approved: currentUser?.role === 'admin' // If imported by admin, assume approved. Otherwise, needs separate approval.
        };
      });

    await base44.entities.MaterialCost.bulkCreate(costsToCreate);
    // Budget recalculation happens upon approval of each item, or if the imported items are already marked approved.
    // If they are pending, they will trigger recalculation when individually approved.
    queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] }); // Invalidate projects to update overall budget
  };

  const handleStatementUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExtractingStatement(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { 
                type: "string",
                description: "Transaction date in YYYY-MM-DD format"
              },
              transaction: { 
                type: "string",
                description: "Merchant or vendor name"
              },
              amount: { 
                type: "number",
                description: "Transaction amount (positive number, no currency symbols)"
              },
              item: { 
                type: "string",
                description: "Category: Material, Labor, Tool, Fuel, Equipment Rental, Dump Fee, Permit, Administration, or Misc",
                enum: ["Material", "Labor", "Tool", "Fuel", "Equipment Rental", "Dump Fee", "Permit", "Administration", "Misc"]
              },
              description: { 
                type: "string",
                description: "Transaction description or memo"
              }
            },
            required: ["date", "transaction", "amount", "item"]
          }
        }
      });

      if (result.status === 'error') {
        alert(`Failed to extract data: ${result.details || 'Unknown error'}. Please try again.`);
        setExtractingStatement(false);
        e.target.value = '';
        return;
      }

      const transactions = result.output || [];
      if (transactions.length === 0) {
        alert('No transactions found in the statement. Please ensure the file contains transaction data and try again.');
        setExtractingStatement(false);
        e.target.value = '';
        return;
      }

      setExtractedTransactions(transactions.map((t, index) => ({
        ...t,
        tempId: `temp-${index}`,
        project_id: projectId,
        approved: false,
        notes: t.notes || t.description || ''
      })));
      setShowStatementModal(true);
    } catch (error) {
      console.error('Statement extraction error:', error);
      alert(`Failed to extract transactions: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setExtractingStatement(false);
      e.target.value = '';
    }
  };

  const handleUpdateExtractedTransaction = (tempId, field, value) => {
    setExtractedTransactions(prev =>
      prev.map(t => t.tempId === tempId ? { ...t, [field]: value } : t)
    );
  };

  const handleRemoveExtractedTransaction = (tempId) => {
    setExtractedTransactions(prev => prev.filter(t => t.tempId !== tempId));
  };

  const handleImportExtractedTransactions = async () => {
    const costsToCreate = extractedTransactions.map(t => ({
      project_id: t.project_id,
      date: new Date(t.date).toISOString(),
      transaction: t.transaction,
      amount: parseFloat(t.amount) || 0,
      item: t.item,
      description: t.description || '',
      notes: t.notes || '',
      entered_by: currentUser?.email || '',
      approved: t.approved || false
    }));

    await base44.entities.MaterialCost.bulkCreate(costsToCreate);
    queryClient.invalidateQueries({ queryKey: ['materialCosts', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    setShowStatementModal(false);
    setExtractedTransactions([]);
  };

  // Apply filters
  const filteredCosts = materialCosts.filter(cost => {
    if (filterCategory !== 'all' && cost.item !== filterCategory) return false;
    if (filterApproved === 'approved' && !cost.approved) return false;
    if (filterApproved === 'pending' && cost.approved) return false;
    if (dateRange.start && cost.date < dateRange.start) return false;
    if (dateRange.end && cost.date > dateRange.end) return false;
    return true;
  });

  const totalApproved = filteredCosts.filter(c => c.approved).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalPending = filteredCosts.filter(c => !c.approved).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalAll = filteredCosts.reduce((sum, c) => sum + (c.amount || 0), 0);

  // Calculate category breakdown for pie chart
  const totalMaterialCosts = materialCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const categoryBreakdown = CATEGORIES.map(category => {
    const categoryTotal = materialCosts
      .filter(cost => cost.item === category)
      .reduce((sum, cost) => sum + (cost.amount || 0), 0);
    
    return {
      name: category,
      value: categoryTotal,
      percentage: totalMaterialCosts > 0 ? ((categoryTotal / totalMaterialCosts) * 100).toFixed(1) : 0
    };
  }).filter(item => item.value > 0); // Only show categories with actual costs

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg" style={{ borderColor: '#C9C8AF' }}>
          <p className="font-semibold" style={{ color: '#181E18' }}>{payload[0].name}</p>
          <p className="text-sm" style={{ color: '#5A7765' }}>{formatCurrency(payload[0].value)}</p>
          <p className="text-xs" style={{ color: '#9FA097' }}>{payload[0].payload.percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Data Quality Warning */}
      {(billsWithoutProject.length > 0 || materialCostsWithoutProject.length > 0) && (
        <Card className="bg-orange-50 border-orange-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900 mb-1">⚠️ Data Quality Issue - COGS Not Tracked</p>
                <p className="text-sm text-orange-800 mb-2">
                  {billsWithoutProject.length > 0 && (
                    <span>{billsWithoutProject.length} bill(s) in COGS categories are not linked to a project. </span>
                  )}
                  {materialCostsWithoutProject.length > 0 && (
                    <span>{materialCostsWithoutProject.length} material cost(s) are not linked to a project. </span>
                  )}
                  These costs are excluded from COGS calculations and P&L reporting.
                </p>
                <p className="text-xs text-orange-700">
                  <strong>Action Required:</strong> Go to Bills/Invoices page and link all COGS-related bills to their respective projects for accurate financial reporting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setShowAddModal(true);
              setNewCost(prev => ({ ...prev, approved: currentUser?.role === 'admin' })); // Set default approved status when opening modal
            }}
            className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>

          <input
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
            id="csv-import-material"
          />
          <label htmlFor="csv-import-material">
            <Button
              as="span"
              variant="outline"
              className="border-[#C9C8AF] text-[#5A7765] hover:bg-[#F0F0EE]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </label>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-[#C9C8AF] text-[#5A7765] hover:bg-[#F0F0EE]"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
            onChange={handleStatementUpload}
            className="hidden"
            id="statement-upload"
            disabled={extractingStatement}
          />
          <label htmlFor="statement-upload" className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              className="border-[#2A6B5A] text-[#1B4D3E] hover:bg-[#E8F4F1] pointer-events-none"
              disabled={extractingStatement}
            >
              {extractingStatement ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upload Statement
                </>
              )}
            </Button>
          </label>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 bg-white border-[#C9C8AF]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterApproved} onValueChange={setFilterApproved}>
            <SelectTrigger className="w-32 bg-white border-[#C9C8AF]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
          <CardContent className="p-4">
            <p className="text-sm mb-1" style={{ color: '#5A7765' }}>Approved Costs</p>
            <p className="text-2xl font-bold" style={{ color: '#0E351F' }}>{formatCurrency(totalApproved)}</p>
          </CardContent>
        </Card>
        <Card className="border" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
          <CardContent className="p-4">
            <p className="text-sm mb-1" style={{ color: '#5A7765' }}>Pending Approval</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="border" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
          <CardContent className="p-4">
            <p className="text-sm mb-1" style={{ color: '#5A7765' }}>Total Filtered Costs</p>
            <p className="text-2xl font-bold" style={{ color: '#181E18' }}>{formatCurrency(totalAll)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Pie Chart */}
      {categoryBreakdown.length > 0 && (
        <Card className="border" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
          <CardHeader className="border-b" style={{ borderColor: '#C9C8AF' }}>
            <CardTitle>Cost Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-full lg:w-1/2 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-full lg:w-1/2 space-y-3">
                {categoryBreakdown
                  .sort((a, b) => b.value - a.value)
                  .map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-white rounded-lg border" style={{ borderColor: '#C9C8AF' }}>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: CATEGORY_COLORS[item.name] }}
                        />
                        <span className="font-medium" style={{ color: '#181E18' }}>{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold" style={{ color: '#181E18' }}>{formatCurrency(item.value)}</p>
                        <p className="text-xs" style={{ color: '#5A7765' }}>{item.percentage}%</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : filteredCosts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 mb-4">No material costs recorded yet.</p>
              <Button
                onClick={() => {
                  setShowAddModal(true);
                  setNewCost(prev => ({ ...prev, approved: currentUser?.role === 'admin' }));
                }}
                variant="outline"
                className="border-[#C9C8AF] text-[#5A7765] hover:bg-[#F0F0EE]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#C9C8AF] border-b-2 border-[#9FA097]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#181E18] uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#181E18] uppercase">Transaction</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#181E18] uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#181E18] uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#181E18] uppercase">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#181E18] uppercase">Receipt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#181E18] uppercase">Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#181E18] uppercase">Approved</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#181E18] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#C9C8AF]">
                  {filteredCosts.map((cost) => {
                    const isEditing = editingId === cost.id;
                    const isUnapproved = !cost.approved;

                    return (
                      <tr
                        key={cost.id}
                        className={`hover:bg-gray-50 transition-colors ${isUnapproved ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editData.date || ''}
                              onChange={(e) => setEditData({...editData, date: e.target.value})}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8"
                            />
                          ) : (
                            <span className="text-[#181E18]">{formatDate(cost.date)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <Input
                              value={editData.transaction || ''}
                              onChange={(e) => setEditData({...editData, transaction: e.target.value})}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8"
                            />
                          ) : (
                            <span className="text-[#181E18]">{cost.transaction}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editData.amount || ''}
                              onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value)})}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8"
                            />
                          ) : (
                            <span className="font-medium text-[#181E18]">{formatCurrency(cost.amount)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {isEditing ? (
                            <Select
                              value={editData.item || ''}
                              onValueChange={(value) => setEditData({...editData, item: value})}
                            >
                              <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span 
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                              style={{ 
                                backgroundColor: `${CATEGORY_COLORS[cost.item]}20`, // 20 is for 12.5% opacity
                                color: CATEGORY_COLORS[cost.item]
                              }}
                            >
                              {cost.item}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs">
                          {isEditing ? (
                            <Input
                              value={editData.description || ''}
                              onChange={(e) => setEditData({...editData, description: e.target.value})}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8"
                            />
                          ) : (
                            <span className="text-[#5A7765] truncate block">{cost.description || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {cost.receipt_image ? (
                            <button
                              onClick={() => window.open(cost.receipt_image, '_blank')}
                              className="inline-flex items-center gap-1 text-[#0E351F] hover:text-[#3B5B48]"
                            >
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-xs">View</span>
                            </button>
                          ) : (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleReceiptUpload(e, cost.id)}
                                className="hidden"
                                id={`receipt-${cost.id}`}
                              />
                              <label htmlFor={`receipt-${cost.id}`}>
                                <Button
                                  as="span"
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#5A7765] hover:text-[#0E351F] cursor-pointer h-8"
                                  disabled={uploadingReceipt === cost.id}
                                >
                                  <Upload className="w-4 h-4" />
                                </Button>
                              </label>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs">
                          {isEditing ? (
                            <Input
                              value={editData.notes || ''}
                              onChange={(e) => setEditData({...editData, notes: e.target.value})}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm h-8"
                            />
                          ) : (
                            <span className="text-[#5A7765] truncate block">{cost.notes || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {currentUser?.role === 'admin' ? (
                            <button
                              onClick={() => handleToggleApprove(cost)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                cost.approved
                                  ? 'bg-[#D4EDDA] text-[#0E351F]' // Approved: light green, dark green text
                                  : 'bg-[#FEEBCD] text-orange-800 hover:bg-[#FCD8A6]' // Pending: light orange, orange text, slightly darker orange hover
                              }`}
                            >
                              {cost.approved ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Approved
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3" />
                                  Pending
                                </>
                              )}
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              cost.approved
                                ? 'bg-[#D4EDDA] text-[#0E351F]'
                                : 'bg-[#FEEBCD] text-orange-800'
                            }`}>
                              {cost.approved ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Approved
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3" />
                                  Pending
                                </>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                                className="text-[#0E351F] hover:text-[#3B5B48] h-8"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="text-[#5A7765] hover:text-[#181E18] h-8"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(cost)}
                                className="text-[#5A7765] hover:text-[#0E351F] h-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(cost.id)}
                                className="text-[#5A7765] hover:text-red-600 h-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statement Upload Modal */}
      <Dialog open={showStatementModal} onOpenChange={setShowStatementModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Transactions</DialogTitle>
          </DialogHeader>
          
          {extractedTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No transactions extracted. Please try again.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#5A7765]">
                Review and edit the auto-categorized transactions below. You can change categories, projects, amounts, or remove items before importing.
              </p>

              <div className="space-y-2">
                {extractedTransactions.map((transaction) => (
                  <Card key={transaction.tempId} className="border-[#C9C8AF]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setExpandedTransaction(
                            expandedTransaction === transaction.tempId ? null : transaction.tempId
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              {expandedTransaction === transaction.tempId ? (
                                <ChevronUp className="w-5 h-5 text-[#5A7765]" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-[#5A7765]" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <p className="font-medium text-[#181E18]">{transaction.transaction}</p>
                                <span 
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                  style={{ 
                                    backgroundColor: `${CATEGORY_COLORS[transaction.item]}20`,
                                    color: CATEGORY_COLORS[transaction.item]
                                  }}
                                >
                                  {transaction.item}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-[#5A7765]">
                                <span>{formatDate(transaction.date)}</span>
                                <span className="font-semibold text-[#181E18]">{formatCurrency(transaction.amount)}</span>
                                {transaction.description && (
                                  <span className="text-xs">{transaction.description}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExtractedTransaction(transaction.tempId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {expandedTransaction === transaction.tempId && (
                        <div className="mt-4 pt-4 border-t border-[#C9C8AF] grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Date</label>
                            <Input
                              type="date"
                              value={transaction.date}
                              onChange={(e) => handleUpdateExtractedTransaction(transaction.tempId, 'date', e.target.value)}
                              className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Amount</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={transaction.amount}
                              onChange={(e) => handleUpdateExtractedTransaction(transaction.tempId, 'amount', parseFloat(e.target.value))}
                              className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Vendor/Transaction</label>
                            <Input
                              value={transaction.transaction}
                              onChange={(e) => handleUpdateExtractedTransaction(transaction.tempId, 'transaction', e.target.value)}
                              className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Category</label>
                            <Select
                              value={transaction.item}
                              onValueChange={(value) => handleUpdateExtractedTransaction(transaction.tempId, 'item', value)}
                            >
                              <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Project</label>
                            <Select
                              value={transaction.project_id}
                              onValueChange={(value) => handleUpdateExtractedTransaction(transaction.tempId, 'project_id', value)}
                            >
                              <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allProjects
                                  .filter(p => p.status !== 'Closed' && p.status !== 'Completed')
                                  .map(proj => (
                                    <SelectItem key={proj.id} value={proj.id}>
                                      {proj.number ? `${proj.number} - ` : ''}{proj.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Description</label>
                            <Input
                              value={transaction.description || ''}
                              onChange={(e) => handleUpdateExtractedTransaction(transaction.tempId, 'description', e.target.value)}
                              className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Notes</label>
                            <Textarea
                              value={transaction.notes || ''}
                              onChange={(e) => handleUpdateExtractedTransaction(transaction.tempId, 'notes', e.target.value)}
                              className="bg-white border-[#C9C8AF] text-[#181E18] text-sm"
                              rows={2}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#C9C8AF]">
                <p className="text-sm text-[#5A7765]">
                  {extractedTransactions.length} transaction(s) • Total: {formatCurrency(extractedTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0))}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowStatementModal(false);
                      setExtractedTransactions([]);
                    }}
                    className="border-[#C9C8AF] text-[#5A7765]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportExtractedTransactions}
                    className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                  >
                    Import All Transactions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Material/Misc Cost</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newCost);
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#5A7765]">Date</label>
                <Input
                  type="date"
                  required
                  value={newCost.date}
                  onChange={(e) => setNewCost({...newCost, date: e.target.value})}
                  className="bg-white border-[#C9C8AF] text-[#181E18]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#5A7765]">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={newCost.amount}
                  onChange={(e) => setNewCost({...newCost, amount: e.target.value})}
                  className="bg-white border-[#C9C8AF] text-[#181E18]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#5A7765]">Transaction/Vendor</label>
              <Input
                required
                value={newCost.transaction}
                onChange={(e) => setNewCost({...newCost, transaction: e.target.value})}
                className="bg-white border-[#C9C8AF] text-[#181E18]"
                placeholder="Home Depot, Amex *1234, etc."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#5A7765]">Category</label>
              <Select
                value={newCost.item}
                onValueChange={(value) => setNewCost({...newCost, item: value})}
              >
                <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#5A7765]">Description</label>
              <Input
                value={newCost.description}
                onChange={(e) => setNewCost({...newCost, description: e.target.value})}
                className="bg-white border-[#C9C8AF] text-[#181E18]"
                placeholder="What was purchased"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#5A7765]">Notes</label>
              <Textarea
                value={newCost.notes}
                onChange={(e) => setNewCost({...newCost, notes: e.target.value})}
                className="bg-white border-[#C9C8AF] text-[#181E18]"
                rows={2}
              />
            </div>

            {currentUser?.role === 'admin' && (
              <div 
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  newCost.approved 
                    ? 'bg-[#D4EDDA] border-[#0E351F]' 
                    : 'bg-white border-[#C9C8AF] hover:border-[#9FA097]'
                }`}
                onClick={() => setNewCost({...newCost, approved: !newCost.approved})}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex items-center h-5">
                    <Checkbox
                      id="approved"
                      checked={newCost.approved || false}
                      onCheckedChange={(checked) => setNewCost({...newCost, approved: checked})}
                      className="data-[state=checked]:bg-[#0E351F] data-[state=checked]:border-[#0E351F]"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="approved"
                      className="text-sm font-medium cursor-pointer block"
                      style={{ color: newCost.approved ? '#0E351F' : '#181E18' }}
                    >
                      Approve this expense immediately
                    </label>
                    <p className="text-xs mt-1" style={{ color: '#5A7765' }}>
                      {newCost.approved 
                        ? '✓ This expense will be approved and impact the project budget immediately' 
                        : 'This expense will be pending until approved by an admin'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewCost({
                    date: formatDate(new Date(), 'yyyy-MM-dd'),
                    transaction: '',
                    amount: '',
                    item: 'Material',
                    description: '',
                    notes: '',
                    approved: currentUser?.role === 'admin' // Reset approved status on cancel
                  });
                }}
                className="border-[#C9C8AF] text-[#5A7765] hover:bg-[#F0F0EE]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Cost'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}