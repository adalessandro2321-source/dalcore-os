
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, Edit, Trash2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatCurrency, dateInputToISO, isoToDateInput } from "../shared/DateFormatter";
import { startOfMonth, endOfMonth, format, isWithinInterval, parseISO } from "date-fns";

export default function CashRegisterTab() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState(null);
  const [filterMonth, setFilterMonth] = React.useState(format(new Date(), 'yyyy-MM'));
  const [selectedAccount, setSelectedAccount] = React.useState('American Express');
  const [showAllTransactions, setShowAllTransactions] = React.useState(false);
  const [formData, setFormData] = React.useState({
    account: 'American Express',
    date: format(new Date(), 'yyyy-MM-dd'),
    action: '',
    project_id: '', // Added project_id
    other: '',
    checks_out: '',
    adp: '',
    voids: '',
    interest_earned: '',
    wire_deposits: '',
    zelle_deposits: '',
    cc_deposits: '',
    check_deposits: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ['cashTransactions'],
    queryFn: () => base44.entities.CashTransaction.list('-date'), // Default sort by date descending for display
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  // Helper function to recalculate all balances for an account
  // This function now fetches its own fresh data to ensure correctness
  const recalculateAccountBalances = React.useCallback(async (account) => {
    // Fetch all transactions for the specific account, sorted by date ascending for balance calculation.
    const allTransactions = await base44.entities.CashTransaction.list('date'); // Sort ascending by date
    
    const allAccountTransactions = allTransactions.filter(t => t.account === account);

    let runningBalance = 0;
    const balanceUpdates = [];

    for (const tx of allAccountTransactions) {
      const deposits = (parseFloat(tx.interest_earned) || 0) + (parseFloat(tx.wire_deposits) || 0) + 
                       (parseFloat(tx.zelle_deposits) || 0) + (parseFloat(tx.cc_deposits) || 0) + (parseFloat(tx.check_deposits) || 0);
      
      const withdrawals = (parseFloat(tx.other) || 0) + (parseFloat(tx.checks_out) || 0) + (parseFloat(tx.adp) || 0) + (parseFloat(tx.voids) || 0);
      
      const newRunningBalance = runningBalance + deposits - withdrawals;

      // Only update if balance has changed to avoid unnecessary API calls
      // Comparing floats can be tricky, but for currency, direct comparison is often sufficient
      // if values are consistently stored with fixed precision.
      if (tx.balance === undefined || Math.abs(tx.balance - newRunningBalance) > 0.0001) { // Added tolerance for float comparison
        balanceUpdates.push(
          base44.entities.CashTransaction.update(tx.id, {
            ...tx, // Spread existing properties to ensure all original fields are sent back
            balance: newRunningBalance // Set the new balance
          })
        );
      }
      runningBalance = newRunningBalance; // Update running balance for the next iteration
    }
    // Execute all necessary updates concurrently
    await Promise.all(balanceUpdates);
    
    // Invalidate the cache for cashTransactions after all updates are done
    // This ensures the UI reflects the absolutely latest balances.
    queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
  }, [queryClient]); // Dependency array for useCallback

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Create the transaction with a temporary balance (or 0)
      await base44.entities.CashTransaction.create({
        ...data,
        date: dateInputToISO(data.date),
        project_id: data.project_id || null, // Convert empty string to null if no project selected
        other: parseFloat(data.other) || 0,
        checks_out: parseFloat(data.checks_out) || 0,
        adp: parseFloat(data.adp) || 0,
        voids: parseFloat(data.voids) || 0,
        interest_earned: parseFloat(data.interest_earned) || 0,
        wire_deposits: parseFloat(data.wire_deposits) || 0,
        zelle_deposits: parseFloat(data.zelle_deposits) || 0,
        cc_deposits: parseFloat(data.cc_deposits) || 0,
        check_deposits: parseFloat(data.check_deposits) || 0,
        balance: 0, // Will be recalculated by `recalculateAccountBalances`
      });
      // Recalculate all balances for this account after the new transaction is added
      await recalculateAccountBalances(data.account);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Update the transaction with a temporary balance (or 0)
      await base44.entities.CashTransaction.update(id, {
        ...data,
        date: dateInputToISO(data.date),
        project_id: data.project_id || null, // Convert empty string to null if no project selected
        other: parseFloat(data.other) || 0,
        checks_out: parseFloat(data.checks_out) || 0,
        adp: parseFloat(data.adp) || 0,
        voids: parseFloat(data.voids) || 0,
        interest_earned: parseFloat(data.interest_earned) || 0,
        wire_deposits: parseFloat(data.wire_deposits) || 0,
        zelle_deposits: parseFloat(data.zelle_deposits) || 0,
        cc_deposits: parseFloat(data.cc_deposits) || 0,
        check_deposits: parseFloat(data.check_deposits) || 0,
        balance: 0, // Will be recalculated by `recalculateAccountBalances`
      });
      // Recalculate all balances for this account after the transaction is updated
      await recalculateAccountBalances(data.account);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
      setShowAddModal(false);
      setEditingTransaction(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (transaction) => {
      await base44.entities.CashTransaction.delete(transaction.id);
      // Recalculate all balances for this account after deletion
      await recalculateAccountBalances(transaction.account);
    },
    onSuccess: () => {
      // Invalidation is now handled by recalculateAccountBalances
      // queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (transaction) => {
      // Create a reversing transaction
      const voidTransaction = {
        account: transaction.account,
        date: dateInputToISO(format(new Date(), 'yyyy-MM-dd')),
        action: `VOID: ${transaction.action}`,
        project_id: transaction.project_id || null,
        // Reverse all amounts
        other: -(parseFloat(transaction.other) || 0),
        checks_out: -(parseFloat(transaction.checks_out) || 0),
        adp: -(parseFloat(transaction.adp) || 0),
        voids: -(parseFloat(transaction.voids) || 0),
        interest_earned: -(parseFloat(transaction.interest_earned) || 0),
        wire_deposits: -(parseFloat(transaction.wire_deposits) || 0),
        zelle_deposits: -(parseFloat(transaction.zelle_deposits) || 0),
        cc_deposits: -(parseFloat(transaction.cc_deposits) || 0),
        check_deposits: -(parseFloat(transaction.check_deposits) || 0),
        balance: 0,
        notes: `Void of transaction from ${formatDate(transaction.date)}`,
        void_of_transaction_id: transaction.id
      };

      // Create the void transaction
      const newVoidTransaction = await base44.entities.CashTransaction.create(voidTransaction);

      // Mark the original transaction as voided
      await base44.entities.CashTransaction.update(transaction.id, {
        voided: true,
        voided_by_transaction_id: newVoidTransaction.id
      });

      // Recalculate all balances for this account
      await recalculateAccountBalances(transaction.account);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
    },
  });

  const handleDeleteAll = async (account) => {
    const accountTransactions = transactions.filter(t => t.account === account);
    
    if (accountTransactions.length === 0) {
      alert('No transactions to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ALL ${accountTransactions.length} transactions for ${account}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Use Promise.all to delete transactions concurrently for better performance
      await Promise.all(accountTransactions.map(tx => base44.entities.CashTransaction.delete(tx.id)));
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] }); // Invalidate queries after deleting all
      alert('All transactions deleted successfully.');
    } catch (error) {
      console.error('Error deleting transactions:', error);
      alert('An error occurred while deleting transactions. Please check the console for details.');
    }
  };

  const handleRecalculateBalances = async (account) => {
    if (!confirm(`Recalculate all balances for ${account}? This will fix any balance inconsistencies.`)) {
      return;
    }

    try {
      await recalculateAccountBalances(account);
      // queryClient.invalidateQueries({ queryKey: ['cashTransactions'] }); // Invalidation is handled by recalculateAccountBalances
      alert('Balances recalculated successfully!');
    } catch (error) {
      console.error('Error recalculating balances:', error);
      alert('Error recalculating balances. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      account: selectedAccount,
      date: format(new Date(), 'yyyy-MM-dd'),
      action: '',
      project_id: '',
      other: '',
      checks_out: '',
      adp: '',
      voids: '',
      interest_earned: '',
      wire_deposits: '',
      zelle_deposits: '',
      cc_deposits: '',
      check_deposits: '',
      notes: '',
    });
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      account: transaction.account,
      date: isoToDateInput(transaction.date),
      action: transaction.action,
      project_id: transaction.project_id || '',
      other: transaction.other || '',
      checks_out: transaction.checks_out || '',
      adp: transaction.adp || '',
      voids: transaction.voids || '',
      interest_earned: transaction.interest_earned || '',
      wire_deposits: transaction.wire_deposits || '',
      zelle_deposits: transaction.zelle_deposits || '',
      cc_deposits: transaction.cc_deposits || '',
      check_deposits: transaction.check_deposits || '',
      notes: transaction.notes || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = (transaction) => {
    if (confirm(`Are you sure you want to delete this transaction: "${transaction.action}"?`)) {
      // Pass the full transaction object to deleteMutation to access `account` for recalculation
      deleteMutation.mutate(transaction);
    }
  };

  const handleVoid = (transaction) => {
    if (transaction.voided) {
      alert('This transaction has already been voided.');
      return;
    }

    if (transaction.void_of_transaction_id) {
      alert('This is a void transaction and cannot be voided again.');
      return;
    }

    if (confirm(`Are you sure you want to VOID this transaction: "${transaction.action}"?\n\nThis will create a reversing transaction to refund the amounts.`)) {
      voidMutation.mutate(transaction);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // monthStart and monthEnd are for display purposes primarily, local date-fns is fine.
  // The actual filtering logic will now use UTC parsing for consistency.
  const monthStart = startOfMonth(new Date(filterMonth + '-01')); 

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.number ? `${project.number} - ${project.name}` : project?.name || '-';
  };

  const renderAccountTab = (account) => {
    const accountTransactions = transactions.filter(t => t.account === account);
    
    // Parse filter month in UTC to match transaction dates (which are stored in UTC)
    const [filterYearStr, filterMonthStr] = filterMonth.split('-');
    const filterYear = parseInt(filterYearStr);
    const filterMonthNum = parseInt(filterMonthStr) - 1; // Convert to 0-11 for Date.getUTCMonth()

    // Filter by month only if showAllTransactions is false
    const filteredTransactions = showAllTransactions 
      ? accountTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date when showing all
      : accountTransactions.filter(t => {
          if (!t.date) return false;
          try {
            // Parse the stored date (which is assumed to be ISO string, often UTC)
            const txDate = parseISO(t.date);
            
            // Get the UTC year and month from the transaction
            const txYear = txDate.getUTCFullYear();
            const txMonth = txDate.getUTCMonth(); // 0-11
            
            // Compare UTC year and month directly
            return txYear === filterYear && txMonth === filterMonthNum;
          } catch {
            return false;
          }
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date for period view

    // Calculate summary for the currently displayed (filtered/all) period
    const periodSummary = filteredTransactions.reduce((acc, t) => {
      acc.deposits += (parseFloat(t.interest_earned) || 0) + (parseFloat(t.wire_deposits) || 0) + 
                      (parseFloat(t.zelle_deposits) || 0) + (parseFloat(t.cc_deposits) || 0) + (parseFloat(t.check_deposits) || 0);
      acc.withdrawals += (parseFloat(t.other) || 0) + (parseFloat(t.checks_out) || 0) + (parseFloat(t.adp) || 0) + (parseFloat(t.voids) || 0);
      return acc;
    }, { deposits: 0, withdrawals: 0 });

    const netCashFlow = periodSummary.deposits - periodSummary.withdrawals;

    // Get opening balance (last transaction before period, based on ALL transactions for the account)
    // Need to sort all transactions for the account by date ascending to find the balance before the period starts.
    const allAccountTransactionsSortedAsc = [...accountTransactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const priorTransactions = allAccountTransactionsSortedAsc.filter(t => {
      if (!t.date) return false;
      try {
        const txDate = parseISO(t.date);
        const txYear = txDate.getUTCFullYear();
        const txMonth = txDate.getUTCMonth();
        
        // Transaction is strictly before the filter month (using UTC components)
        return txYear < filterYear || (txYear === filterYear && txMonth < filterMonthNum);
      } catch {
        return false;
      }
    });
    
    const openingBalance = priorTransactions[priorTransactions.length - 1]?.balance || 0;

    // Calculate ending balance for the period
    // If showing all transactions, use the latest transaction's balance from the overall sorted list
    // If filtering by month, calculate: opening balance + net cash flow for that month
    const endingBalance = showAllTransactions 
      ? (accountTransactions.length > 0 ? accountTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance : 0) // transactions from useQuery is sorted descending, so [0] is latest
      : openingBalance + netCashFlow; 

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Deposits</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(periodSummary.deposits)}</p>
                </div>
                <ArrowDownRight className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Withdrawals</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(periodSummary.withdrawals)}</p>
                </div>
                <ArrowUpRight className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Net Cash Flow</p>
                  <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCashFlow)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-[#0E351F]" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0E351F] text-white border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-80 mb-1">
                    {showAllTransactions ? 'Current Balance' : 'Ending Balance'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(endingBalance)}</p>
                  <p className="text-xs opacity-60 mt-1">Opening: {formatCurrency(openingBalance)}</p>
                </div>
                <CreditCard className="w-8 h-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {accountTransactions.length === 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6 text-center">
              <p className="text-blue-800 mb-2">No transactions yet for {account}</p>
              <p className="text-sm text-blue-600">Click "Add Transaction" above to get started</p>
            </CardContent>
          </Card>
        )}

        {accountTransactions.length > 0 && (
          <Card className="bg-white border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <div className="flex items-center justify-between">
                <CardTitle>{account} - Cash Register ({accountTransactions.length} total transactions)</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRecalculateBalances(account)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalculate Balances
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAll(account)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F4F3] border-b border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Project</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-red-700">Other</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-red-700">Checks Out</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-red-700">ADP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-red-700">Voids</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-700">Interest</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-700">Wire</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-700">Zelle</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-700">CC</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-700">Check</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Balance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="14" className="px-6 py-8 text-center text-gray-500">
                          {showAllTransactions 
                            ? `No transactions found for ${account}.` 
                            : `No transactions for ${format(monthStart, 'MMMM yyyy')}. Toggle "Show All Transactions" to see all records.`}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isVoided = tx.voided;
                        const isVoidTransaction = tx.void_of_transaction_id;
                        
                        return (
                          <tr 
                            key={tx.id} 
                            className={`hover:bg-gray-50 ${isVoided ? 'bg-red-50 opacity-60' : ''} ${isVoidTransaction ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-4 py-3 text-gray-900">
                              {formatDate(tx.date)}
                              {isVoided && (
                                <span className="ml-2 text-xs text-red-600 font-medium">VOIDED</span>
                              )}
                              {isVoidTransaction && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">VOID</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-900">{tx.action}</td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{getProjectName(tx.project_id)}</td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {tx.other ? formatCurrency(tx.other) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {tx.checks_out ? formatCurrency(tx.checks_out) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {tx.adp ? formatCurrency(tx.adp) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {tx.voids ? formatCurrency(tx.voids) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tx.interest_earned ? formatCurrency(tx.interest_earned) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tx.wire_deposits ? formatCurrency(tx.wire_deposits) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tx.zelle_deposits ? formatCurrency(tx.zelle_deposits) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tx.cc_deposits ? formatCurrency(tx.cc_deposits) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {tx.check_deposits ? formatCurrency(tx.check_deposits) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatCurrency(tx.balance)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {!isVoidTransaction && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(tx)}
                                      className="h-8 w-8 p-0"
                                      disabled={isVoided}
                                      title={isVoided ? 'Cannot edit voided transaction' : 'Edit'}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleVoid(tx)}
                                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                      disabled={isVoided || voidMutation.isPending}
                                      title={isVoided ? 'Already voided' : 'Void transaction'}
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(tx)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Calculate combined current balance across all accounts
  const amexTransactions = transactions.filter(t => t.account === 'American Express');
  const chaseTransactions = transactions.filter(t => t.account === 'Chase');
  
  // Transactions are sorted by '-date' (descending), so the latest balance is at index 0
  const amexCurrentBalance = amexTransactions.length > 0 ? amexTransactions[0].balance : 0;
  const chaseCurrentBalance = chaseTransactions.length > 0 ? chaseTransactions[0].balance : 0;
  
  const totalCurrentBalance = amexCurrentBalance + chaseCurrentBalance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            disabled={showAllTransactions}
          />
          <div className="text-sm text-gray-600">
            {showAllTransactions ? 'Showing all transactions' : format(monthStart, 'MMMM yyyy')}
          </div>
          {/* Checkbox for showing all transactions */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllTransactions}
              onChange={(e) => setShowAllTransactions(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Show All Transactions</span>
          </label>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setEditingTransaction(null);
            setShowAddModal(true);
          }}
          className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Combined Balance Summary Card */}
      <Card className="bg-gradient-to-r from-[#0E351F] to-[#3B5B48] text-white border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 mb-1">Total Current Balance (All Accounts)</p>
              <p className="text-3xl font-bold">{formatCurrency(totalCurrentBalance)}</p>
              <div className="flex gap-6 mt-3 text-sm opacity-90">
                <div>
                  <span className="opacity-70">American Express: </span>
                  <span className="font-semibold">{formatCurrency(amexCurrentBalance)}</span>
                </div>
                <div>
                  <span className="opacity-70">Chase: </span>
                  <span className="font-semibold">{formatCurrency(chaseCurrentBalance)}</span>
                </div>
              </div>
            </div>
            <DollarSign className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedAccount} onValueChange={setSelectedAccount}>
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="American Express" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />
            American Express
          </TabsTrigger>
          <TabsTrigger value="Chase" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />
            Chase
          </TabsTrigger>
        </TabsList>

        <TabsContent value="American Express">
          {renderAccountTab('American Express')}
        </TabsContent>

        <TabsContent value="Chase">
          {renderAccountTab('Chase')}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) {
          setEditingTransaction(null);
          resetForm();
        }
      }}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? 'Edit' : 'Add'} Cash Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account</Label>
                <Select
                  value={formData.account}
                  onValueChange={(value) => setFormData({...formData, account: value})}
                >
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="American Express">American Express</SelectItem>
                    <SelectItem value="Chase">Chase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date <span className="text-red-600">*</span></Label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                />
              </div>
            </div>

            <div>
              <Label>Action/Description</Label>
              <Input
                required
                value={formData.action}
                onChange={(e) => setFormData({...formData, action: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                placeholder="Description of transaction"
              />
            </div>

            <div>
              <Label>Project (Optional)</Label>
              <Select
                value={formData.project_id || ''}
                onValueChange={(value) => setFormData({...formData, project_id: value === '' ? null : value})}
              >
                <SelectTrigger className="bg-white border-[#C9C8AF]">
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#C9C8AF]">
                  <SelectItem value={null}>No Project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.number ? `${project.number} - ${project.name}` : project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-[#C9C8AF] pt-4 mt-4">
              <h4 className="text-sm font-semibold text-red-700 mb-3">Withdrawals (Money Out)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-red-700">Other</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other}
                    onChange={(e) => setFormData({...formData, other: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-red-700">Checks Out</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.checks_out}
                    onChange={(e) => setFormData({...formData, checks_out: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-red-700">ADP</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.adp}
                    onChange={(e) => setFormData({...formData, adp: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-red-700">Voids</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.voids}
                    onChange={(e) => setFormData({...formData, voids: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#C9C8AF] pt-4 mt-4">
              <h4 className="text-sm font-semibold text-green-700 mb-3">Deposits (Money In)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-green-700">Interest Earned</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_earned}
                    onChange={(e) => setFormData({...formData, interest_earned: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-green-700">Wire Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.wire_deposits}
                    onChange={(e) => setFormData({...formData, wire_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-green-700">Zelle Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.zelle_deposits}
                    onChange={(e) => setFormData({...formData, zelle_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-green-700">CC Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cc_deposits}
                    onChange={(e) => setFormData({...formData, cc_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-green-700">Check Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.check_deposits}
                    onChange={(e) => setFormData({...formData, check_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTransaction(null);
                  resetForm();
                }}
                className="border-[#C9C8AF]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingTransaction ? 'Update Transaction' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
