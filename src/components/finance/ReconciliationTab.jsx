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
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { formatCurrency, formatDate } from "../shared/DateFormatter";

const MATERIAL_CATEGORIES = ["Material", "Labor", "Tool", "Fuel", "Equipment Rental", "Dump Fee", "Permit", "Administration", "Misc"];

const OPERATING_EXPENSE_CATEGORIES = [
  "Salaries & Wages",
  "Rent",
  "Utilities",
  "Insurance",
  "Marketing",
  "Professional Services",
  "Office Supplies",
  "Software & Technology",
  "Vehicle Expenses",
  "Equipment Maintenance",
  "Taxes & Licenses",
  "Bank Fees",
  "Depreciation",
  "Miscellaneous"
];

export default function ReconciliationTab() {
  const [extractingStatement, setExtractingStatement] = React.useState(false);
  const [extractedTransactions, setExtractedTransactions] = React.useState([]);
  const [expandedTransaction, setExpandedTransaction] = React.useState(null);
  const [selectedTransactions, setSelectedTransactions] = React.useState(new Set());
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

      if (materialCosts.length > 0) {
        await base44.entities.MaterialCost.bulkCreate(materialCosts);
      }
      if (operatingExpenses.length > 0) {
        await base44.entities.OperatingExpense.bulkCreate(operatingExpenses);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allMaterialCosts'] });
      queryClient.invalidateQueries({ queryKey: ['allOperatingExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['materialCosts'] });
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      setExtractedTransactions([]);
      setSelectedTransactions(new Set());
    },
  });

  const handleStatementUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExtractingStatement(true);
    try {
      // Use AI extraction for all file types (CSV, PDF, images, Excel)
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
              description: { 
                type: "string",
                description: "Transaction description or memo"
              }
            },
            required: ["date", "transaction", "amount"]
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

      // Check for duplicates and categorize
      const processedTransactions = transactions.map((t, index) => {
        const isDuplicateMaterial = existingMaterialCosts.some(ec => 
          ec.date === t.date && 
          Math.abs(ec.amount - t.amount) < 0.01 &&
          ec.transaction.toLowerCase().includes(t.transaction.toLowerCase())
        );

        const isDuplicateOpEx = existingOperatingExpenses.some(oe => 
          oe.date === t.date && 
          Math.abs(oe.amount - t.amount) < 0.01 &&
          oe.vendor?.toLowerCase().includes(t.transaction.toLowerCase())
        );

        return {
          ...t,
          tempId: `temp-${index}`,
          type: 'MaterialCost', // Default to MaterialCost
          item: 'Material', // Default material category
          category: 'Miscellaneous', // Default operating expense category
          project_id: '',
          notes: '',
          isDuplicate: isDuplicateMaterial || isDuplicateOpEx,
          duplicateType: isDuplicateMaterial ? 'MaterialCost' : (isDuplicateOpEx ? 'OperatingExpense' : null)
        };
      });

      setExtractedTransactions(processedTransactions);
      // Auto-select non-duplicates
      const nonDuplicates = new Set(processedTransactions.filter(t => !t.isDuplicate).map(t => t.tempId));
      setSelectedTransactions(nonDuplicates);
    } catch (error) {
      console.error('Statement extraction error:', error);
      alert(`Failed to extract transactions: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setExtractingStatement(false);
      e.target.value = '';
    }
  };

  const handleUpdateTransaction = (tempId, field, value) => {
    setExtractedTransactions(prev =>
      prev.map(t => t.tempId === tempId ? { ...t, [field]: value } : t)
    );
  };

  const handleRemoveTransaction = (tempId) => {
    setExtractedTransactions(prev => prev.filter(t => t.tempId !== tempId));
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      newSet.delete(tempId);
      return newSet;
    });
  };

  const handleToggleSelection = (tempId) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tempId)) {
        newSet.delete(tempId);
      } else {
        newSet.add(tempId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allNonDuplicates = extractedTransactions.filter(t => !t.isDuplicate).map(t => t.tempId);
    setSelectedTransactions(new Set(allNonDuplicates));
  };

  const handleDeselectAll = () => {
    setSelectedTransactions(new Set());
  };

  const handleImport = async () => {
    const transactionsToImport = extractedTransactions.filter(t => selectedTransactions.has(t.tempId));
    await importMutation.mutateAsync(transactionsToImport);
  };

  const totalAmount = extractedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const selectedAmount = extractedTransactions
    .filter(t => selectedTransactions.has(t.tempId))
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const duplicateCount = extractedTransactions.filter(t => t.isDuplicate).length;
  const selectedCount = selectedTransactions.size;

  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Credit Card Statement Reconciliation
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Upload your credit card statement to extract, categorize, and reconcile all transactions across projects and operating expenses.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
              onChange={handleStatementUpload}
              className="hidden"
              id="statement-upload-reconciliation"
              disabled={extractingStatement}
            />
            <label htmlFor="statement-upload-reconciliation" className="cursor-pointer">
              <Button
                type="button"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white pointer-events-none"
                disabled={extractingStatement}
              >
                {extractingStatement ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting Transactions...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Credit Card Statement
                  </>
                )}
              </Button>
            </label>
            {extractingStatement && (
              <p className="text-sm text-gray-600">
                This may take a moment. We're extracting and analyzing all transactions...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {extractedTransactions.length > 0 && (
        <>
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

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                className="border-[#C9C8AF] text-[#5A7765]"
              >
                Select All Non-Duplicates
              </Button>
              <Button
                onClick={handleDeselectAll}
                variant="outline"
                className="border-[#C9C8AF] text-[#5A7765]"
              >
                Deselect All
              </Button>
            </div>
            <Button
              onClick={handleImport}
              disabled={selectedCount === 0 || importMutation.isPending}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>

          {/* Transactions List */}
          <Card className="bg-white border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <CardTitle>Review & Categorize Transactions</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Review each transaction, assign to project or operating expense, and select for import.
                {duplicateCount > 0 && (
                  <span className="text-orange-600 font-semibold ml-2">
                    ({duplicateCount} potential duplicate{duplicateCount !== 1 ? 's' : ''} detected)
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {extractedTransactions.map((transaction) => (
                  <div
                    key={transaction.tempId}
                    className={`p-4 ${transaction.isDuplicate ? 'bg-orange-50' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-center h-6 pt-1">
                        <Checkbox
                          checked={selectedTransactions.has(transaction.tempId)}
                          onCheckedChange={() => handleToggleSelection(transaction.tempId)}
                          disabled={transaction.isDuplicate}
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
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  transaction.type === 'MaterialCost'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {transaction.type === 'MaterialCost' ? 'Project Cost' : 'Operating Expense'}
                              </span>
                              {transaction.isDuplicate && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Possible Duplicate ({transaction.duplicateType})
                                </span>
                              )}
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
                        onClick={() => handleRemoveTransaction(transaction.tempId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {expandedTransaction === transaction.tempId && (
                      <div className="mt-4 pt-4 border-t border-[#C9C8AF] ml-10 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Date</label>
                          <Input
                            type="date"
                            value={transaction.date}
                            onChange={(e) => handleUpdateTransaction(transaction.tempId, 'date', e.target.value)}
                            className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Amount</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={transaction.amount}
                            onChange={(e) => handleUpdateTransaction(transaction.tempId, 'amount', parseFloat(e.target.value))}
                            className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Vendor/Transaction</label>
                          <Input
                            value={transaction.transaction}
                            onChange={(e) => handleUpdateTransaction(transaction.tempId, 'transaction', e.target.value)}
                            className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Type</label>
                          <Select
                            value={transaction.type}
                            onValueChange={(value) => handleUpdateTransaction(transaction.tempId, 'type', value)}
                          >
                            <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MaterialCost">Project Cost (Material/Misc)</SelectItem>
                              <SelectItem value="OperatingExpense">Operating Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {transaction.type === 'MaterialCost' ? (
                          <>
                            <div>
                              <label className="text-xs font-medium text-[#5A7765] mb-1 block">Project</label>
                              <Select
                                value={transaction.project_id}
                                onValueChange={(value) => handleUpdateTransaction(transaction.tempId, 'project_id', value)}
                              >
                                <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                                  <SelectValue placeholder="Select project" />
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
                              <label className="text-xs font-medium text-[#5A7765] mb-1 block">Category</label>
                              <Select
                                value={transaction.item}
                                onValueChange={(value) => handleUpdateTransaction(transaction.tempId, 'item', value)}
                              >
                                <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MATERIAL_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="text-xs font-medium text-[#5A7765] mb-1 block">Category</label>
                            <Select
                              value={transaction.category}
                              onValueChange={(value) => handleUpdateTransaction(transaction.tempId, 'category', value)}
                            >
                              <SelectTrigger className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATING_EXPENSE_CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="col-span-2">
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Description</label>
                          <Input
                            value={transaction.description || ''}
                            onChange={(e) => handleUpdateTransaction(transaction.tempId, 'description', e.target.value)}
                            className="bg-white border-[#C9C8AF] text-[#181E18] h-8 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-[#5A7765] mb-1 block">Notes</label>
                          <Textarea
                            value={transaction.notes || ''}
                            onChange={(e) => handleUpdateTransaction(transaction.tempId, 'notes', e.target.value)}
                            className="bg-white border-[#C9C8AF] text-[#181E18] text-sm"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}