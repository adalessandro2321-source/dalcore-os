import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
  FolderOpen,
  Plus,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "../shared/DateFormatter";

const MATERIAL_CATEGORIES = ["Material", "Labor", "Tool", "Fuel", "Equipment Rental", "Dump Fee", "Permit", "Administration", "Misc"];

const OPERATING_EXPENSE_CATEGORIES = [
  "Salaries & Wages", "Rent", "Utilities", "Insurance", "Marketing",
  "Professional Services", "Office Supplies", "Software & Technology",
  "Vehicle Expenses", "Equipment Maintenance", "Taxes & Licenses",
  "Bank Fees", "Depreciation", "Miscellaneous"
];

export default function ReconciliationTab() {
  const [view, setView] = React.useState('list'); // 'list' | 'editor'
  const [activeDraftId, setActiveDraftId] = React.useState(null);
  const [uploadType, setUploadType] = React.useState('credit_card');
  const [extractingStatement, setExtractingStatement] = React.useState(false);
  const [extractedTransactions, setExtractedTransactions] = React.useState([]);
  const [expandedTransaction, setExpandedTransaction] = React.useState(null);
  const [selectedTransactions, setSelectedTransactions] = React.useState(new Set());
  const [showNewDraftModal, setShowNewDraftModal] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const [savingDraft, setSavingDraft] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: existingMaterialCosts = [] } = useQuery({
    queryKey: ['allMaterialCosts'],
    queryFn: () => base44.entities.MaterialCost.list(),
  });

  const { data: existingOperatingExpenses = [] } = useQuery({
    queryKey: ['allOperatingExpenses'],
    queryFn: () => base44.entities.OperatingExpense.list(),
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['reconciliationDrafts'],
    queryFn: () => base44.entities.ReconciliationDraft.list('-created_date'),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) {
        return base44.entities.ReconciliationDraft.update(id, data);
      } else {
        return base44.entities.ReconciliationDraft.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationDrafts'] });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (id) => base44.entities.ReconciliationDraft.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationDrafts'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (transactions) => {
      const materialCosts = transactions
        .filter(t => t.type === 'MaterialCost')
        .map(t => ({
          project_id: t.project_id,
          date: new Date(t.date).toISOString(),
          transaction: t.transaction,
          amount: parseFloat(t.amount) || 0,
          item: t.item,
          description: t.description || '',
          notes: t.notes || '',
          entered_by: currentUser?.email || '',
          approved: currentUser?.role === 'admin'
        }));

      const operatingExpenses = transactions
        .filter(t => t.type === 'OperatingExpense')
        .map(t => ({
          date: new Date(t.date).toISOString(),
          category: t.category,
          amount: parseFloat(t.amount) || 0,
          vendor: t.transaction,
          description: t.description || '',
          notes: t.notes || '',
          entered_by: currentUser?.email || ''
        }));

      if (materialCosts.length > 0) await base44.entities.MaterialCost.bulkCreate(materialCosts);
      if (operatingExpenses.length > 0) await base44.entities.OperatingExpense.bulkCreate(operatingExpenses);

      // Mark draft as completed only if all transactions have been imported
      if (activeDraftId) {
        const draft = drafts.find(d => d.id === activeDraftId);
        const previouslyImported = draft?.imported_count || 0;
        const newImportedCount = previouslyImported + transactions.length;
        const totalTransactions = draft?.total_transactions || extractedTransactions.length;
        const allDone = newImportedCount >= totalTransactions;

        await base44.entities.ReconciliationDraft.update(activeDraftId, {
          status: allDone ? 'Completed' : 'In Progress',
          imported_count: newImportedCount,
          // Remove imported transactions from the draft so they don't show up again
          transactions: extractedTransactions.filter(t => !selectedTransactions.has(t.tempId)),
          selected_ids: []
        });
      }
    },
    onSuccess: (_, importedTransactions) => {
      queryClient.invalidateQueries({ queryKey: ['allMaterialCosts'] });
      queryClient.invalidateQueries({ queryKey: ['allOperatingExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['materialCosts'] });
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliationDrafts'] });

      const importedIds = new Set(importedTransactions.map(t => t.tempId));
      const remaining = extractedTransactions.filter(t => !importedIds.has(t.tempId));

      if (remaining.length === 0) {
        // All done — go back to list
        setExtractedTransactions([]);
        setSelectedTransactions(new Set());
        setActiveDraftId(null);
        setView('list');
      } else {
        // Still more to go — stay in editor with remaining transactions
        setExtractedTransactions(remaining);
        setSelectedTransactions(new Set());
      }
    },
  });

  const handleStatementUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Process each file sequentially, creating a draft for each
    for (const file of files) {
      await handleSingleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleSingleFileUpload = async (file) => {
    setExtractingStatement(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const schema = uploadType === 'payroll' ? {
        type: "object",
        properties: {
          records: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Pay date in YYYY-MM-DD format" },
                employee_name: { type: "string", description: "Employee name" },
                gross_pay: { type: "number", description: "Gross pay amount" },
                net_pay: { type: "number", description: "Net pay amount" },
                taxes: { type: "number", description: "Total taxes withheld" },
                deductions: { type: "number", description: "Other deductions" }
              },
              required: ["date", "employee_name", "gross_pay"]
            }
          }
        }
      } : {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Transaction date in YYYY-MM-DD format" },
                transaction: { type: "string", description: "Merchant or vendor name" },
                amount: { type: "number", description: "Transaction amount (positive number, no currency symbols)" },
                description: { type: "string", description: "Transaction description or memo" }
              },
              required: ["date", "transaction", "amount"]
            }
          }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      if (result.status === 'error') {
        alert(`Failed to extract data: ${result.details || 'Unknown error'}`);
        return;
      }

      const rawTransactions = uploadType === 'payroll'
        ? (result.output?.records || result.output || [])
        : (result.output?.transactions || result.output || []);

      if (rawTransactions.length === 0) {
        alert('No transactions found in the file.');
        return;
      }

      const processed = rawTransactions.map((t, index) => {
        if (uploadType === 'payroll') {
          return {
            ...t,
            tempId: `temp-${index}`,
            type: 'OperatingExpense',
            category: 'Salaries & Wages',
            amount: t.gross_pay || 0,
            transaction: t.employee_name || 'Employee',
            description: `Payroll - Gross: ${t.gross_pay || 0}, Net: ${t.net_pay || 0}${t.taxes ? `, Taxes: ${t.taxes}` : ''}`,
            notes: '',
            isDuplicate: false,
          };
        }
        const isDuplicateMaterial = existingMaterialCosts.some(ec =>
          ec.date === t.date && Math.abs(ec.amount - t.amount) < 0.01 &&
          ec.transaction?.toLowerCase().includes(t.transaction?.toLowerCase())
        );
        const isDuplicateOpEx = existingOperatingExpenses.some(oe =>
          oe.date === t.date && Math.abs(oe.amount - t.amount) < 0.01 &&
          oe.vendor?.toLowerCase().includes(t.transaction?.toLowerCase())
        );
        return {
          ...t,
          tempId: `temp-${index}`,
          type: 'MaterialCost',
          item: 'Material',
          category: 'Miscellaneous',
          project_id: '',
          notes: '',
          isDuplicate: isDuplicateMaterial || isDuplicateOpEx,
          duplicateType: isDuplicateMaterial ? 'MaterialCost' : (isDuplicateOpEx ? 'OperatingExpense' : null)
        };
      });

      setExtractedTransactions(processed);
      const nonDuplicates = new Set(processed.filter(t => !t.isDuplicate).map(t => t.tempId));
      setSelectedTransactions(nonDuplicates);

      // Auto-save as a new draft
      setShowNewDraftModal(true);
      setDraftName(`${file.name.replace(/\.[^/.]+$/, '')} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    } catch (error) {
      console.error('Statement extraction error:', error);
      alert(`Failed to extract "${file.name}": ${error.message || 'Unknown error'}`);
    } finally {
      setExtractingStatement(false);
    }
  };

  const handleSaveNewDraft = async () => {
    if (!draftName.trim()) return;
    setSavingDraft(true);
    try {
      const draft = await saveDraftMutation.mutateAsync({
        id: null,
        data: {
          name: draftName.trim(),
          upload_type: uploadType,
          transactions: extractedTransactions,
          selected_ids: Array.from(selectedTransactions),
          status: 'In Progress',
          total_transactions: extractedTransactions.length,
          imported_count: 0,
          created_by: currentUser?.email || ''
        }
      });
      setActiveDraftId(draft.id);
      setShowNewDraftModal(false);
      setView('editor');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeDraftId) return;
    setSavingDraft(true);
    try {
      await saveDraftMutation.mutateAsync({
        id: activeDraftId,
        data: {
          transactions: extractedTransactions,
          selected_ids: Array.from(selectedTransactions),
        }
      });
      alert('Draft saved!');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleOpenDraft = (draft) => {
    setExtractedTransactions(draft.transactions || []);
    setSelectedTransactions(new Set(draft.selected_ids || []));
    setUploadType(draft.upload_type || 'credit_card');
    setActiveDraftId(draft.id);
    setView('editor');
  };

  const handleUpdateTransaction = (tempId, field, value) => {
    setExtractedTransactions(prev =>
      prev.map(t => t.tempId === tempId ? { ...t, [field]: value } : t)
    );
  };

  const handleRemoveTransaction = (tempId) => {
    setExtractedTransactions(prev => prev.filter(t => t.tempId !== tempId));
    setSelectedTransactions(prev => { const s = new Set(prev); s.delete(tempId); return s; });
  };

  const handleToggleSelection = (tempId) => {
    setSelectedTransactions(prev => {
      const s = new Set(prev);
      s.has(tempId) ? s.delete(tempId) : s.add(tempId);
      return s;
    });
  };

  const handleImport = async () => {
    const toImport = extractedTransactions.filter(t => selectedTransactions.has(t.tempId));
    if (toImport.length === 0) return;
    importMutation.mutate(toImport);
  };

  const totalAmount = extractedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const selectedAmount = extractedTransactions.filter(t => selectedTransactions.has(t.tempId)).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const duplicateCount = extractedTransactions.filter(t => t.isDuplicate).length;
  const selectedCount = selectedTransactions.size;

  // ---- DRAFT LIST VIEW ----
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Financial Document Reconciliation
                </CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  Upload statements and work through them at your own pace. Drafts are saved automatically.
                </p>
              </div>
              <label htmlFor="statement-upload-new" className="cursor-pointer">
                <Button
                  type="button"
                  className="bg-[#0E351F] hover:bg-[#3B5B48] text-white pointer-events-none"
                  disabled={extractingStatement}
                >
                  {extractingStatement ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Upload New Statement</>
                  )}
                </Button>
              </label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="w-48 bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card Statement</SelectItem>
                  <SelectItem value="payroll">Payroll Report</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
                onChange={handleStatementUpload}
                className="hidden"
                id="statement-upload-new"
                disabled={extractingStatement}
                multiple
              />
              {extractingStatement && (
                <p className="text-sm text-gray-500">Extracting transactions, please wait...</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {draftsLoading ? (
              <div className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : drafts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No drafts yet</p>
                <p className="text-sm mt-1">Upload a statement above to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {drafts.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div>
                        {draft.status === 'Completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-orange-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{draft.name}</p>
                        <p className="text-sm text-gray-500">
                          {draft.upload_type === 'payroll' ? 'Payroll' : 'Credit Card'} · {draft.total_transactions || 0} transactions · Created {formatDate(draft.created_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        className={draft.status === 'Completed'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-orange-100 text-orange-800 border-orange-200'}
                      >
                        {draft.status}
                      </Badge>
                      {draft.status !== 'Completed' && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenDraft(draft)}
                          className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDraftMutation.mutate(draft.id)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Name draft modal */}
        <Dialog open={showNewDraftModal} onOpenChange={setShowNewDraftModal}>
          <DialogContent className="bg-white border-gray-200 max-w-sm">
            <DialogHeader>
              <DialogTitle>Name this Draft</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Give this statement a name so you can find it later.</p>
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Amex March 2026"
                className="bg-white border-gray-300"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewDraftModal(false)}>Cancel</Button>
                <Button
                  onClick={handleSaveNewDraft}
                  disabled={!draftName.trim() || savingDraft}
                  className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                >
                  {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Open'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- EDITOR VIEW ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setView('list')} className="border-gray-300 text-gray-700">
          ← Back to Drafts
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="border-[#C9C8AF] text-[#5A7765]"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Progress
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || importMutation.isPending}
            className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
          >
            {importMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
            ) : (
              `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-[#0E351F] text-white border-gray-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-300">Total Transactions</p>
              <p className="text-2xl font-bold">{extractedTransactions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Selected for Import</p>
              <p className="text-2xl font-bold">{selectedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Potential Duplicates</p>
              <p className="text-2xl font-bold text-orange-400">{duplicateCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Selected Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Controls */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => setSelectedTransactions(new Set(extractedTransactions.filter(t => !t.isDuplicate).map(t => t.tempId)))}
          variant="outline" className="border-[#C9C8AF] text-[#5A7765]"
        >
          Select All Non-Duplicates
        </Button>
        <Button
          onClick={() => setSelectedTransactions(new Set())}
          variant="outline" className="border-[#C9C8AF] text-[#5A7765]"
        >
          Deselect All
        </Button>
      </div>

      {/* Transactions List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>Review & Categorize Transactions</CardTitle>
          {duplicateCount > 0 && (
            <p className="text-sm text-orange-600 font-medium mt-1">
              {duplicateCount} potential duplicate{duplicateCount !== 1 ? 's' : ''} detected
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {extractedTransactions.map((transaction) => (
              <div key={transaction.tempId} className={`p-4 ${transaction.isDuplicate ? 'bg-orange-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="flex items-center h-6 pt-1">
                    <Checkbox
                      checked={selectedTransactions.has(transaction.tempId)}
                      onCheckedChange={() => handleToggleSelection(transaction.tempId)}
                      className="data-[state=checked]:bg-[#0E351F] data-[state=checked]:border-[#0E351F]"
                    />
                  </div>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setExpandedTransaction(
                      expandedTransaction === transaction.tempId ? null : transaction.tempId
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        {expandedTransaction === transaction.tempId
                          ? <ChevronUp className="w-5 h-5 text-[#5A7765]" />
                          : <ChevronDown className="w-5 h-5 text-[#5A7765]" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <p className="font-medium text-[#181E18]">{transaction.transaction}</p>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            transaction.type === 'MaterialCost' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {transaction.type === 'MaterialCost' ? 'Project Cost' : 'Operating Expense'}
                          </span>
                          {transaction.isDuplicate && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              <AlertCircle className="w-3 h-3 mr-1" />Possible Duplicate
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[#5A7765]">
                          <span>{formatDate(transaction.date)}</span>
                          <span className="font-semibold text-[#181E18]">{formatCurrency(transaction.amount)}</span>
                          {transaction.description && <span className="text-xs">{transaction.description}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveTransaction(transaction.tempId)} className="text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {expandedTransaction === transaction.tempId && (
                  <div className="mt-4 pt-4 border-t border-[#C9C8AF] ml-10 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Date</label>
                      <Input type="date" value={transaction.date}
                        onChange={e => handleUpdateTransaction(transaction.tempId, 'date', e.target.value)}
                        className="bg-white border-[#C9C8AF] h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Amount</label>
                      <Input type="number" step="0.01" value={transaction.amount}
                        onChange={e => handleUpdateTransaction(transaction.tempId, 'amount', parseFloat(e.target.value))}
                        className="bg-white border-[#C9C8AF] h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Vendor/Transaction</label>
                      <Input value={transaction.transaction}
                        onChange={e => handleUpdateTransaction(transaction.tempId, 'transaction', e.target.value)}
                        className="bg-white border-[#C9C8AF] h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Type</label>
                      <Select value={transaction.type} onValueChange={v => handleUpdateTransaction(transaction.tempId, 'type', v)}>
                        <SelectTrigger className="bg-white border-[#C9C8AF] h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MaterialCost">Project Cost</SelectItem>
                          <SelectItem value="OperatingExpense">Operating Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {transaction.type === 'MaterialCost' ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Project</label>
                          <Select value={transaction.project_id} onValueChange={v => handleUpdateTransaction(transaction.tempId, 'project_id', v)}>
                            <SelectTrigger className="bg-white border-[#C9C8AF] h-8 text-sm"><SelectValue placeholder="Select project" /></SelectTrigger>
                            <SelectContent>
                              {allProjects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Category</label>
                          <Select value={transaction.item} onValueChange={v => handleUpdateTransaction(transaction.tempId, 'item', v)}>
                            <SelectTrigger className="bg-white border-[#C9C8AF] h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MATERIAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="text-xs font-medium text-[#5A7765] mb-1 block">Category</label>
                        <Select value={transaction.category} onValueChange={v => handleUpdateTransaction(transaction.tempId, 'category', v)}>
                          <SelectTrigger className="bg-white border-[#C9C8AF] h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OPERATING_EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Description</label>
                      <Input value={transaction.description || ''}
                        onChange={e => handleUpdateTransaction(transaction.tempId, 'description', e.target.value)}
                        className="bg-white border-[#C9C8AF] h-8 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[#5A7765] mb-1 block">Notes</label>
                      <Textarea value={transaction.notes || ''}
                        onChange={e => handleUpdateTransaction(transaction.tempId, 'notes', e.target.value)}
                        className="bg-white border-[#C9C8AF] text-sm" rows={2} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}