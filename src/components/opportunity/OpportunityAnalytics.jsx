import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  XCircle, 
  DollarSign,
  BarChart3,
  Award,
  Ban
} from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function OpportunityAnalytics({ opportunities }) {
  const analytics = React.useMemo(() => {
    const total = opportunities.length;
    
    // Count by stage
    const awarded = opportunities.filter(o => o.stage === 'Awarded').length;
    const lost = opportunities.filter(o => o.stage === 'Lost').length;
    const noLongerBidding = opportunities.filter(o => o.stage === 'No Longer Bidding').length;
    const active = opportunities.filter(o => ['Lead', 'Qualified', 'Bidding'].includes(o.stage)).length;
    
    // Success rate (awarded / (awarded + lost + no longer bidding))
    const closed = awarded + lost + noLongerBidding;
    const successRate = closed > 0 ? (awarded / closed * 100) : 0;
    
    // Values
    const totalEstimatedValue = opportunities.reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    const awardedValue = opportunities
      .filter(o => o.stage === 'Awarded')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    const lostValue = opportunities
      .filter(o => o.stage === 'Lost')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    const activeValue = opportunities
      .filter(o => ['Lead', 'Qualified', 'Bidding'].includes(o.stage))
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

    // Average values
    const avgValue = total > 0 ? totalEstimatedValue / total : 0;
    const avgAwardedValue = awarded > 0 ? awardedValue / awarded : 0;

    // By value bracket
    const brackets = [
      { name: '< $500K', min: 0, max: 500000 },
      { name: '$500K - $1M', min: 500000, max: 1000000 },
      { name: '$1M - $5M', min: 1000000, max: 5000000 },
      { name: '> $5M', min: 5000000, max: Infinity },
    ];

    const bracketStats = brackets.map(bracket => {
      const inBracket = opportunities.filter(o => 
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
      total,
      awarded,
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
      bracketStats
    };
  }, [opportunities]);

  // Pie chart data for stage distribution
  const stageDistribution = [
    { name: 'Active Pipeline', value: analytics.active, color: '#3B5B48' },
    { name: 'Awarded', value: analytics.awarded, color: '#0E351F' },
    { name: 'Lost', value: analytics.lost, color: '#EF4444' },
    { name: 'No Longer Bidding', value: analytics.noLongerBidding, color: '#9FA097' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
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
        {/* Stage Distribution */}
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

        {/* Win Rate by Value Bracket */}
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
                  <span className="text-gray-700">Awarded</span>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{analytics.awarded}</p>
                    <p className="text-xs text-gray-600">{formatCurrency(analytics.awardedValue)}</p>
                  </div>
                </div>
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

      {/* Quick Stats */}
      {analytics.closed === 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-blue-600" />
            <p className="text-blue-900 font-medium mb-1">
              Start Closing Opportunities
            </p>
            <p className="text-sm text-blue-700">
              Mark opportunities as Awarded, Lost, or No Longer Bidding to see detailed analytics and success metrics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}