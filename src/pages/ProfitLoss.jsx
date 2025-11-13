import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Download } from "lucide-react";
import { formatCurrency } from "../components/shared/DateFormatter";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subYears, format, isWithinInterval, parseISO } from "date-fns";

export default function ProfitLoss() {
  const [periodType, setPeriodType] = React.useState('month'); // month, quarter, year
  const [selectedDate, setSelectedDate] = React.useState(new Date());

  // Calculate period boundaries
  const getPeriodBounds = (date, type) => {
    switch(type) {
      case 'month':
        return { start: startOfMonth(date), end: endOfMonth(date) };
      case 'quarter':
        return { start: startOfQuarter(date), end: endOfQuarter(date) };
      case 'year':
        return { start: startOfYear(date), end: endOfYear(date) };
      default:
        return { start: startOfMonth(date), end: endOfMonth(date) };
    }
  };

  const currentPeriod = getPeriodBounds(selectedDate, periodType);
  const priorYearPeriod = getPeriodBounds(subYears(selectedDate, 1), periodType);

  // Queries
  const { data: performanceObligations = [] } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list(),
  });

  const { data: materialCosts = [] } = useQuery({
    queryKey: ['materialCosts'],
    queryFn: () => base44.entities.MaterialCost.list(),
  });

  const { data: operatingExpenses = [] } = useQuery({
    queryKey: ['operatingExpenses'],
    queryFn: () => base44.entities.OperatingExpense.list('-date'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  // Helper to check if date is in period
  const isInPeriod = (dateString, period) => {
    if (!dateString) return false;
    try {
      const date = parseISO(dateString);
      return isWithinInterval(date, { start: period.start, end: period.end });
    } catch {
      return false;
    }
  };

  // Calculate Revenue (from completed performance obligations)
  const calculateRevenue = (period) => {
    return performanceObligations
      .filter(po => po.status === 'Completed' && isInPeriod(po.completion_date, period))
      .reduce((sum, po) => sum + (po.allocated_value || 0), 0);
  };

  // Calculate COGS
  const calculateCOGS = (period) => {
    // Material costs (approved only) in period
    const materials = materialCosts
      .filter(m => m.approved && isInPeriod(m.date, period))
      .reduce((sum, m) => sum + (m.amount || 0), 0);

    // Subcontractor costs (paid bills) in period
    const subcontractorBills = bills
      .filter(b => 
        b.category === 'Subcontractor' && 
        payments.some(p => 
          p.applies_to_id === b.id && 
          p.type === 'Outgoing' &&
          isInPeriod(p.payment_date, period)
        )
      );

    const subcontractors = subcontractorBills.reduce((sum, bill) => {
      const billPayments = payments.filter(p => 
        p.applies_to_id === bill.id && 
        isInPeriod(p.payment_date, period)
      );
      return sum + billPayments.reduce((s, p) => s + (p.applied_amount || 0), 0);
    }, 0);

    // Direct labor (paid in period)
    const laborBills = bills
      .filter(b => 
        b.category === 'Labor' &&
        payments.some(p => 
          p.applies_to_id === b.id && 
          p.type === 'Outgoing' &&
          isInPeriod(p.payment_date, period)
        )
      );

    const labor = laborBills.reduce((sum, bill) => {
      const billPayments = payments.filter(p => 
        p.applies_to_id === bill.id && 
        isInPeriod(p.payment_date, period)
      );
      return sum + billPayments.reduce((s, p) => s + (p.applied_amount || 0), 0);
    }, 0);

    return { materials, subcontractors, labor, total: materials + subcontractors + labor };
  };

  // Calculate Operating Expenses
  const calculateOpEx = (period) => {
    const expenses = operatingExpenses.filter(e => isInPeriod(e.date, period));
    
    const byCategory = {};
    expenses.forEach(e => {
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += e.amount || 0;
    });

    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    return { byCategory, total };
  };

  // Current period calculations
  const currentRevenue = calculateRevenue(currentPeriod);
  const currentCOGS = calculateCOGS(currentPeriod);
  const currentOpEx = calculateOpEx(currentPeriod);
  const currentGrossProfit = currentRevenue - currentCOGS.total;
  const currentNetIncome = currentGrossProfit - currentOpEx.total;

  // Prior year calculations
  const priorRevenue = calculateRevenue(priorYearPeriod);
  const priorCOGS = calculateCOGS(priorYearPeriod);
  const priorOpEx = calculateOpEx(priorYearPeriod);
  const priorGrossProfit = priorRevenue - priorCOGS.total;
  const priorNetIncome = priorGrossProfit - priorOpEx.total;

  // Calculate metrics
  const grossMargin = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const netMargin = currentRevenue > 0 ? (currentNetIncome / currentRevenue) * 100 : 0;
  const laborMargin = currentRevenue > 0 ? ((currentRevenue - currentCOGS.labor) / currentRevenue) * 100 : 0;
  const materialsMargin = currentRevenue > 0 ? ((currentRevenue - currentCOGS.materials) / currentRevenue) * 100 : 0;
  const opexToRevenue = currentRevenue > 0 ? (currentOpEx.total / currentRevenue) * 100 : 0;

  // YoY Growth
  const revenueGrowth = priorRevenue > 0 ? ((currentRevenue - priorRevenue) / priorRevenue) * 100 : 0;
  const marginGrowth = priorGrossProfit > 0 ? ((currentGrossProfit - priorGrossProfit) / priorGrossProfit) * 100 : 0;
  const opexGrowth = priorOpEx.total > 0 ? ((currentOpEx.total - priorOpEx.total) / priorOpEx.total) * 100 : 0;

  const GrowthIndicator = ({ value }) => {
    if (value > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+{value.toFixed(1)}%</span>
        </div>
      );
    } else if (value < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">{value.toFixed(1)}%</span>
        </div>
      );
    }
    return <span className="text-sm text-gray-600">0.0%</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold heading" style={{ color: '#181E18' }}>Profit & Loss Statement</h2>
          <p style={{ color: '#5A7765' }}>Comprehensive P&L tracking with revenue recognition</p>
        </div>
        <Button variant="outline" className="border-[#C9C8AF]" style={{ color: '#5A7765' }}>
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Period Selector */}
      <Card className="bg-white border-[#C9C8AF]">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5" style={{ color: '#5A7765' }} />
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium" style={{ color: '#5A7765' }}>Period Type</label>
                <Select value={periodType} onValueChange={setPeriodType}>
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium" style={{ color: '#5A7765' }}>Period</label>
                <input
                  type="month"
                  value={format(selectedDate, 'yyyy-MM')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value + '-01'))}
                  className="w-full px-3 py-2 border border-[#C9C8AF] rounded-md bg-white"
                  style={{ color: '#181E18' }}
                />
              </div>
              <div className="flex items-end">
                <div className="text-sm">
                  <div style={{ color: '#5A7765' }}>Viewing</div>
                  <div className="font-medium" style={{ color: '#181E18' }}>
                    {format(currentPeriod.start, 'MMM d, yyyy')} - {format(currentPeriod.end, 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-[#C9C8AF]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm" style={{ color: '#5A7765' }}>Revenue</p>
                <p className="text-2xl font-bold" style={{ color: '#0E351F' }}>
                  {formatCurrency(currentRevenue)}
                </p>
              </div>
              <DollarSign className="w-8 h-8" style={{ color: '#0E351F' }} />
            </div>
            <div className="mt-2">
              <GrowthIndicator value={revenueGrowth} />
              <p className="text-xs mt-1" style={{ color: '#5A7765' }}>vs. prior year</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#C9C8AF]">
          <CardContent className="p-6">
            <div>
              <p className="text-sm" style={{ color: '#5A7765' }}>Gross Profit</p>
              <p className="text-2xl font-bold" style={{ color: currentGrossProfit >= 0 ? '#0E351F' : '#DC2626' }}>
                {formatCurrency(currentGrossProfit)}
              </p>
              <p className="text-sm mt-1" style={{ color: '#5A7765' }}>
                {grossMargin.toFixed(1)}% margin
              </p>
            </div>
            <div className="mt-2">
              <GrowthIndicator value={marginGrowth} />
              <p className="text-xs mt-1" style={{ color: '#5A7765' }}>margin growth YoY</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#C9C8AF]">
          <CardContent className="p-6">
            <div>
              <p className="text-sm" style={{ color: '#5A7765' }}>Net Income</p>
              <p className="text-2xl font-bold" style={{ color: currentNetIncome >= 0 ? '#0E351F' : '#DC2626' }}>
                {formatCurrency(currentNetIncome)}
              </p>
              <p className="text-sm mt-1" style={{ color: '#5A7765' }}>
                {netMargin.toFixed(1)}% margin
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#C9C8AF]">
          <CardContent className="p-6">
            <div>
              <p className="text-sm" style={{ color: '#5A7765' }}>Operating Expenses</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(currentOpEx.total)}
              </p>
              <p className="text-sm mt-1" style={{ color: '#5A7765' }}>
                {opexToRevenue.toFixed(1)}% of revenue
              </p>
            </div>
            <div className="mt-2">
              <GrowthIndicator value={opexGrowth} />
              <p className="text-xs mt-1" style={{ color: '#5A7765' }}>vs. prior year</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Period */}
        <Card className="bg-white border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle>Current Period P&L</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#C9C8AF]">
              {/* Revenue */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold" style={{ color: '#181E18' }}>Revenue</span>
                  <span className="font-semibold" style={{ color: '#0E351F' }}>
                    {formatCurrency(currentRevenue)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#5A7765' }}>
                  From {performanceObligations.filter(po => po.status === 'Completed' && isInPeriod(po.completion_date, currentPeriod)).length} completed performance obligations
                </p>
              </div>

              {/* COGS */}
              <div className="p-4 bg-[#F5F4F3]">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold" style={{ color: '#181E18' }}>Cost of Goods Sold</span>
                  <span className="font-semibold text-red-600">
                    ({formatCurrency(currentCOGS.total)})
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#5A7765' }}>Materials</span>
                    <span style={{ color: '#181E18' }}>{formatCurrency(currentCOGS.materials)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5A7765' }}>Subcontractors</span>
                    <span style={{ color: '#181E18' }}>{formatCurrency(currentCOGS.subcontractors)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#5A7765' }}>Direct Labor</span>
                    <span style={{ color: '#181E18' }}>{formatCurrency(currentCOGS.labor)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: '#181E18' }}>Gross Profit</span>
                  <span className="font-bold" style={{ color: currentGrossProfit >= 0 ? '#0E351F' : '#DC2626' }}>
                    {formatCurrency(currentGrossProfit)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#5A7765' }}>
                  {grossMargin.toFixed(1)}% margin
                </p>
              </div>

              {/* Operating Expenses */}
              <div className="p-4 bg-[#F5F4F3]">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold" style={{ color: '#181E18' }}>Operating Expenses</span>
                  <span className="font-semibold text-red-600">
                    ({formatCurrency(currentOpEx.total)})
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {Object.entries(currentOpEx.byCategory).map(([category, amount]) => (
                    <div key={category} className="flex justify-between">
                      <span style={{ color: '#5A7765' }}>{category}</span>
                      <span style={{ color: '#181E18' }}>{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Income */}
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg" style={{ color: '#181E18' }}>Net Income</span>
                  <span className="font-bold text-lg" style={{ color: currentNetIncome >= 0 ? '#0E351F' : '#DC2626' }}>
                    {formatCurrency(currentNetIncome)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: '#5A7765' }}>
                  {netMargin.toFixed(1)}% net margin
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prior Year Comparison */}
        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle>Prior Year Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#C9C8AF]">
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold" style={{ color: '#181E18' }}>Revenue</span>
                  <span className="font-semibold" style={{ color: '#181E18' }}>
                    {formatCurrency(priorRevenue)}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold" style={{ color: '#181E18' }}>COGS</span>
                  <span className="font-semibold" style={{ color: '#181E18' }}>
                    ({formatCurrency(priorCOGS.total)})
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: '#181E18' }}>Gross Profit</span>
                  <span className="font-bold" style={{ color: '#181E18' }}>
                    {formatCurrency(priorGrossProfit)}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold" style={{ color: '#181E18' }}>Operating Expenses</span>
                  <span className="font-semibold" style={{ color: '#181E18' }}>
                    ({formatCurrency(priorOpEx.total)})
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg" style={{ color: '#181E18' }}>Net Income</span>
                  <span className="font-bold text-lg" style={{ color: '#181E18' }}>
                    {formatCurrency(priorNetIncome)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card className="bg-white border-[#C9C8AF]">
        <CardHeader className="border-b border-[#C9C8AF]">
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium" style={{ color: '#5A7765' }}>Labor Margin</p>
              <p className="text-2xl font-bold" style={{ color: '#0E351F' }}>{laborMargin.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#5A7765' }}>Materials Margin</p>
              <p className="text-2xl font-bold" style={{ color: '#0E351F' }}>{materialsMargin.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#5A7765' }}>OpEx to Revenue</p>
              <p className="text-2xl font-bold text-orange-600">{opexToRevenue.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#5A7765' }}>COGS to Revenue</p>
              <p className="text-2xl font-bold" style={{ color: '#181E18' }}>
                {currentRevenue > 0 ? ((currentCOGS.total / currentRevenue) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}