
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Download, AlertCircle } from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subYears, format, isWithinInterval, parseISO } from "date-fns";

export default function ProfitLossTab() {
  const [periodType, setPeriodType] = React.useState('month');
  const [selectedDate, setSelectedDate] = React.useState(new Date());

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
    queryFn: () => base44.entities.OperatingExpense.list(),
  });

  const isInPeriod = (date, period) => {
    if (!date) return false;
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return isWithinInterval(dateObj, period);
    } catch {
      return false;
    }
  };

  // Calculate Revenue (from completed performance obligations)
  const completedObligations = performanceObligations.filter(po => 
    po.status === 'Completed' && po.completion_date && isInPeriod(po.completion_date, currentPeriod)
  );
  
  const revenue = completedObligations.reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  const priorYearCompletedObligations = performanceObligations.filter(po => 
    po.status === 'Completed' && po.completion_date && isInPeriod(po.completion_date, priorYearPeriod)
  );
  
  const priorYearRevenue = priorYearCompletedObligations.reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  // Define COGS categories (Direct Job Costs)
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

  // Calculate COGS from Bills (Direct Job Costs) - using approved_at date for recognition
  const cogsFromBills = bills.filter(b => 
    b.category && cogsCategories.includes(b.category) &&
    b.approved_at && isInPeriod(b.approved_at, currentPeriod) &&
    b.project_id // Must be linked to a project
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  // Calculate COGS from MaterialCosts (Direct Job Costs) - using date for recognition
  const cogsFromMaterials = materialCosts.filter(m => 
    m.approved && m.date && isInPeriod(m.date, currentPeriod) &&
    m.project_id // Must be linked to a project
  ).reduce((sum, m) => sum + (m.amount || 0), 0);

  const cogs = cogsFromBills + cogsFromMaterials;

  // Prior year COGS
  const priorYearCogsFromBills = bills.filter(b => 
    b.category && cogsCategories.includes(b.category) &&
    b.approved_at && isInPeriod(b.approved_at, priorYearPeriod) &&
    b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const priorYearCogsFromMaterials = materialCosts.filter(m => 
    m.approved && m.date && isInPeriod(m.date, priorYearPeriod) &&
    m.project_id
  ).reduce((sum, m) => sum + (m.amount || 0), 0);

  const priorYearCogs = priorYearCogsFromBills + priorYearCogsFromMaterials;

  // Gross Profit
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const priorYearGrossProfit = priorYearRevenue - priorYearCogs;
  const priorYearGrossMargin = priorYearRevenue > 0 ? (priorYearGrossProfit / priorYearRevenue) * 100 : 0;

  // Operating Expenses
  const opex = operatingExpenses.filter(oe => 
    oe.date && isInPeriod(oe.date, currentPeriod)
  ).reduce((sum, oe) => sum + (oe.amount || 0), 0);

  const priorYearOpex = operatingExpenses.filter(oe => 
    oe.date && isInPeriod(oe.date, priorYearPeriod)
  ).reduce((sum, oe) => sum + (oe.amount || 0), 0);

  // Operating Income (EBIT)
  const operatingIncome = grossProfit - opex;
  const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0;

  const priorYearOperatingIncome = priorYearGrossProfit - priorYearOpex;

  // Year over Year Growth
  const revenueGrowth = priorYearRevenue > 0 ? ((revenue - priorYearRevenue) / priorYearRevenue) * 100 : 0;
  const opexGrowth = priorYearOpex > 0 ? ((opex - priorYearOpex) / priorYearOpex) * 100 : 0;
  const marginGrowth = grossMargin - priorYearGrossMargin;

  // Expense Ratios
  const opexToRevenue = revenue > 0 ? (opex / revenue) * 100 : 0;
  const cogsToRevenue = revenue > 0 ? (cogs / revenue) * 100 : 0;

  // COGS Breakdown by Category
  const laborFieldCosts = bills.filter(b => 
    b.category === 'Labor - Field' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const laborSupervisionCosts = bills.filter(b => 
    b.category === 'Labor - Site Supervision' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const materialsCosts = cogsFromMaterials + bills.filter(b => 
    b.category === 'Materials' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const subcontractorCosts = bills.filter(b => 
    b.category === 'Subcontractor' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const equipmentCosts = bills.filter(b => 
    b.category === 'Equipment Rental' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const permitsCosts = bills.filter(b => 
    b.category === 'Permits & Inspections' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const wasteCosts = bills.filter(b => 
    b.category === 'Waste Disposal' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const utilitiesCosts = bills.filter(b => 
    b.category === 'Site Utilities' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const insuranceCosts = bills.filter(b => 
    b.category === 'Job-Specific Insurance' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const pmCosts = bills.filter(b => 
    b.category === 'Project Management' && b.approved_at && isInPeriod(b.approved_at, currentPeriod) && b.project_id
  ).reduce((sum, b) => sum + (b.amount || 0), 0);

  const totalLaborCosts = laborFieldCosts + laborSupervisionCosts + pmCosts;

  // Calculate cost-to-revenue ratios (what % of revenue each cost category consumes)
  const laborCostRatio = revenue > 0 ? (totalLaborCosts / revenue) * 100 : 0;
  const materialCostRatio = revenue > 0 ? (materialsCosts / revenue) * 100 : 0;
  const subcontractorCostRatio = revenue > 0 ? (subcontractorCosts / revenue) * 100 : 0;
  const equipmentCostRatio = revenue > 0 ? (equipmentCosts / revenue) * 100 : 0;
  
  // Total COGS as % of revenue (should equal 100% - gross margin %)
  const cogsCostRatio = revenue > 0 ? (cogs / revenue) * 100 : 0;

  // Check for bills not linked to projects (data quality warning)
  const billsWithoutProject = bills.filter(b => 
    !b.project_id && cogsCategories.includes(b.category) &&
    b.approved_at && isInPeriod(b.approved_at, currentPeriod)
  );

  const materialCostsWithoutProject = materialCosts.filter(m => 
    !m.project_id && m.approved && m.date && isInPeriod(m.date, currentPeriod)
  );

  const handleExport = () => {
    const csv = [
      ['PROFIT & LOSS STATEMENT'],
      [`Period: ${format(currentPeriod.start, 'MMM d, yyyy')} - ${format(currentPeriod.end, 'MMM d, yyyy')}`],
      [''],
      ['REVENUE'],
      ['Recognized Revenue', revenue],
      [''],
      ['COST OF GOODS SOLD (DIRECT JOB COSTS)'],
      ['Labor - Field', laborFieldCosts],
      ['Labor - Site Supervision', laborSupervisionCosts],
      ['Project Management', pmCosts],
      ['Materials', materialsCosts],
      ['Subcontractors', subcontractorCosts],
      ['Equipment Rental', equipmentCosts],
      ['Permits & Inspections', permitsCosts],
      ['Waste Disposal', wasteCosts],
      ['Site Utilities', utilitiesCosts],
      ['Job-Specific Insurance', insuranceCosts],
      ['Total COGS', cogs],
      [''],
      ['GROSS PROFIT', grossProfit],
      ['Gross Margin %', grossMargin.toFixed(2) + '%'],
      [''],
      ['OPERATING EXPENSES', opex],
      [''],
      ['OPERATING INCOME (EBIT)', operatingIncome],
      ['Operating Margin %', operatingMargin.toFixed(2) + '%'],
      [''],
      ['KEY METRICS'],
      ['Revenue Growth YoY', revenueGrowth.toFixed(2) + '%'],
      ['OpEx Growth YoY', opexGrowth.toFixed(2) + '%'],
      ['Margin Growth YoY', marginGrowth.toFixed(2) + '%'],
      ['COGS to Revenue Ratio', cogsCostRatio.toFixed(2) + '%'],
      ['OpEx to Revenue Ratio', opexToRevenue.toFixed(2) + '%'],
      ['Labor Cost Ratio', laborCostRatio.toFixed(2) + '%'],
      ['Material Cost Ratio', materialCostRatio.toFixed(2) + '%'],
      ['Subcontractor Cost Ratio', subcontractorCostRatio.toFixed(2) + '%'],
      ['Equipment Cost Ratio', equipmentCostRatio.toFixed(2) + '%']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PL_Statement_${format(currentPeriod.start, 'yyyy-MM-dd')}.csv`;
    a.click();
  };

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
    return <span className="text-sm text-gray-600">0%</span>;
  };

  return (
    <div className="space-y-6">
      {/* Data Quality Warning */}
      {(billsWithoutProject.length > 0 || materialCostsWithoutProject.length > 0) && (
        <Card className="bg-orange-50 border-orange-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 mb-1">⚠️ Data Quality Warning</p>
                <p className="text-sm text-orange-800">
                  {billsWithoutProject.length > 0 && (
                    <span>{billsWithoutProject.length} bill(s) in COGS categories are not linked to a project. </span>
                  )}
                  {materialCostsWithoutProject.length > 0 && (
                    <span>{materialCostsWithoutProject.length} material cost(s) are not linked to a project. </span>
                  )}
                  These costs are excluded from COGS. Please link them to projects for accurate reporting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-40 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="month"
            value={format(selectedDate, 'yyyy-MM')}
            onChange={(e) => setSelectedDate(new Date(e.target.value + '-01'))}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          />

          <div className="text-sm text-gray-600">
            {format(currentPeriod.start, 'MMM d, yyyy')} - {format(currentPeriod.end, 'MMM d, yyyy')}
          </div>
        </div>

        <Button
          onClick={handleExport}
          variant="outline"
          className="border-gray-300 text-gray-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue)}</p>
                <GrowthIndicator value={revenueGrowth} />
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Gross Profit</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(grossProfit)}</p>
                <p className="text-sm text-gray-600">{grossMargin.toFixed(1)}% margin</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Operating Income</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(operatingIncome)}</p>
                <p className="text-sm text-gray-600">{operatingMargin.toFixed(1)}% margin</p>
              </div>
              <TrendingUp className="w-8 h-8 text-[#0E351F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Direct Job Costs</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(cogs)}</p>
                <p className="text-sm text-gray-600">{cogsToRevenue.toFixed(1)}% of revenue</p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>Income Statement</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Revenue Section */}
            <div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-semibold text-gray-900">REVENUE</span>
                <span className="font-semibold text-gray-900">{formatCurrency(revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 pl-4 text-sm text-gray-600">
                <span>Performance Obligations Completed</span>
                <span>{completedObligations.length} obligations</span>
              </div>
            </div>

            {/* COGS Section */}
            <div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-semibold text-gray-900">COST OF GOODS SOLD / DIRECT JOB COSTS</span>
                <span className="font-semibold text-gray-900">{formatCurrency(cogs)}</span>
              </div>
              <div className="pl-4 space-y-1">
                <div className="text-xs font-semibold text-gray-700 pt-2 pb-1">Labor</div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Field Labor</span>
                  <span>{formatCurrency(laborFieldCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Site Supervision</span>
                  <span>{formatCurrency(laborSupervisionCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Project Management</span>
                  <span>{formatCurrency(pmCosts)}</span>
                </div>
                
                <div className="text-xs font-semibold text-gray-700 pt-2 pb-1">Direct Costs</div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Materials</span>
                  <span>{formatCurrency(materialsCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Subcontractors</span>
                  <span>{formatCurrency(subcontractorCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Equipment Rental</span>
                  <span>{formatCurrency(equipmentCosts)}</span>
                </div>
                
                <div className="text-xs font-semibold text-gray-700 pt-2 pb-1">Other Direct Costs</div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Permits & Inspections</span>
                  <span>{formatCurrency(permitsCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Waste Disposal</span>
                  <span>{formatCurrency(wasteCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Site Utilities</span>
                  <span>{formatCurrency(utilitiesCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-sm text-gray-600 pl-2">
                  <span>Job-Specific Insurance</span>
                  <span>{formatCurrency(insuranceCosts)}</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-[#E8E7DD] p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">GROSS PROFIT</span>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(grossProfit)}</div>
                  <div className="text-sm text-gray-600">{grossMargin.toFixed(1)}% margin</div>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-semibold text-gray-900">OPERATING EXPENSES</span>
                <span className="font-semibold text-gray-900">{formatCurrency(opex)}</span>
              </div>
              <div className="flex justify-between items-center py-2 pl-4 text-sm text-gray-600">
                <span>% of Revenue</span>
                <span>{opexToRevenue.toFixed(1)}%</span>
              </div>
            </div>

            {/* Operating Income */}
            <div className="bg-[#0E351F] text-white p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="font-bold">OPERATING INCOME (EBIT)</span>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(operatingIncome)}</div>
                  <div className="text-sm opacity-80">{operatingMargin.toFixed(1)}% margin</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics & Ratios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Year-over-Year Growth</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Revenue Growth</span>
              <GrowthIndicator value={revenueGrowth} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Margin Growth</span>
              <GrowthIndicator value={marginGrowth} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">OpEx Growth</span>
              <GrowthIndicator value={opexGrowth} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Cost-to-Revenue Ratios</CardTitle>
            <p className="text-xs text-gray-600 mt-1">What % of revenue each cost category consumes</p>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total COGS</span>
              <span className="font-semibold text-gray-900">{cogsCostRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pl-4 text-sm border-l-2 border-gray-200">
              <span className="text-gray-600">Labor (All)</span>
              <span className="font-medium text-gray-700">{laborCostRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pl-4 text-sm border-l-2 border-gray-200">
              <span className="text-gray-600">Materials</span>
              <span className="font-medium text-gray-700">{materialCostRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pl-4 text-sm border-l-2 border-gray-200">
              <span className="text-gray-600">Subcontractors</span>
              <span className="font-medium text-gray-700">{subcontractorCostRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pl-4 text-sm border-l-2 border-gray-200">
              <span className="text-gray-600">Equipment</span>
              <span className="font-medium text-gray-700">{equipmentCostRatio.toFixed(1)}%</span>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Operating Expenses</span>
                <span className="font-semibold text-gray-900">{opexToRevenue.toFixed(1)}%</span>
              </div>
            </div>
            <div className="bg-[#E8E7DD] p-3 rounded -mx-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">Gross Margin</span>
                <span className="font-bold text-[#0E351F]">{grossMargin.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
