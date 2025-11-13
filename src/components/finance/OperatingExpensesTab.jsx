
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, TrendingUp, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatCurrency, dateInputToISO, isoToDateInput } from "../shared/DateFormatter";
import { format, addMonths, isBefore, parseISO, addYears, addDays } from "date-fns";

export default function OperatingExpensesTab() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState(null);
  const [filterMonth, setFilterMonth] = React.useState(format(new Date(), 'yyyy-MM'));
  const [formData, setFormData] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Other',
    amount: 0,
    description: '',
    vendor: '',
    payment_method: 'Check',
    recurring: false,
    recurring_frequency: '',
    auto_generate: true,
    notes: '', // Added notes to initial state for resetForm consistency
    end_date: '' // Added end_date to initial state for resetForm consistency
  });

  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['operatingExpenses'],
    queryFn: () => base44.entities.OperatingExpense.list('-date'),
  });

  // Check for recurring expenses that need next month generated
  React.useEffect(() => {
    checkAndGenerateRecurring();
  }, [expenses]); // Dependency array should ideally include expenses to re-evaluate when data changes.

  const checkAndGenerateRecurring = async () => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    
    const recurringExpenses = expenses.filter(e => e.recurring && e.recurring_frequency);
    
    const recurringGroups = {};
    recurringExpenses.forEach(expense => {
      // Group by unique recurrence properties, excluding date to find patterns
      const key = `${expense.category}-${expense.amount}-${expense.description}-${expense.vendor}-${expense.recurring_frequency}`;
      if (!recurringGroups[key]) {
        recurringGroups[key] = [];
      }
      recurringGroups[key].push(expense);
    });

    for (const key in recurringGroups) {
      const group = recurringGroups[key];
      // Sort to find the latest occurrence for this recurring pattern
      const latestExpense = group.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const latestDate = new Date(latestExpense.date);
      
      const nextScheduledDate = calculateNextDate(latestDate, latestExpense.recurring_frequency);
      
      // Only generate if the next scheduled date is before or within the next month and has not been generated yet
      // And the latest expense has auto_generate not explicitly false
      if (isBefore(nextScheduledDate, addMonths(today, 2)) && latestExpense.auto_generate !== false) {
        // Check if an expense for `nextScheduledDate` with the same properties already exists
        const alreadyGenerated = expenses.some(e => 
          e.date === format(nextScheduledDate, 'yyyy-MM-dd') &&
          e.category === latestExpense.category &&
          e.amount === latestExpense.amount && // Use the exact amount, as quarterly is no longer split
          e.description === latestExpense.description &&
          e.vendor === latestExpense.vendor &&
          e.recurring_frequency === latestExpense.recurring_frequency
        );

        if (!alreadyGenerated) {
          await generateNextRecurring(latestExpense, nextScheduledDate);
        }
      }
    }
  };

  const calculateNextDate = (lastDate, frequency) => {
    const date = new Date(lastDate);
    
    switch (frequency) {
      case 'Weekly':
        return addDays(date, 7); // Correctly advance by 7 days for weekly
      case 'Semi-Monthly':
        if (date.getDate() === 1) {
          date.setDate(15); // If current is 1st, next is 15th
          return date;
        } else {
          date.setMonth(date.getMonth() + 1); // If current is 15th, next is 1st of next month
          date.setDate(1);
          return date;
        }
      case 'Monthly':
        return addMonths(date, 1);
      case 'Quarterly':
        return addMonths(date, 3); // Advance by 3 months for quarterly
      case 'Annually':
        return addYears(date, 1); // Use addYears for clarity, effectively addMonths(date, 12)
      default:
        return date;
    }
  };

  const generateNextRecurring = async (expense, nextDate) => {
    try {
      // The `existingExpense` check was too broad, now it's done within `checkAndGenerateRecurring`
      // This function specifically handles creating the next instance.
      await base44.entities.OperatingExpense.create({
        date: dateInputToISO(format(nextDate, 'yyyy-MM-dd')),
        category: expense.category,
        subcategory: expense.subcategory || '',
        amount: expense.amount,
        description: expense.description || '',
        vendor: expense.vendor || '',
        payment_method: expense.payment_method || 'Check',
        reference_number: '',
        recurring: true,
        recurring_frequency: expense.recurring_frequency,
        auto_generate: true, // New auto-generated expenses should also be auto-generate true by default
        notes: `Auto-generated from recurring expense on ${format(new Date(expense.date), 'MMM d, yyyy')}`
      });
      
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
    } catch (error) {
      console.error('Error generating recurring expense:', error);
    }
  };

  const generateRecurringDates = (startDate, endDate, frequency, amount) => {
    const records = [];
    let currentDate = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    currentDate.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Make sure the start date itself is included if it's not after the end date
    while (currentDate <= end) {
      records.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        amount: parseFloat(amount)
      });

      switch (frequency) {
        case 'Weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'Semi-Monthly':
          if (currentDate.getDate() === 1) {
            currentDate.setDate(15);
          } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
          }
          break;
        case 'Monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'Quarterly':
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case 'Annually':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          // If frequency is unknown, stop here.
          return records;
      }
    }
    
    return records;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // If it's a recurring expense, generate all occurrences within the specified range
      if (data.recurring && data.recurring_frequency) {
        const endDate = data.end_date ? new Date(data.end_date) : new Date();
        const records = generateRecurringDates(data.date, endDate, data.recurring_frequency, data.amount);

        const expensesToCreate = records.map(record => ({
          date: dateInputToISO(record.date),
          category: data.category,
          subcategory: data.subcategory || '',
          amount: record.amount, // Now `amount` directly maps, no more quarterly split for initial creation
          description: data.description || '',
          vendor: data.vendor || '',
          payment_method: data.payment_method || 'Check',
          reference_number: data.reference_number || '',
          recurring: true,
          recurring_frequency: data.recurring_frequency,
          auto_generate: data.auto_generate !== false, // Ensure auto_generate is handled
          notes: data.notes || '' // No special note for quarterly anymore
        }));

        await Promise.all(expensesToCreate.map(expense => base44.entities.OperatingExpense.create(expense)));
      } else {
        // For single (non-recurring) expenses
        await base44.entities.OperatingExpense.create({
          ...data,
          date: dateInputToISO(data.date),
          amount: parseFloat(data.amount)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OperatingExpense.update(id, {
      ...data,
      date: dateInputToISO(data.date),
      amount: parseFloat(data.amount)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      setShowAddModal(false);
      setEditingExpense(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OperatingExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      alert(`Error deleting expense: ${error.message || 'Unknown error'}. Please try again.`);
    }
  });

  // Detect duplicate expenses - ONLY exact duplicates (same date + details)
  const duplicateGroups = React.useMemo(() => {
    const groups = {};
    
    expenses.forEach(expense => {
      // Create a unique key based on EXACT date, category, amount, description, vendor
      const key = `${expense.date}-${expense.category}-${expense.amount}-${expense.description}-${expense.vendor}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(expense);
    });
    
    // Only return groups with more than 1 expense (exact duplicates)
    const duplicates = Object.entries(groups)
      .filter(([, exps]) => exps.length > 1)
      .map(([, exps]) => exps);
    
    return duplicates;
  }, [expenses]);

  const handleDeleteDuplicates = async () => {
    if (duplicateGroups.length === 0) {
      alert('No duplicates found!');
      return;
    }

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.length - 1), 0);
    
    if (!confirm(`Found ${totalDuplicates} duplicate records across ${duplicateGroups.length} expense groups. Delete all duplicates? (Will keep the oldest record of each group)`)) {
      return;
    }

    try {
      for (const group of duplicateGroups) {
        // Sort by created_date and keep the first (oldest) one
        const sorted = group.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        
        // Delete all but the first one
        for (let i = 1; i < sorted.length; i++) {
          await base44.entities.OperatingExpense.delete(sorted[i].id);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['operatingExpenses'] });
      alert(`Successfully deleted ${totalDuplicates} duplicate records!`);
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      alert('Error deleting duplicates. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'Other',
      amount: 0,
      description: '',
      vendor: '',
      payment_method: 'Check',
      recurring: false,
      recurring_frequency: '',
      auto_generate: true,
      notes: '',
      end_date: '' // Ensure end_date is reset
    });
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      date: isoToDateInput(expense.date),
      category: expense.category,
      subcategory: expense.subcategory || '',
      amount: expense.amount,
      description: expense.description || '',
      vendor: expense.vendor || '',
      payment_method: expense.payment_method || 'Check',
      reference_number: expense.reference_number || '',
      recurring: expense.recurring || false,
      recurring_frequency: expense.recurring_frequency || '',
      auto_generate: expense.auto_generate !== false,
      notes: expense.notes || '',
      end_date: '' // End date is only for initial recurring creation, not editing a single instance
    });
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Parse filter month - extract year and month as integers
  const [filterYearStr, filterMonthStr] = filterMonth.split('-');
  const filterYear = parseInt(filterYearStr);
  const filterMonthNum = parseInt(filterMonthStr) - 1; // 0-11

  // Filter expenses by matching UTC year and month
  const filteredExpenses = React.useMemo(() => {
    const filtered = expenses.filter(e => {
      if (!e.date) return false;
      try {
        const txDate = parseISO(e.date);
        const txYear = txDate.getUTCFullYear();
        const txMonth = txDate.getUTCMonth(); // 0-11
        
        return txYear === filterYear && txMonth === filterMonthNum;
      } catch {
        return false;
      }
    });
    
    // Log for debugging
    console.log('=== EXPENSE FILTER DEBUG ===');
    console.log('Filter:', filterMonth, '(Year:', filterYear, 'Month:', filterMonthNum, ')');
    console.log('Total expenses in DB:', expenses.length);
    console.log('Filtered expenses:', filtered.length);
    console.log('Breakdown:');
    filtered.forEach(e => {
      const txDate = parseISO(e.date);
      console.log(`  ${e.date} (UTC: ${txDate.getUTCFullYear()}-${txDate.getUTCMonth() + 1}) - ${e.description}: $${e.amount}`);
    });
    const total = filtered.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    console.log('Calculated Total:', total);
    console.log('===========================');
    
    return filtered;
  }, [expenses, filterYear, filterMonthNum, filterMonth]);

  const periodTotal = React.useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const amount = parseFloat(e.amount) || 0;
      return sum + amount;
    }, 0);
  }, [filteredExpenses]);

  const expensesByCategory = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (parseFloat(e.amount) || 0);
    return acc;
  }, {});

  const estimatedRecurringRecords = React.useMemo(() => {
    if (formData.recurring && formData.recurring_frequency && formData.date && !editingExpense) {
      try {
        const endDate = formData.end_date || format(new Date(), 'yyyy-MM-dd');
        // Ensure start date is not after end date for estimation
        if (new Date(formData.date) > new Date(endDate)) {
          return 0; 
        }
        const records = generateRecurringDates(formData.date, endDate, formData.recurring_frequency, formData.amount);
        return records.length;
      } catch (error) {
        console.error("Error estimating recurring records:", error);
        return 0;
      }
    }
    return 0;
  }, [formData.recurring, formData.recurring_frequency, formData.date, formData.end_date, formData.amount, editingExpense]);

  // Format display month name
  const displayMonth = new Date(filterYear, filterMonthNum, 15);
  const displayMonthName = format(displayMonth, 'MMMM yyyy');

  return (
    <div className="space-y-6">
      {/* Duplicate Detection Alert */}
      {duplicateGroups.length > 0 && (
        <Card className="bg-orange-50 border-orange-300">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-orange-900 mb-1">
                  ⚠️ Duplicate Expenses Detected
                </p>
                <p className="text-sm text-orange-800">
                  Found {duplicateGroups.reduce((sum, group) => sum + (group.length - 1), 0)} duplicate records across {duplicateGroups.length} expense groups. This is causing incorrect totals.
                </p>
                <div className="mt-2 space-y-1">
                  {duplicateGroups.slice(0, 3).map((group, idx) => (
                    <p key={idx} className="text-xs text-orange-700">
                      • {group[0].description} ({formatDate(group[0].date)}): {group.length} copies found
                    </p>
                  ))}
                  {duplicateGroups.length > 3 && (
                    <p className="text-xs text-orange-700">...and {duplicateGroups.length - 3} more</p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleDeleteDuplicates}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                size="sm"
              >
                Remove All Duplicates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            min="2020-01"
            max="2030-12"
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          />
          <div className="text-sm text-gray-600">
            {displayMonthName}
          </div>
          <div className="text-xs text-gray-500">
            ({filteredExpenses.length} expenses = {formatCurrency(periodTotal)})
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setEditingExpense(null);
            setShowAddModal(true);
          }}
          className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Period Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(periodTotal)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{filteredExpenses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average per Transaction</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(filteredExpenses.length > 0 ? periodTotal / filteredExpenses.length : 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {Object.entries(expensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <div key={category} className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-700">{category}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {filteredExpenses.slice(0, 5).map((expense) => (
                <div key={expense.id} className="flex justify-between items-start py-2 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{expense.description || expense.category}</p>
                    <p className="text-xs text-gray-600">{formatDate(expense.date)} • {expense.vendor}</p>
                    {expense.recurring && (
                      <p className="text-xs text-emerald-600 mt-1">
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Recurring {expense.recurring_frequency}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>All Operating Expenses - {displayMonthName}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F4F3] border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Vendor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No expenses for this period
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {expense.category}
                        {expense.recurring && (
                          <span className="ml-2 text-xs text-emerald-600">
                            <RefreshCw className="w-3 h-3 inline" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{expense.description}</td>
                      <td className="px-4 py-3 text-gray-900">{expense.vendor}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(expense)}
                            className="h-8 w-8 p-0"
                            disabled={deleteMutation.isPending}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(expense.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit' : 'Add'} Operating Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date <span className="text-red-600">*</span></Label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                />
                <p className="text-xs text-gray-600 mt-1">
                  {formData.recurring && !editingExpense ? 'Start date for recurring expenses' : 'Expense date'}
                </p>
              </div>
              <div>
                <Label>Category <span className="text-red-600">*</span></Label>
                <Select
                  required
                  value={formData.category}
                  onValueChange={(value) => setFormData({...formData, category: value})}
                >
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#C9C8AF]">
                    <SelectItem value="Salaries & Wages">Salaries & Wages</SelectItem>
                    <SelectItem value="Professional Services">Professional Services</SelectItem>
                    <SelectItem value="Office Rent">Office Rent</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Software & Technology">Software & Technology</SelectItem>
                    <SelectItem value="Depreciation">Depreciation</SelectItem>
                    <SelectItem value="Interest">Interest</SelectItem>
                    <SelectItem value="Taxes">Taxes</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input
                  value={formData.vendor}
                  onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                  placeholder="Who was paid"
                />
              </div>
            </div>

            <div>
              <Label>Description <span className="text-red-600">*</span></Label>
              <Textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                rows={2}
                placeholder="What this expense was for"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({...formData, payment_method: value})}
                >
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#C9C8AF]">
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="Wire">Wire</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference Number</Label>
                <Input
                  value={formData.reference_number || ''}
                  onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                  placeholder="Check #, transaction ID, etc."
                />
              </div>
            </div>

            {!editingExpense && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={formData.recurring}
                    onChange={(e) => setFormData({...formData, recurring: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="recurring" className="cursor-pointer">Recurring expense (will auto-generate future occurrences)</Label>
                </div>

                {formData.recurring && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Frequency <span className="text-red-600">*</span></Label>
                        <Select
                          required
                          value={formData.recurring_frequency || ''}
                          onValueChange={(value) => setFormData({...formData, recurring_frequency: value})}
                        >
                          <SelectTrigger className="bg-white border-[#C9C8AF]">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#C9C8AF]">
                            <SelectItem value="Semi-Monthly">Semi-Monthly (1st & 15th)</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Backfill Through (Optional)</Label>
                        <Input
                          type="date"
                          value={formData.end_date || ''}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          className="bg-white border-[#C9C8AF]"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Leave empty to backfill through current date
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        ℹ️ This will create {estimatedRecurringRecords} expense records from {format(new Date(formData.date), 'MMM d, yyyy')} through {formData.end_date ? format(new Date(formData.end_date), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}.
                      </p>
                      <p className="text-sm text-blue-800 mt-2">
                        🔄 <strong>Auto-generation enabled:</strong> Future occurrences will be automatically created.
                      </p>
                    </div>

                    {formData.end_date && new Date(formData.end_date) < new Date(formData.date) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800">
                          ⚠️ End date cannot be before the start date.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
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
                  setEditingExpense(null);
                  resetForm();
                }}
                className="border-[#C9C8AF]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                disabled={createMutation.isPending || updateMutation.isPending || (formData.end_date && new Date(formData.end_date) < new Date(formData.date))}
              >
                {editingExpense ? 'Update' : formData.recurring && formData.recurring_frequency ? `Create ${estimatedRecurringRecords} Expenses` : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
