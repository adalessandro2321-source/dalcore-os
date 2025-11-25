import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";

const COLORS = ['#0E351F', '#2A6B5A', '#4B9B7C', '#6FC99E', '#93E7C0', '#B7F5E2'];

export default function BudgetVsActualReport({ lineItems = [], projectName = 'Project' }) {
  // Prepare chart data
  const chartData = lineItems.map(item => ({
    name: item.category?.split(' - ')[0] || 'Other',
    fullName: item.category,
    description: item.description,
    budget: item.revised_amount || item.budgeted_amount || 0,
    actual: item.actual_amount || 0,
    variance: (item.revised_amount || item.budgeted_amount || 0) - (item.actual_amount || 0)
  }));

  // Group by category for pie chart
  const categoryTotals = lineItems.reduce((acc, item) => {
    const cat = item.category?.split(' - ')[0] || 'Other';
    if (!acc[cat]) {
      acc[cat] = { budget: 0, actual: 0 };
    }
    acc[cat].budget += item.revised_amount || item.budgeted_amount || 0;
    acc[cat].actual += item.actual_amount || 0;
    return acc;
  }, {});

  const pieData = Object.entries(categoryTotals).map(([name, values]) => ({
    name,
    value: values.actual
  })).filter(d => d.value > 0);

  // Calculate overall metrics
  const totals = {
    budget: lineItems.reduce((sum, i) => sum + (i.revised_amount || i.budgeted_amount || 0), 0),
    actual: lineItems.reduce((sum, i) => sum + (i.actual_amount || 0), 0),
  };
  totals.variance = totals.budget - totals.actual;
  totals.variancePercent = totals.budget > 0 ? (totals.variance / totals.budget) * 100 : 0;

  // Find problem areas (over budget)
  const overBudgetItems = lineItems.filter(item => {
    const budget = item.revised_amount || item.budgeted_amount || 0;
    const actual = item.actual_amount || 0;
    return actual > budget && budget > 0;
  }).sort((a, b) => {
    const aOver = (a.actual_amount || 0) - (a.revised_amount || a.budgeted_amount || 0);
    const bOver = (b.actual_amount || 0) - (b.revised_amount || b.budgeted_amount || 0);
    return bOver - aOver;
  });

  // Find savings (under budget)
  const underBudgetItems = lineItems.filter(item => {
    const budget = item.revised_amount || item.budgeted_amount || 0;
    const actual = item.actual_amount || 0;
    return actual < budget && actual > 0;
  }).sort((a, b) => {
    const aUnder = (a.revised_amount || a.budgeted_amount || 0) - (a.actual_amount || 0);
    const bUnder = (b.revised_amount || b.budgeted_amount || 0) - (b.actual_amount || 0);
    return bUnder - aUnder;
  });

  const exportReport = () => {
    const report = [
      `BUDGET VS ACTUAL REPORT`,
      `Project: ${projectName}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'SUMMARY',
      `Total Budget: ${formatCurrency(totals.budget)}`,
      `Total Actual: ${formatCurrency(totals.actual)}`,
      `Variance: ${formatCurrency(totals.variance)} (${totals.variancePercent.toFixed(1)}%)`,
      '',
      'LINE ITEM DETAILS',
      'Category,Description,Budget,Actual,Variance,Variance %',
      ...lineItems.map(item => {
        const budget = item.revised_amount || item.budgeted_amount || 0;
        const actual = item.actual_amount || 0;
        const variance = budget - actual;
        const variancePercent = budget > 0 ? ((variance / budget) * 100).toFixed(1) : '0';
        return `${item.category},"${item.description}",${budget},${actual},${variance},${variancePercent}%`;
      }),
      '',
      `TOTALS,,${totals.budget},${totals.actual},${totals.variance},${totals.variancePercent.toFixed(1)}%`
    ].join('\n');

    const blob = new Blob([report], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_vs_actual_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (lineItems.length === 0) {
    return (
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-8 text-center text-gray-500">
          <p>No budget data available for reporting.</p>
          <p className="text-sm mt-1">Add budget line items to generate reports.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual Report</h3>
        <Button onClick={exportReport} variant="outline" className="border-gray-300">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 mb-1">Total Budget</p>
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.budget)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-700 mb-1">Total Actual</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.actual)}</p>
          </CardContent>
        </Card>
        <Card className={totals.variance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="p-4">
            <p className={`text-xs mb-1 ${totals.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Total Variance
            </p>
            <p className={`text-2xl font-bold ${totals.variance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
            </p>
          </CardContent>
        </Card>
        <Card className={totals.variance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className={`text-xs mb-1 ${totals.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Status
              </p>
              <p className={`text-lg font-bold ${totals.variance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {totals.variancePercent >= 0 ? 'Under' : 'Over'} Budget
              </p>
            </div>
            {totals.variance >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-base">Budget vs Actual by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}
                />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#0E351F" />
                <Bar dataKey="actual" name="Actual" fill="#4B9B7C" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-base">Actual Spending Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Problem Areas & Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Over Budget */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              Over Budget Items ({overBudgetItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {overBudgetItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No items over budget 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {overBudgetItems.slice(0, 5).map((item, idx) => {
                  const budget = item.revised_amount || item.budgeted_amount || 0;
                  const actual = item.actual_amount || 0;
                  const over = actual - budget;
                  const overPercent = budget > 0 ? (over / budget) * 100 : 0;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">
                          +{formatCurrency(over)}
                        </p>
                        <p className="text-xs text-red-500">
                          {overPercent.toFixed(1)}% over
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Under Budget */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-base flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              Under Budget Items ({underBudgetItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {underBudgetItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No savings identified yet
              </p>
            ) : (
              <div className="space-y-3">
                {underBudgetItems.slice(0, 5).map((item, idx) => {
                  const budget = item.revised_amount || item.budgeted_amount || 0;
                  const actual = item.actual_amount || 0;
                  const savings = budget - actual;
                  const savingsPercent = budget > 0 ? (savings / budget) * 100 : 0;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600">
                          -{formatCurrency(savings)}
                        </p>
                        <p className="text-xs text-green-500">
                          {savingsPercent.toFixed(1)}% saved
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-base">Detailed Variance Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Budget</th>
                  <th className="text-right p-3 font-medium">Actual</th>
                  <th className="text-right p-3 font-medium">Variance</th>
                  <th className="text-right p-3 font-medium">Variance %</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const budget = item.revised_amount || item.budgeted_amount || 0;
                  const actual = item.actual_amount || 0;
                  const variance = budget - actual;
                  const variancePercent = budget > 0 ? (variance / budget) * 100 : 0;
                  
                  return (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </td>
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right">{formatCurrency(budget)}</td>
                      <td className="p-3 text-right">{formatCurrency(actual)}</td>
                      <td className={`p-3 text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </td>
                      <td className={`p-3 text-right ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        {variance > 0 ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Under</Badge>
                        ) : variance < 0 ? (
                          <Badge className="bg-red-100 text-red-800 text-xs">Over</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 text-xs">On Track</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td colSpan={2} className="p-3">TOTALS</td>
                  <td className="p-3 text-right">{formatCurrency(totals.budget)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.actual)}</td>
                  <td className={`p-3 text-right ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
                  </td>
                  <td className={`p-3 text-right ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.variancePercent >= 0 ? '+' : ''}{totals.variancePercent.toFixed(1)}%
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}