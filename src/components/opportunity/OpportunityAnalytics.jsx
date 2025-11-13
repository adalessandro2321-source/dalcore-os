import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  XCircle, 
  DollarSign,
  BarChart3,
  Award,
  Loader2
} from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function OpportunityAnalytics({ opportunities }) {
  // Fetch ALL projects - this is key!
  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects;
    },
  });

  // Fetch ALL change orders
  const { data: allChangeOrders = [], isLoading: changeOrdersLoading } = useQuery({
    queryKey: ['changeOrders'],
    queryFn: async () => {
      const orders = await base44.entities.ChangeOrder.list();
      return orders;
    },
  });

  const analytics = React.useMemo(() => {
    // Helper to calculate project final value with change orders
    const getProjectFinalValue = (projectId, baseValue) => {
      const approvedCOs = allChangeOrders.filter(
        co => co.project_id === projectId && co.status === 'Approved'
      );
      const coValue = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
      return (baseValue || 0) + coValue;
    };

    // Get ALL Active and Completed projects - these count as wins!
    const activeCompletedProjects = allProjects.filter(p => 
      p.status === 'Active' || p.status === 'Completed'
    );

    // Calculate total value of Active/Completed projects with change orders
    let retroactiveWinsValue = 0;
    const projectDetails = [];
    
    activeCompletedProjects.forEach(project => {
      const finalValue = getProjectFinalValue(project.id, project.contract_value || 0);
      retroactiveWinsValue += finalValue;
      projectDetails.push({
        id: project.id,
        name: project.name,
        status: project.status,
        baseValue: project.contract_value || 0,
        finalValue: finalValue
      });
    });

    // Count opportunities by stage (excluding Under Contract as they're now projects)
    const activeOpportunities = opportunities.filter(opp => opp.stage !== 'Under Contract');
    
    const awarded = activeOpportunities.filter(o => o.stage === 'Awarded').length;
    const lost = activeOpportunities.filter(o => o.stage === 'Lost').length;
    const noLongerBidding = activeOpportunities.filter(o => o.stage === 'No Longer Bidding').length;
    const active = activeOpportunities.filter(o => ['Lead', 'Qualified', 'Bidding'].includes(o.stage)).length;
    
    // TOTAL WINS = Awarded opportunities + ALL Active/Completed projects
    const totalWins = awarded + activeCompletedProjects.length;
    
    // Success rate
    const closed = totalWins + lost + noLongerBidding;
    const successRate = closed > 0 ? (totalWins / closed * 100) : 0;
    
    // Calculate values
    const totalEstimatedValue = activeOpportunities.reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    
    // Awarded value = awarded opportunities + all Active/Completed project values
    let awardedValue = retroactiveWinsValue; // Start with all project values
    
    activeOpportunities.filter(o => o.stage === 'Awarded').forEach(opp => {
      awardedValue += opp.estimated_value || 0;
    });

    const lostValue = activeOpportunities
      .filter(o => o.stage === 'Lost')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0);
      
    const activeValue = activeOpportunities
      .filter(o => ['Lead', 'Qualified', 'Bidding'].includes(o.stage))
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

    // Averages
    const avgValue = activeOpportunities.length > 0 ? totalEstimatedValue / activeOpportunities.length : 0;
    const avgAwardedValue = totalWins > 0 ? awardedValue / totalWins : 0;

    // By value bracket
    const brackets = [
      { name: '< $500K', min: 0, max: 500000 },
      { name: '$500K - $1M', min: 500000, max: 1000000 },
      { name: '$1M - $5M', min: 1000000, max: 5000000 },
      { name: '> $5M', min: 5000000, max: Infinity },
    ];

    const bracketStats = brackets.map(bracket => {
      const inBracket = activeOpportunities.filter(o => 
        (o.estimated_value || 0) >= bracket.min && (o.estimated_value || 0) < bracket.max
      );
      const awardedInBracket = inBracket.filter(o => o.stage === 'Awarded').length;
      const closedInBracket = inBracket.filter(o => 
        ['Awarded', 'Lost', 'No Longer Bidding'].includes(o.stage)
      ).length;
      
      return {
        name: bracket.name,
        total: inBracket.length,
        awarded: awardedInBracket,
        winRate: closedInBracket > 0 ? (awardedInBracket / closedInBracket * 100) : 0
      };
    }).filter(b => b.total > 0);

    return {
      total: activeOpportunities.length,
      awarded: totalWins,
      lost,
      noLongerBidding,
      active,
      closed,
      successRate,
      totalEstimatedValue,
      awardedValue,
      lostValue,
      activeValue,
      avgValue,
      avgAwardedValue,
      bracketStats,
      retroactiveWinsCount: activeCompletedProjects.length,
      retroactiveWinsValue,
      projectDetails // Include project details for debugging
    };
  }, [opportunities, allProjects, allChangeOrders]);

  // Show loading state
  if (projectsLoading || changeOrdersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B4D3E]" />
        <p className="text-gray-600 ml-3">Loading analytics data...</p>
      </div>
    );
  }

  // Pie chart data
  const stageDistribution = [
    { name: 'Active Pipeline', value: analytics.active, color: '#3B5B48' },
    { name: 'Awarded (Total)', value: analytics.awarded, color: '#0E351F' },
    { name: 'Lost', value: analytics.lost, color: '#EF4444' },
    { name: 'No Longer Bidding', value: analytics.noLongerBidding, color: '#9FA097' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Debug Info - Shows data being used */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-4">
          <div className="text-sm space-y-1">
            <p className="font-semibold text-purple-900">📊 Data Summary:</p>
            <p className="text-purple-800">• Total Projects in System: {allProjects.length}</p>
            <p className="text-purple-800">• Active Projects: {allProjects.filter(p => p.status === 'Active').length}</p>
            <p className="text-purple-800">• Completed Projects: {allProjects.filter(p => p.status === 'Completed').length}</p>
            <p className="text-purple-800">• Total Change Orders: {allChangeOrders.length}</p>
            <p className="text-purple-800">• Approved Change Orders: {allChangeOrders.filter(co => co.status === 'Approved').length}</p>
            <p className="text-purple-800">• Opportunities (excl. Under Contract): {opportunities.filter(o => o.stage !== 'Under Contract').length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Retroactive Wins Banner - ALWAYS show if there are Active/Completed projects */}
      {analytics.retroactiveWinsCount > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-300">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-blue-900 mb-2">
                  🎉 {analytics.retroactiveWinsCount} Active/Completed Projects Counted as Wins
                </p>
                <p className="text-blue-700 mb-3">
                  These projects are automatically included in your win rate and awarded value calculations.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 mb-1">Total Contract Value</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(analytics.retroactiveWinsValue)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Includes approved change orders
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 mb-1">Project Breakdown</p>
                    <p className="text-sm text-blue-800">
                      Active: {allProjects.filter(p => p.status === 'Active').length} • 
                      Completed: {allProjects.filter(p => p.status === 'Completed').length}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      All counted toward success rate
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Details (for verification) */}
      {analytics.projectDetails && analytics.projectDetails.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-lg">Active/Completed Projects Included as Wins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Base Contract</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Final Value (w/ COs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.projectDetails.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{project.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          project.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(project.baseValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(project.finalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right font-semibold text-gray-900">
                      Total Value (all projects):
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                      {formatCurrency(analytics.retroactiveWinsValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {analytics.successRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {analytics.awarded} won / {analytics.closed} closed
                </p>
              </div>
              <Award className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Pipeline Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(analytics.activeValue)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {analytics.active} active opportunities
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Value Awarded</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.awardedValue)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Avg: {formatCurrency(analytics.avgAwardedValue)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Value Lost</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(analytics.lostValue)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {analytics.lost} lost + {analytics.noLongerBidding} declined
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-lg">Opportunity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {stageDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-lg">Win Rate by Project Size</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {analytics.bracketStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.bracketStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', fill: '#6B7280' }}
                  />
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(1)}%`}
                    contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="winRate" fill="#0E351F" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No closed opportunities to analyze
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Active Pipeline
              </h3>
              <div className="space-y-2 text-sm">
                {['Lead', 'Qualified', 'Bidding'].map(stage => {
                  const count = opportunities.filter(o => o.stage === stage).length;
                  const value = opportunities
                    .filter(o => o.stage === stage)
                    .reduce((sum, o) => sum + (o.estimated_value || 0), 0);
                  
                  return count > 0 ? (
                    <div key={stage} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-gray-700">{stage}</span>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-600">{formatCurrency(value)}</p>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-green-600" />
                Won
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-gray-700">Total Wins</span>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{analytics.awarded}</p>
                    <p className="text-xs text-gray-600">{formatCurrency(analytics.awardedValue)}</p>
                  </div>
                </div>
                {analytics.retroactiveWinsCount > 0 && (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs text-blue-800 mb-1">
                      ✅ {analytics.retroactiveWinsCount} Active/Completed projects
                    </p>
                    <p className="text-xs font-semibold text-blue-900">
                      {formatCurrency(analytics.retroactiveWinsValue)}
                    </p>
                  </div>
                )}
                <div className="p-3 bg-green-100 rounded">
                  <p className="text-xs text-gray-600 mb-1">Average Award Value</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(analytics.avgAwardedValue)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                Not Won
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-gray-700">Lost to Competitor</span>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{analytics.lost}</p>
                    <p className="text-xs text-gray-600">{formatCurrency(analytics.lostValue)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Declined to Bid</span>
                  <div className="text-right">
                    <p className="font-semibold text-gray-600">{analytics.noLongerBidding}</p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(
                        opportunities
                          .filter(o => o.stage === 'No Longer Bidding')
                          .reduce((sum, o) => sum + (o.estimated_value || 0), 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg">Performance Insights</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">Win Rate</p>
                  <p className="text-2xl font-bold text-green-700">
                    {analytics.successRate.toFixed(1)}%
                  </p>
                </div>
              </div>
              <p className="text-xs text-green-800">
                Winning {analytics.awarded} out of {analytics.closed} decided opportunities
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Avg Opportunity</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(analytics.avgValue)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-800">
                Average across all {analytics.total} opportunities
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">Pipeline Health</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {analytics.active}
                  </p>
                </div>
              </div>
              <p className="text-xs text-purple-800">
                Active opportunities worth {formatCurrency(analytics.activeValue)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}