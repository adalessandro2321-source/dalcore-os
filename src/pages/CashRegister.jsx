import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, Search, ZoomIn, ZoomOut } from "lucide-react";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import { format, parseISO } from "date-fns";

export default function CashRegister() {
  const [showModal, setShowModal] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState({ key: 'date', direction: 'desc' });
  const [zoom, setZoom] = React.useState(100);
  const [formData, setFormData] = React.useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    action: '',
    project_id: '',
    project_number: '',
    other: 0,
    checks_out: 0,
    adp: 0,
    voids: 0,
    interest_earned: 0,
    wire_deposits: 0,
    zelle_deposits: 0,
    cc_deposits: 0,
    check_deposits: 0,
    notes: ''
  });

  const queryClient = useQueryClient();

  // Helper function to safely parse numeric values
  const parseAmount = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
  };

  const { data: transactions = [] } = useQuery({
    queryKey: ['cashTransactions'],
    queryFn: () => base44.entities.CashTransaction.list('date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Don't calculate balance here - let recalculateBalances handle it
      await base44.entities.CashTransaction.create({
        ...data,
        balance: 0 // Temporary, will be recalculated
      });

      await recalculateBalances();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.CashTransaction.update(id, data);
      await recalculateBalances();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.CashTransaction.delete(id);
      await recalculateBalances();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
    },
  });

  const recalculateBalances = async () => {
    const allTransactions = await base44.entities.CashTransaction.list();
    
    // Sort transactions by date AND created_date chronologically (oldest first)
    const sortedTransactions = [...allTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // If dates are the same, sort by created_date
      if (dateA === dateB) {
        const createdA = new Date(a.created_date).getTime();
        const createdB = new Date(b.created_date).getTime();
        return createdA - createdB;
      }
      
      return dateA - dateB;
    });

    let runningBalance = 0;

    for (const transaction of sortedTransactions) {
      // Deposits add to balance (positive)
      const deposits = parseAmount(transaction.wire_deposits) + 
                      parseAmount(transaction.zelle_deposits) +
                      parseAmount(transaction.cc_deposits) + 
                      parseAmount(transaction.check_deposits) +
                      parseAmount(transaction.interest_earned) + 
                      parseAmount(transaction.voids);

      // Withdrawals subtract from balance (negative)
      const withdrawals = parseAmount(transaction.other) + 
                         parseAmount(transaction.checks_out) + 
                         parseAmount(transaction.adp);

      // Calculate new running balance
      runningBalance = Number((runningBalance + deposits - withdrawals).toFixed(2));

      // Always update to ensure balance is correct
      await base44.entities.CashTransaction.update(transaction.id, {
        ...transaction,
        balance: runningBalance
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      action: '',
      project_id: '',
      project_number: '',
      other: 0,
      checks_out: 0,
      adp: 0,
      voids: 0,
      interest_earned: 0,
      wire_deposits: 0,
      zelle_deposits: 0,
      cc_deposits: 0,
      check_deposits: 0,
      notes: ''
    });
    setEditingTransaction(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const project = projects.find(p => p.id === formData.project_id);
    const dataToSubmit = {
      ...formData,
      project_number: project?.number || formData.project_number,
      other: parseAmount(formData.other),
      checks_out: parseAmount(formData.checks_out),
      adp: parseAmount(formData.adp),
      voids: parseAmount(formData.voids),
      interest_earned: parseAmount(formData.interest_earned),
      wire_deposits: parseAmount(formData.wire_deposits),
      zelle_deposits: parseAmount(formData.zelle_deposits),
      cc_deposits: parseAmount(formData.cc_deposits),
      check_deposits: parseAmount(formData.check_deposits),
    };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      date: formatDate(transaction.date, 'yyyy-MM-dd'),
      action: transaction.action || '',
      project_id: transaction.project_id || '',
      project_number: transaction.project_number || '',
      other: transaction.other || 0,
      checks_out: transaction.checks_out || 0,
      adp: transaction.adp || 0,
      voids: transaction.voids || 0,
      interest_earned: transaction.interest_earned || 0,
      wire_deposits: transaction.wire_deposits || 0,
      zelle_deposits: transaction.zelle_deposits || 0,
      cc_deposits: transaction.cc_deposits || 0,
      check_deposits: transaction.check_deposits || 0,
      notes: transaction.notes || ''
    });
    setShowModal(true);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-[#0E351F]" />
      : <ArrowDown className="w-3 h-3 ml-1 text-[#0E351F]" />;
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = React.useMemo(() => {
    let filtered = [...transactions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(t => {
        const searchLower = searchTerm.toLowerCase();
        return (
          t.action?.toLowerCase().includes(searchLower) ||
          t.project_number?.toLowerCase().includes(searchLower) ||
          t.notes?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle dates - if dates are same, use created_date for consistent ordering
      if (sortConfig.key === 'date') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
        
        // If dates are identical, use created_date as tiebreaker
        if (aValue === bValue) {
          aValue = new Date(a.created_date).getTime();
          bValue = new Date(b.created_date).getTime();
        }
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aString = String(aValue || '').toLowerCase();
      const bString = String(bValue || '').toLowerCase();

      if (aString < bString) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aString > bString) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, searchTerm, sortConfig]);

  // Get month color for row
  const getMonthColor = (date) => {
    if (!date) return 'bg-white';

    const month = new Date(date).getMonth();
    const colors = [
      'bg-blue-50',      // Jan
      'bg-purple-50',    // Feb
      'bg-pink-50',      // Mar
      'bg-red-50',       // Apr
      'bg-orange-50',    // May
      'bg-yellow-50',    // Jun
      'bg-lime-50',      // Jul
      'bg-green-50',     // Aug
      'bg-teal-50',      // Sep
      'bg-cyan-50',      // Oct
      'bg-sky-50',       // Nov
      'bg-indigo-50',    // Dec
    ];

    return colors[month];
  };

  const exportToExcel = () => {
    // Create HTML table for Excel
    const headers = ['Date', 'Action', 'Project No.', 'Other', 'Checks (Out)', 'ADP', 'Voids', 'Interest Earned', 'Wire Deposits', 'Zelle Deposits', 'CC Deposits', 'Check Deposits', 'Balance'];

    let html = '<html><head><meta charset="utf-8"></head><body><table border="1">';

    // Add header row with styling
    html += '<tr style="background-color: #0E351F; color: white; font-weight: bold;">';
    headers.forEach(header => {
      html += `<th style="padding: 8px; text-align: center;">${header}</th>`;
    });
    html += '</tr>';

    // Add data rows with month color coding
    filteredAndSortedTransactions.forEach((t, index) => {
      const prevTransaction = index > 0 ? filteredAndSortedTransactions[index - 1] : null;
      const isNewMonth = !prevTransaction ||
        new Date(t.date).getMonth() !== new Date(prevTransaction.date).getMonth();

      const monthColors = [
        '#DBEAFE', '#F3E8FF', '#FCE7F3', '#FEE2E2', '#FFEDD5', '#FEF3C7',
        '#ECFCCB', '#D1FAE5', '#CCFBF1', '#CFFAFE', '#E0F2FE', '#E0E7FF'
      ];
      const bgColor = monthColors[new Date(t.date).getMonth()];
      const borderStyle = isNewMonth ? 'border-top: 3px solid #000;' : '';

      html += `<tr style="background-color: ${bgColor}; ${borderStyle}">`;
      html += `<td style="padding: 6px; white-space: nowrap;">${formatDate(t.date, 'M/d/yyyy')}</td>`;
      html += `<td style="padding: 6px;">${t.action || ''}</td>`;
      html += `<td style="padding: 6px;">${t.project_number || ''}</td>`;
      html += `<td style="padding: 6px; text-align: right;">${t.other ? formatCurrency(t.other) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right;">${t.checks_out ? formatCurrency(t.checks_out) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right;">${t.adp ? formatCurrency(t.adp) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right;">${t.voids ? formatCurrency(t.voids) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #0E351F; font-weight: bold;">${t.interest_earned ? formatCurrency(t.interest_earned) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #0E351F; font-weight: bold;">${t.wire_deposits ? formatCurrency(t.wire_deposits) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #0E351F; font-weight: bold;">${t.zelle_deposits ? formatCurrency(t.zelle_deposits) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #0E351F; font-weight: bold;">${t.cc_deposits ? formatCurrency(t.cc_deposits) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; color: #0E351F; font-weight: bold;">${t.check_deposits ? formatCurrency(t.check_deposits) : ''}</td>`;
      html += `<td style="padding: 6px; text-align: right; font-weight: bold; background-color: #E8E7DD;">${formatCurrency(t.balance)}</td>`;
      html += '</tr>';
    });

    html += '</table></body></html>';

    // Create blob and download
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-register-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get the most recent transaction by date to show current balance
  const currentBalance = React.useMemo(() => {
    if (transactions.length === 0) return 0;
    const sorted = [...transactions].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return parseAmount(sorted[0].balance);
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold heading" style={{ color: '#181E18' }}>Cash Register</h2>
          <p style={{ color: '#5A7765' }}>Daily cash flow tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              if (confirm('Recalculate all balances? This will fix any calculation errors.')) {
                await recalculateBalances();
                queryClient.invalidateQueries({ queryKey: ['cashTransactions'] });
              }
            }}
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Fix Balances
          </Button>
          <div className="text-right mr-4">
            <p className="text-sm" style={{ color: '#5A7765' }}>Current Balance</p>
            <p className="text-2xl font-bold" style={{ color: '#0E351F' }}>{formatCurrency(currentBalance)}</p>
          </div>
          <div className="flex items-center gap-2 border border-[#C9C8AF] rounded-lg px-3 py-2 bg-white">
            <Button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={zoom <= 50}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center" style={{ color: '#5A7765' }}>
              {zoom}%
            </span>
            <Button
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={zoom >= 150}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={exportToExcel}
            variant="outline"
            className="border-[#C9C8AF]"
            style={{ color: '#5A7765' }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="text-white"
            style={{ backgroundColor: '#0E351F' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-[#C9C8AF]"
            />
          </div>
        </div>
        <p className="text-sm" style={{ color: '#5A7765' }}>
          Showing {filteredAndSortedTransactions.length} of {transactions.length} transactions
        </p>
      </div>

      {/* Month Color Legend */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-[#C9C8AF] rounded-lg">
        <span className="text-sm font-medium" style={{ color: '#5A7765' }}>Month Colors:</span>
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
          <div key={month} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded border border-gray-300 ${getMonthColor(new Date(2024, idx, 1))}`} />
            <span className="text-xs" style={{ color: '#5A7765' }}>{month}</span>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <Card className="bg-white border-[#C9C8AF]">
        <CardContent className="p-0">
          <div className="overflow-x-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${100 / (zoom / 100)}%` }}>
            <table className="w-full">
              <thead className="border-b sticky top-0 z-10" style={{ backgroundColor: '#F5F4F3', borderColor: '#C9C8AF' }}>
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Date
                      {getSortIcon('date')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('action')}
                  >
                    <div className="flex items-center">
                      Action
                      {getSortIcon('action')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('project_number')}
                  >
                    <div className="flex items-center">
                      Project No.
                      {getSortIcon('project_number')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('other')}
                  >
                    <div className="flex items-center justify-end">
                      Other
                      {getSortIcon('other')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('checks_out')}
                  >
                    <div className="flex items-center justify-end">
                      Checks (Out)
                      {getSortIcon('checks_out')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('adp')}
                  >
                    <div className="flex items-center justify-end">
                      ADP
                      {getSortIcon('adp')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('voids')}
                  >
                    <div className="flex items-center justify-end">
                      Voids
                      {getSortIcon('voids')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('interest_earned')}
                  >
                    <div className="flex items-center justify-end">
                      Interest
                      {getSortIcon('interest_earned')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('wire_deposits')}
                  >
                    <div className="flex items-center justify-end">
                      Wire
                      {getSortIcon('wire_deposits')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('zelle_deposits')}
                  >
                    <div className="flex items-center justify-end">
                      Zelle
                      {getSortIcon('zelle_deposits')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('cc_deposits')}
                  >
                    <div className="flex items-center justify-end">
                      CC
                      {getSortIcon('cc_deposits')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('check_deposits')}
                  >
                    <div className="flex items-center justify-end">
                      Check
                      {getSortIcon('check_deposits')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium cursor-pointer hover:bg-[#E8E7DD]"
                    style={{ color: '#5A7765' }}
                    onClick={() => handleSort('balance')}
                  >
                    <div className="flex items-center justify-end">
                      Balance
                      {getSortIcon('balance')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#5A7765' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="px-4 py-8 text-center" style={{ color: '#5A7765' }}>
                      {searchTerm ? 'No transactions match your search.' : 'No transactions yet. Add your first transaction to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTransactions.map((transaction, index) => {
                    const prevTransaction = index > 0 ? filteredAndSortedTransactions[index - 1] : null;
                    const isNewMonth = !prevTransaction ||
                      new Date(transaction.date).getMonth() !== new Date(prevTransaction.date).getMonth();

                    return (
                      <tr
                        key={transaction.id}
                        className={`border-b hover:opacity-80 transition-opacity ${getMonthColor(transaction.date)} ${isNewMonth ? 'border-t-2 border-gray-400' : ''}`}
                        style={{ borderColor: '#C9C8AF' }}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: '#181E18' }}>
                          {formatDate(transaction.date, 'M/d/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#181E18' }}>{transaction.action}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#181E18' }}>{transaction.project_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.other ? '#181E18' : '#9FA097' }}>
                          {transaction.other ? formatCurrency(transaction.other) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.checks_out ? '#181E18' : '#9FA097' }}>
                          {transaction.checks_out ? formatCurrency(transaction.checks_out) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.adp ? '#181E18' : '#9FA097' }}>
                          {transaction.adp ? formatCurrency(transaction.adp) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.voids ? '#181E18' : '#9FA097' }}>
                          {transaction.voids ? formatCurrency(transaction.voids) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.interest_earned ? '#0E351F' : '#9FA097' }}>
                          {transaction.interest_earned ? formatCurrency(transaction.interest_earned) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.wire_deposits ? '#0E351F' : '#9FA097' }}>
                          {transaction.wire_deposits ? formatCurrency(transaction.wire_deposits) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.zelle_deposits ? '#0E351F' : '#9FA097' }}>
                          {transaction.zelle_deposits ? formatCurrency(transaction.zelle_deposits) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.cc_deposits ? '#0E351F' : '#9FA097' }}>
                          {transaction.cc_deposits ? formatCurrency(transaction.cc_deposits) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: transaction.check_deposits ? '#0E351F' : '#9FA097' }}>
                          {transaction.check_deposits ? formatCurrency(transaction.check_deposits) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: '#0E351F' }}>
                          <div>
                            <div>{formatCurrency(transaction.balance)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(transaction.date)} @ {new Date(transaction.created_date).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(transaction)}
                              className="h-8 w-8"
                              style={{ color: '#5A7765' }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Delete this transaction?')) {
                                  deleteMutation.mutate(transaction.id);
                                }
                              }}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
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

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading">{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              </div>
              <div>
                <Label>Project (Optional)</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => setFormData({...formData, project_id: value})}
                >
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.number} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Action/Description <span className="text-red-600">*</span></Label>
              <Input
                required
                value={formData.action}
                onChange={(e) => setFormData({...formData, action: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                placeholder="e.g., Amex CC Payment, ADP Wage, Check #101"
              />
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#C9C8AF' }}>
              <h3 className="font-semibold mb-3 heading" style={{ color: '#181E18' }}>Withdrawals/Expenses</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Other</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other}
                    onChange={(e) => setFormData({...formData, other: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>Checks Out</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.checks_out}
                    onChange={(e) => setFormData({...formData, checks_out: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>ADP</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.adp}
                    onChange={(e) => setFormData({...formData, adp: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>Voids</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.voids}
                    onChange={(e) => setFormData({...formData, voids: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#C9C8AF' }}>
              <h3 className="font-semibold mb-3 heading" style={{ color: '#181E18' }}>Deposits/Income</h3>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label>Interest Earned</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_earned}
                    onChange={(e) => setFormData({...formData, interest_earned: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>Wire Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.wire_deposits}
                    onChange={(e) => setFormData({...formData, wire_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>Zelle Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.zelle_deposits}
                    onChange={(e) => setFormData({...formData, zelle_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>CC Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cc_deposits}
                    onChange={(e) => setFormData({...formData, cc_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
                <div>
                  <Label>Check Deposits</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.check_deposits}
                    onChange={(e) => setFormData({...formData, check_deposits: e.target.value})}
                    className="bg-white border-[#C9C8AF]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="border-[#C9C8AF]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-white"
                style={{ backgroundColor: '#0E351F' }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingTransaction ? 'Save Changes' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}