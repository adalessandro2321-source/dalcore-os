import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Loader2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Lightbulb,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";

export default function BudgetAIAnalysis({ projectId, project, budget }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', projectId],
    queryFn: () => base44.entities.Bill.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: materialCosts = [] } = useQuery({
    queryKey: ['materialCosts', projectId],
    queryFn: () => base44.entities.MaterialCost.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: () => base44.entities.ChangeOrder.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', projectId],
    queryFn: () => base44.entities.Invoice.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const runAnalysis = async () => {
    if (!budget) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      // Prepare comprehensive budget data
      const analysisData = {
        project: {
          name: project.name,
          number: project.number,
          status: project.status,
          percent_complete: project.percent_complete || 0,
          contract_value: budget.revised_contract_value || 0,
          original_contract: budget.original_contract_value || 0,
          approved_cos: budget.approved_co_value || 0
        },
        budget: {
          forecast_at_completion: budget.forecast_at_completion || 0,
          actual_costs: budget.actual_costs || 0,
          committed_costs: budget.committed_costs || 0,
          uncommitted_forecast: budget.uncommitted_forecast || 0,
          cost_to_complete: budget.cost_to_complete || 0,
          gp_forecast: budget.gp_forecast || 0,
          gp_margin_percent: budget.revised_contract_value > 0 
            ? ((budget.gp_forecast / budget.revised_contract_value) * 100).toFixed(2)
            : 0,
          percent_complete_cost: budget.percent_complete_cost || 0,
          ar_open: budget.ar_open || 0,
          ap_open: budget.ap_open || 0
        },
        cogs_breakdown: {
          labor_field: budget.cogs_labor_field || 0,
          labor_supervision: budget.cogs_labor_supervision || 0,
          project_management: budget.cogs_project_management || 0,
          materials: budget.cogs_materials || 0,
          subcontractors: budget.cogs_subcontractors || 0,
          equipment: budget.cogs_equipment || 0,
          permits: budget.cogs_permits || 0,
          waste: budget.cogs_waste || 0,
          utilities: budget.cogs_utilities || 0,
          insurance: budget.cogs_insurance || 0,
          total: budget.cogs_total || 0
        },
        baseline_comparison: budget.baseline_total_cost ? {
          baseline_cost: budget.baseline_total_cost,
          baseline_gp: budget.baseline_gp || 0,
          baseline_labor: budget.baseline_labor_cost || 0,
          baseline_materials: budget.baseline_materials_cost || 0,
          baseline_subcontractors: budget.baseline_subcontractor_cost || 0,
          cost_variance: (budget.forecast_at_completion || 0) - (budget.baseline_total_cost || 0),
          gp_variance: (budget.gp_forecast || 0) - (budget.baseline_gp || 0)
        } : null,
        spend_velocity: {
          days_elapsed: project.start_date 
            ? Math.floor((new Date() - new Date(project.start_date)) / (1000 * 60 * 60 * 24))
            : 0,
          spend_per_day: project.start_date && budget.actual_costs
            ? (budget.actual_costs / Math.max(1, Math.floor((new Date() - new Date(project.start_date)) / (1000 * 60 * 60 * 24))))
            : 0,
          projected_completion_days: project.target_completion_date
            ? Math.floor((new Date(project.target_completion_date) - new Date()) / (1000 * 60 * 60 * 24))
            : 0
        },
        recent_activity: {
          recent_bills: bills.slice(0, 10).map(b => ({
            vendor: b.vendor_id,
            amount: b.amount,
            category: b.category,
            status: b.status,
            date: b.created_date
          })),
          recent_materials: materialCosts.slice(0, 10).map(m => ({
            item: m.item,
            amount: m.amount,
            approved: m.approved,
            date: m.date
          })),
          pending_change_orders: changeOrders.filter(co => co.status === 'Pending'),
          total_bills: bills.length,
          total_material_costs: materialCosts.length,
          total_cos: changeOrders.length
        },
        cash_flow: {
          ar_invoiced: budget.ar_invoiced || 0,
          ar_collected: budget.ar_collected || 0,
          ar_open: budget.ar_open || 0,
          ap_open: budget.ap_open || 0,
          cash_gap: (budget.ar_open || 0) - (budget.ap_open || 0)
        }
      };

      const prompt = `You are an expert construction financial analyst specializing in project cost management and budget optimization.

Analyze this project's financial health and provide actionable insights:

PROJECT FINANCIAL DATA:
${JSON.stringify(analysisData, null, 2)}

Perform a comprehensive budget health analysis covering:

1. BUDGET HEALTH SCORE (0-100)
   - Overall financial health assessment
   - Key factors affecting the score
   - Trajectory (improving/declining/stable)

2. COST OVERRUN FORECAST
   - Likelihood of cost overruns (High/Medium/Low)
   - Categories at risk of overruns
   - Projected overrun amount if current trends continue
   - Early warning indicators

3. VARIANCE ANALYSIS
   - Budget vs actual spending by category
   - Identify categories significantly over/under budget
   - Explain variances (if baseline data available)
   - Cost trends and patterns

4. COST SAVINGS OPPORTUNITIES
   - Specific areas to reduce costs
   - Estimated savings potential
   - Implementation difficulty (Easy/Medium/Hard)
   - Priority level (High/Medium/Low)

5. CASH FLOW ALERTS
   - AR/AP imbalances
   - Cash flow concerns
   - Payment timing recommendations

6. PROACTIVE RECOMMENDATIONS
   - Immediate actions to take
   - Categories to monitor closely
   - Budget adjustments to consider
   - Risk mitigation strategies

Consider:
- Spend velocity vs project completion %
- Committed vs actual costs gap
- COGS category breakdown
- Change order impacts
- Baseline estimate variances (if available)

Provide specific, actionable insights with dollar amounts and percentages.

Respond in JSON:
{
  "health_score": number (0-100),
  "health_status": "Healthy/At Risk/Critical",
  "health_summary": "brief executive summary",
  "trajectory": "Improving/Stable/Declining",
  "key_concerns": ["concern 1", "concern 2"],
  "overrun_forecast": {
    "likelihood": "High/Medium/Low",
    "projected_amount": number,
    "categories_at_risk": [
      {
        "category": "category name",
        "current_spend": number,
        "projected_spend": number,
        "variance": number,
        "concern_level": "High/Medium/Low"
      }
    ],
    "early_warnings": ["warning 1", "warning 2"]
  },
  "variance_analysis": {
    "cost_vs_progress": {
      "percent_spent": number,
      "percent_complete": number,
      "variance": number,
      "interpretation": "ahead of schedule/on track/behind schedule"
    },
    "baseline_variances": budget.baseline_total_cost ? [
      {
        "category": "category name",
        "baseline": number,
        "actual_forecast": number,
        "variance_amount": number,
        "variance_percent": number,
        "explanation": "why this variance"
      }
    ] : null,
    "top_variances": [
      {
        "category": "category name",
        "issue": "what's wrong",
        "impact": "dollar impact"
      }
    ]
  },
  "cost_savings": [
    {
      "category": "category name",
      "opportunity": "specific savings opportunity",
      "estimated_savings": number,
      "implementation": "Easy/Medium/Hard",
      "priority": "High/Medium/Low",
      "action_steps": ["step 1", "step 2"]
    }
  ],
  "cash_flow_alerts": [
    {
      "type": "AR/AP/Gap",
      "severity": "High/Medium/Low",
      "description": "what the issue is",
      "amount": number,
      "recommendation": "what to do"
    }
  ],
  "immediate_actions": [
    {
      "priority": number (1-5),
      "action": "specific action to take",
      "category": "category affected",
      "expected_impact": "what this will achieve",
      "urgency": "This Week/This Month/Next Quarter"
    }
  ],
  "monitor_categories": [
    {
      "category": "category name",
      "reason": "why monitor this",
      "threshold": "what to watch for"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            health_score: { type: "number" },
            health_status: { type: "string" },
            health_summary: { type: "string" },
            trajectory: { type: "string" },
            key_concerns: { type: "array", items: { type: "string" } },
            overrun_forecast: {
              type: "object",
              properties: {
                likelihood: { type: "string" },
                projected_amount: { type: "number" },
                categories_at_risk: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      current_spend: { type: "number" },
                      projected_spend: { type: "number" },
                      variance: { type: "number" },
                      concern_level: { type: "string" }
                    }
                  }
                },
                early_warnings: { type: "array", items: { type: "string" } }
              }
            },
            variance_analysis: {
              type: "object",
              properties: {
                cost_vs_progress: {
                  type: "object",
                  properties: {
                    percent_spent: { type: "number" },
                    percent_complete: { type: "number" },
                    variance: { type: "number" },
                    interpretation: { type: "string" }
                  }
                },
                baseline_variances: {
                  anyOf: [
                    {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          category: { type: "string" },
                          baseline: { type: "number" },
                          actual_forecast: { type: "number" },
                          variance_amount: { type: "number" },
                          variance_percent: { type: "number" },
                          explanation: { type: "string" }
                        }
                      }
                    },
                    { type: "null" }
                  ]
                },
                top_variances: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      issue: { type: "string" },
                      impact: { type: "string" }
                    }
                  }
                }
              }
            },
            cost_savings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  opportunity: { type: "string" },
                  estimated_savings: { type: "number" },
                  implementation: { type: "string" },
                  priority: { type: "string" },
                  action_steps: { type: "array", items: { type: "string" } }
                }
              }
            },
            cash_flow_alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  amount: { type: "number" },
                  recommendation: { type: "string" }
                }
              }
            },
            immediate_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "number" },
                  action: { type: "string" },
                  category: { type: "string" },
                  expected_impact: { type: "string" },
                  urgency: { type: "string" }
                }
              }
            },
            monitor_categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  reason: { type: "string" },
                  threshold: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAnalysis(result);
    } catch (err) {
      console.error('Budget AI analysis error:', err);
      setError('Failed to complete AI analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthBg = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return 'bg-red-100 text-red-800 border-red-300';
      case 'Medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Low': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!budget) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">AI Budget Intelligence</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Proactive cost analysis, overrun forecasting & savings opportunities
              </p>
            </div>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {error && (
        <CardContent>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Analysis Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}

      {!analysis && !isAnalyzing && !error && (
        <CardContent>
          <div className="text-center py-8">
            <Brain className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Budget Analysis</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Get intelligent insights on budget health, cost overrun forecasts, variance analysis, 
              and actionable recommendations to optimize project costs and improve profitability.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm">
              <div className="p-4 bg-white rounded-lg border border-purple-200">
                <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-purple-900">Budget Health</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-200">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                <p className="font-medium text-orange-900">Overrun Forecast</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-200">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-900">Cost Savings</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-purple-200">
                <Lightbulb className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Smart Actions</p>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {isAnalyzing && (
        <CardContent>
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Budget Data...</h3>
            <p className="text-gray-600">
              Processing financial data, analyzing spend patterns, forecasting costs, 
              and identifying optimization opportunities...
            </p>
          </div>
        </CardContent>
      )}

      {analysis && (
        <CardContent className="space-y-6">
          {/* Budget Health Score */}
          <Card className={`border-2 ${getHealthBg(analysis.health_score)}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  analysis.health_score >= 80 ? 'bg-green-200' :
                  analysis.health_score >= 60 ? 'bg-yellow-200' :
                  analysis.health_score >= 40 ? 'bg-orange-200' : 'bg-red-200'
                }`}>
                  <div className={`text-3xl font-bold ${getHealthColor(analysis.health_score)}`}>
                    {analysis.health_score}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Budget Health Score</h3>
                    <Badge variant="outline" className={
                      analysis.health_status === 'Critical' ? 'border-red-300 text-red-700 bg-red-50' :
                      analysis.health_status === 'At Risk' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                      'border-green-300 text-green-700 bg-green-50'
                    }>
                      {analysis.health_status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Trajectory: {analysis.trajectory}
                    </Badge>
                  </div>
                  <p className="text-gray-700 mb-3">{analysis.health_summary}</p>
                  
                  {analysis.key_concerns?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">Key Concerns:</p>
                      <ul className="space-y-1">
                        {analysis.key_concerns.map((concern, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <span>{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Overrun Forecast */}
          {analysis.overrun_forecast && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Cost Overrun Forecast
                  </CardTitle>
                  <Badge className={getSeverityColor(analysis.overrun_forecast.likelihood)}>
                    {analysis.overrun_forecast.likelihood} Risk
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {analysis.overrun_forecast.projected_amount !== 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-900 mb-1">Projected Overrun Amount:</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(Math.abs(analysis.overrun_forecast.projected_amount))}
                    </p>
                  </div>
                )}

                {analysis.overrun_forecast.categories_at_risk?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-3">Categories at Risk:</p>
                    <div className="space-y-2">
                      {analysis.overrun_forecast.categories_at_risk.map((cat, idx) => (
                        <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{cat.category}</span>
                            <Badge className={getSeverityColor(cat.concern_level)}>
                              {cat.concern_level}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Current:</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(cat.current_spend)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Projected:</p>
                              <p className="font-semibold text-orange-700">{formatCurrency(cat.projected_spend)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Variance:</p>
                              <p className="font-semibold text-red-600">+{formatCurrency(cat.variance)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.overrun_forecast.early_warnings?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-2">⚠️ Early Warning Indicators:</p>
                    <ul className="space-y-1">
                      {analysis.overrun_forecast.early_warnings.map((warning, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-orange-600 mt-1">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Variance Analysis */}
          {analysis.variance_analysis && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                  Variance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {analysis.variance_analysis.cost_vs_progress && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-medium text-blue-900 mb-3">Cost vs Progress Analysis:</p>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <p className="text-blue-700">% of Budget Spent:</p>
                        <p className="text-xl font-bold text-blue-900">
                          {analysis.variance_analysis.cost_vs_progress.percent_spent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-700">% Complete:</p>
                        <p className="text-xl font-bold text-blue-900">
                          {analysis.variance_analysis.cost_vs_progress.percent_complete.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-medium ${
                      analysis.variance_analysis.cost_vs_progress.variance < 0 ? 'text-green-700' : 'text-orange-700'
                    }`}>
                      {analysis.variance_analysis.cost_vs_progress.interpretation}
                    </p>
                  </div>
                )}

                {analysis.variance_analysis.baseline_variances && analysis.variance_analysis.baseline_variances.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-3">Baseline Estimate Variances:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left">Category</th>
                            <th className="px-4 py-2 text-right">Baseline</th>
                            <th className="px-4 py-2 text-right">Forecast</th>
                            <th className="px-4 py-2 text-right">Variance</th>
                            <th className="px-4 py-2 text-left">Explanation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analysis.variance_analysis.baseline_variances.map((variance, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 font-medium">{variance.category}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(variance.baseline)}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(variance.actual_forecast)}</td>
                              <td className={`px-4 py-2 text-right font-semibold ${
                                variance.variance_amount > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {variance.variance_amount > 0 ? '+' : ''}{formatCurrency(variance.variance_amount)}
                                <span className="text-xs ml-1">({variance.variance_percent.toFixed(1)}%)</span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">{variance.explanation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {analysis.variance_analysis.top_variances?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Top Variance Issues:</p>
                    {analysis.variance_analysis.top_variances.map((variance, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                        <p className="font-medium text-gray-900 text-sm">{variance.category}</p>
                        <p className="text-sm text-gray-700 mt-1">{variance.issue}</p>
                        <p className="text-sm font-semibold text-orange-700 mt-1">Impact: {variance.impact}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cost Savings Opportunities */}
          {analysis.cost_savings && analysis.cost_savings.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-green-600" />
                  Cost Savings Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {analysis.cost_savings.map((saving, idx) => (
                    <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">{saving.category}</span>
                            <Badge className={
                              saving.priority === 'High' ? 'bg-red-100 text-red-800' :
                              saving.priority === 'Medium' ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {saving.priority} Priority
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {saving.implementation}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{saving.opportunity}</p>
                          <p className="text-lg font-bold text-green-700 mb-3">
                            Potential Savings: {formatCurrency(saving.estimated_savings)}
                          </p>
                          {saving.action_steps && saving.action_steps.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">Action Steps:</p>
                              <ol className="text-xs text-gray-600 space-y-1">
                                {saving.action_steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="font-medium">{i + 1}.</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cash Flow Alerts */}
          {analysis.cash_flow_alerts && analysis.cash_flow_alerts.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  Cash Flow Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {analysis.cash_flow_alerts.map((alert, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === 'High' ? 'bg-red-50 border-red-500' :
                      alert.severity === 'Medium' ? 'bg-orange-50 border-orange-500' :
                      'bg-yellow-50 border-yellow-500'
                    }`}>
                      <div className="flex items-start gap-3">
                        <DollarSign className={`w-5 h-5 mt-0.5 ${
                          alert.severity === 'High' ? 'text-red-600' :
                          alert.severity === 'Medium' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{alert.type}</span>
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">
                            Amount: {formatCurrency(alert.amount)}
                          </p>
                          <p className="text-sm text-green-800 bg-green-100 border border-green-200 rounded p-2">
                            💡 {alert.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Immediate Actions */}
          {analysis.immediate_actions && analysis.immediate_actions.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Immediate Actions Required
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {analysis.immediate_actions
                    .sort((a, b) => a.priority - b.priority)
                    .map((action, idx) => (
                      <div key={idx} className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {action.priority}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-900">{action.category}</span>
                              <Badge variant="outline" className="text-xs">
                                {action.urgency}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-900 font-medium mb-2">{action.action}</p>
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Expected Impact:</span> {action.expected_impact}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monitor Categories */}
          {analysis.monitor_categories && analysis.monitor_categories.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                  Categories to Monitor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-3">
                  {analysis.monitor_categories.map((cat, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="font-medium text-gray-900 text-sm mb-1">{cat.category}</p>
                      <p className="text-xs text-gray-700 mb-2">{cat.reason}</p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Watch for:</span> {cat.threshold}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  );
}