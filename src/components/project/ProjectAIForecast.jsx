import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Calendar, 
  DollarSign,
  Target,
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Info
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { Badge } from "@/components/ui/badge";

export default function ProjectAIForecast({ projectId, project }) {
  const [forecast, setForecast] = React.useState(null);
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const all = await base44.entities.Task.list();
      return all.filter(t => t.project_id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', projectId],
    queryFn: async () => {
      const all = await base44.entities.Risk.list();
      return all.filter(r => r.project_id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: async () => {
      const all = await base44.entities.ChangeOrder.list();
      return all.filter(co => co.project_id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: budget } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: async () => {
      const all = await base44.entities.ProjectBudget.list();
      return all.find(b => b.project_id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: async () => {
      const all = await base44.entities.DailyLog.list('-log_date');
      return all.filter(d => d.project_id === projectId).slice(0, 30); // Last 30 logs
    },
    enabled: !!projectId,
  });

  const { data: historicalProjects = [] } = useQuery({
    queryKey: ['historicalProjects'],
    queryFn: async () => {
      const all = await base44.entities.Project.list();
      return all.filter(p => ['Completed', 'Closed'].includes(p.status));
    },
  });

  const { data: historicalBudgets = [] } = useQuery({
    queryKey: ['historicalBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const generateForecast = async () => {
    setIsForecasting(true);
    setError(null);

    try {
      // Calculate historical performance metrics
      const historicalMetrics = historicalProjects.map(p => {
        const pBudget = historicalBudgets.find(b => b.project_id === p.id);
        const originalDuration = p.start_date && p.actual_completion_date 
          ? Math.floor((new Date(p.actual_completion_date) - new Date(p.start_date)) / (1000 * 60 * 60 * 24))
          : null;
        const plannedDuration = p.start_date && p.target_completion_date
          ? Math.floor((new Date(p.target_completion_date) - new Date(p.start_date)) / (1000 * 60 * 60 * 24))
          : null;

        return {
          name: p.name,
          contract_value: p.contract_value,
          final_cost: pBudget?.forecast_at_completion || pBudget?.actual_costs,
          gp_percent: pBudget?.gp_forecast ? ((pBudget.gp_forecast / pBudget.revised_contract_value) * 100) : null,
          schedule_variance_days: (originalDuration && plannedDuration) ? (originalDuration - plannedDuration) : null,
          change_orders_count: null, // Would need to query
          original_duration_days: originalDuration,
          percent_complete: p.percent_complete
        };
      }).filter(m => m.contract_value); // Only include projects with contract values

      // Current project metrics
      const currentProjectAge = project.start_date 
        ? Math.floor((new Date() - new Date(project.start_date)) / (1000 * 60 * 60 * 24))
        : 0;

      const plannedDuration = project.start_date && project.target_completion_date
        ? Math.floor((new Date(project.target_completion_date) - new Date(project.start_date)) / (1000 * 60 * 60 * 24))
        : null;

      const daysRemaining = project.target_completion_date
        ? Math.floor((new Date(project.target_completion_date) - new Date()) / (1000 * 60 * 60 * 24))
        : null;

      // Task analysis
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.percent_complete === 100).length;
      const overdueTasks = tasks.filter(t => 
        t.finish_date && new Date(t.finish_date) < new Date() && t.percent_complete < 100
      ).length;
      const criticalPathTasks = tasks.filter(t => t.critical);

      // Risk analysis
      const activeRisks = risks.filter(r => ['Identified', 'Monitoring'].includes(r.status));
      const highImpactRisks = activeRisks.filter(r => r.impact === 'High');

      // Change order analysis
      const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
      const pendingCOs = changeOrders.filter(co => co.status === 'Pending');
      const totalCOImpact = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);

      // Recent daily log patterns
      const recentIssues = dailyLogs.filter(log => log.issues_delays).length;
      const recentSafetyIssues = dailyLogs.filter(log => log.safety_issues).length;

      const analysisData = {
        project: {
          name: project.name,
          status: project.status,
          contract_value: project.contract_value,
          percent_complete: project.percent_complete || 0,
          start_date: project.start_date,
          target_completion_date: project.target_completion_date,
          current_project_age_days: currentProjectAge,
          planned_duration_days: plannedDuration,
          days_remaining_to_target: daysRemaining
        },
        budget: budget ? {
          revised_contract_value: budget.revised_contract_value,
          actual_costs: budget.actual_costs,
          forecast_at_completion: budget.forecast_at_completion,
          cost_to_complete: budget.cost_to_complete,
          gp_forecast: budget.gp_forecast,
          percent_complete_by_cost: budget.percent_complete_cost,
          cogs_by_category: {
            labor_field: budget.cogs_labor_field,
            labor_supervision: budget.cogs_labor_supervision,
            materials: budget.cogs_materials,
            subcontractors: budget.cogs_subcontractors,
            equipment: budget.cogs_equipment
          }
        } : null,
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          completion_rate: totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0,
          overdue: overdueTasks,
          critical_path_count: criticalPathTasks.length
        },
        risks: {
          active_count: activeRisks.length,
          high_impact_count: highImpactRisks.length,
          risk_categories: activeRisks.reduce((acc, r) => {
            acc[r.category] = (acc[r.category] || 0) + 1;
            return acc;
          }, {})
        },
        change_orders: {
          approved_count: approvedCOs.length,
          pending_count: pendingCOs.length,
          total_approved_impact: totalCOImpact,
          average_co_impact: approvedCOs.length > 0 ? totalCOImpact / approvedCOs.length : 0
        },
        recent_activity: {
          logs_with_issues: recentIssues,
          logs_with_safety_concerns: recentSafetyIssues,
          total_recent_logs: dailyLogs.length
        },
        historical_performance: {
          project_count: historicalMetrics.length,
          avg_gp_percent: historicalMetrics.filter(m => m.gp_percent).length > 0
            ? historicalMetrics.reduce((sum, m) => sum + (m.gp_percent || 0), 0) / historicalMetrics.filter(m => m.gp_percent).length
            : null,
          avg_schedule_variance_days: historicalMetrics.filter(m => m.schedule_variance_days).length > 0
            ? historicalMetrics.reduce((sum, m) => sum + (m.schedule_variance_days || 0), 0) / historicalMetrics.filter(m => m.schedule_variance_days).length
            : null,
          typical_duration_days: historicalMetrics.filter(m => m.original_duration_days).length > 0
            ? historicalMetrics.reduce((sum, m) => sum + (m.original_duration_days || 0), 0) / historicalMetrics.filter(m => m.original_duration_days).length
            : null
        }
      };

      const prompt = `You are an expert construction project analyst. Analyze this project data and provide a comprehensive forecast.

PROJECT DATA:
${JSON.stringify(analysisData, null, 2)}

Provide a detailed forecast with the following structure. Be specific with numbers and dates where possible.

IMPORTANT: Consider the following in your analysis:
1. Compare current progress (${project.percent_complete || 0}% complete) vs time elapsed
2. Historical company performance on similar projects
3. Current risk profile and its potential impact
4. Change order patterns and their implications
5. Recent daily log issues and delays
6. Budget performance and cost trajectory

Respond in the following JSON structure:
{
  "schedule_forecast": {
    "predicted_completion_date": "YYYY-MM-DD format",
    "confidence_level": "High/Medium/Low",
    "variance_from_target_days": number (positive means late, negative means early),
    "key_factors": ["factor 1", "factor 2", "factor 3"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  },
  "cost_forecast": {
    "predicted_final_cost": number,
    "predicted_cost_overrun": number (0 if none predicted),
    "confidence_level": "High/Medium/Low",
    "cost_variance_percent": number,
    "key_risk_areas": ["area 1", "area 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  },
  "profitability_forecast": {
    "predicted_gp_amount": number,
    "predicted_gp_percent": number,
    "compared_to_historical": "Above/Below/On Par",
    "confidence_level": "High/Medium/Low",
    "profitability_risks": ["risk 1", "risk 2"],
    "opportunities": ["opportunity 1", "opportunity 2"]
  },
  "critical_alerts": [
    {
      "severity": "High/Medium/Low",
      "category": "Schedule/Cost/Risk/Quality",
      "message": "Alert message",
      "action_required": "What to do about it"
    }
  ],
  "overall_health_score": number (0-100),
  "summary": "2-3 sentence executive summary of the forecast"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            schedule_forecast: {
              type: "object",
              properties: {
                predicted_completion_date: { type: "string" },
                confidence_level: { type: "string" },
                variance_from_target_days: { type: "number" },
                key_factors: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } }
              }
            },
            cost_forecast: {
              type: "object",
              properties: {
                predicted_final_cost: { type: "number" },
                predicted_cost_overrun: { type: "number" },
                confidence_level: { type: "string" },
                cost_variance_percent: { type: "number" },
                key_risk_areas: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } }
              }
            },
            profitability_forecast: {
              type: "object",
              properties: {
                predicted_gp_amount: { type: "number" },
                predicted_gp_percent: { type: "number" },
                compared_to_historical: { type: "string" },
                confidence_level: { type: "string" },
                profitability_risks: { type: "array", items: { type: "string" } },
                opportunities: { type: "array", items: { type: "string" } }
              }
            },
            critical_alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string" },
                  category: { type: "string" },
                  message: { type: "string" },
                  action_required: { type: "string" }
                }
              }
            },
            overall_health_score: { type: "number" },
            summary: { type: "string" }
          }
        }
      });

      setForecast(result);
    } catch (err) {
      console.error('Forecast generation error:', err);
      setError('Failed to generate forecast. Please try again.');
    } finally {
      setIsForecasting(false);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreBg = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      'High': 'bg-green-100 text-green-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-orange-100 text-orange-800'
    };
    return colors[confidence] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'High': 'border-l-4 border-red-500 bg-red-50',
      'Medium': 'border-l-4 border-orange-500 bg-orange-50',
      'Low': 'border-l-4 border-yellow-500 bg-yellow-50'
    };
    return colors[severity] || 'border-l-4 border-gray-500 bg-gray-50';
  };

  if (!project || project.status === 'Planning' || project.status === 'Bidding') {
    return null; // Don't show forecast for projects not yet active
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Project Forecast</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Predictive analysis based on historical data, current status, and risk factors
                </p>
              </div>
            </div>
            <Button
              onClick={generateForecast}
              disabled={isForecasting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isForecasting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Forecast
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error Generating Forecast</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!forecast && !isForecasting && !error && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Forecast</h3>
            <p className="text-gray-600 mb-6">
              Click "Generate Forecast" to analyze this project's trajectory and predict completion dates, costs, and profitability.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
              <div className="p-4 bg-blue-50 rounded-lg">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Schedule Prediction</p>
                <p className="text-blue-700 text-xs mt-1">Estimated completion date</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-900">Cost Forecast</p>
                <p className="text-green-700 text-xs mt-1">Predicted final costs</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-purple-900">Profitability</p>
                <p className="text-purple-700 text-xs mt-1">Expected gross profit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isForecasting && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Project Data...</h3>
            <p className="text-gray-600">
              Our AI is analyzing {tasks.length} tasks, {risks.length} risks, {changeOrders.length} change orders, 
              and historical performance from {historicalProjects.length} completed projects.
            </p>
          </CardContent>
        </Card>
      )}

      {forecast && (
        <>
          {/* Overall Health Score */}
          <Card className={`border-2 ${getHealthScoreBg(forecast.overall_health_score)}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Overall Project Health</h3>
                  <p className="text-sm text-gray-600">{forecast.summary}</p>
                </div>
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getHealthScoreColor(forecast.overall_health_score)}`}>
                    {forecast.overall_health_score}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">out of 100</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critical Alerts */}
          {forecast.critical_alerts && forecast.critical_alerts.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Alerts ({forecast.critical_alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {forecast.critical_alerts.map((alert, idx) => (
                    <div key={idx} className={`p-4 rounded-lg ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="text-xs">{alert.category}</Badge>
                            <Badge variant="outline" className="text-xs">{alert.severity} Priority</Badge>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{alert.message}</p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Action Required:</span> {alert.action_required}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Forecast Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schedule Forecast */}
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Schedule Forecast
                  </CardTitle>
                  <Badge className={getConfidenceBadge(forecast.schedule_forecast.confidence_level)}>
                    {forecast.schedule_forecast.confidence_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Predicted Completion</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDate(forecast.schedule_forecast.predicted_completion_date)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {forecast.schedule_forecast.variance_from_target_days > 0 ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">
                          {forecast.schedule_forecast.variance_from_target_days} days late
                        </span>
                      </>
                    ) : forecast.schedule_forecast.variance_from_target_days < 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">
                          {Math.abs(forecast.schedule_forecast.variance_from_target_days)} days early
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">On track</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Key Factors:</p>
                  <ul className="space-y-1">
                    {forecast.schedule_forecast.key_factors.map((factor, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Recommendations:</p>
                  <ul className="space-y-1">
                    {forecast.schedule_forecast.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Cost Forecast */}
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Cost Forecast
                  </CardTitle>
                  <Badge className={getConfidenceBadge(forecast.cost_forecast.confidence_level)}>
                    {forecast.cost_forecast.confidence_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Predicted Final Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(forecast.cost_forecast.predicted_final_cost)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {forecast.cost_forecast.predicted_cost_overrun > 0 ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">
                          {formatCurrency(forecast.cost_forecast.predicted_cost_overrun)} overrun
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">
                          Within budget
                        </span>
                      </>
                    )}
                  </div>
                  {forecast.cost_forecast.cost_variance_percent !== 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      {forecast.cost_forecast.cost_variance_percent > 0 ? '+' : ''}
                      {forecast.cost_forecast.cost_variance_percent.toFixed(1)}% variance
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Key Risk Areas:</p>
                  <ul className="space-y-1">
                    {forecast.cost_forecast.key_risk_areas.map((area, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Recommendations:</p>
                  <ul className="space-y-1">
                    {forecast.cost_forecast.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Profitability Forecast */}
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Profitability
                  </CardTitle>
                  <Badge className={getConfidenceBadge(forecast.profitability_forecast.confidence_level)}>
                    {forecast.profitability_forecast.confidence_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Predicted Gross Profit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(forecast.profitability_forecast.predicted_gp_amount)}
                  </p>
                  <p className="text-lg text-gray-700 mt-1">
                    {forecast.profitability_forecast.predicted_gp_percent.toFixed(1)}% GP
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-600 font-medium">
                      {forecast.profitability_forecast.compared_to_historical} historical average
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Profitability Risks:</p>
                  <ul className="space-y-1">
                    {forecast.profitability_forecast.profitability_risks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-600 mt-1">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Opportunities:</p>
                  <ul className="space-y-1">
                    {forecast.profitability_forecast.opportunities.map((opp, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">AI Forecast Disclaimer</p>
                  <p className="text-blue-800">
                    This forecast is generated using AI analysis of historical data, current project metrics, and identified risks. 
                    While designed to provide valuable insights, actual project outcomes may vary based on unforeseen circumstances, 
                    market conditions, and other factors. Use this forecast as a planning tool in conjunction with professional judgment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}