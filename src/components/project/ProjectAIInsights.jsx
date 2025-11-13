import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Loader2, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Target,
  Shield,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Info,
  Sparkles,
  Plus
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";

export default function ProjectAIInsights({ projectId, project }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedSeverity, setSelectedSeverity] = React.useState('all');
  const [createdRisks, setCreatedRisks] = React.useState(new Set());
  
  const queryClient = useQueryClient();

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
      return all.filter(d => d.project_id === projectId).slice(0, 30);
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

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const createRiskMutation = useMutation({
    mutationFn: (riskData) => base44.entities.Risk.create(riskData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', projectId] });
      setCreatedRisks(prev => new Set([...prev, variables.aiRiskIndex]));
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setCreatedRisks(new Set());

    try {
      // Calculate project metrics
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
      const today = new Date();
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.percent_complete === 100).length;
      const overdueTasks = tasks.filter(t => 
        t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
      ).length;

      // Risk analysis
      const activeRisks = risks.filter(r => ['Identified', 'Monitoring'].includes(r.status));
      const highImpactRisks = activeRisks.filter(r => r.impact === 'High');

      // Change order analysis
      const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
      const totalCOImpact = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);

      // Daily log patterns
      const recentIssues = dailyLogs.filter(log => log.issues_delays || log.safety_issues || log.injuries_accidents);

      // Historical metrics
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
          gp_percent: pBudget?.gp_forecast ? ((pBudget.gp_forecast / pBudget.revised_contract_value) * 100) : null,
          schedule_variance_days: (originalDuration && plannedDuration) ? (originalDuration - plannedDuration) : null,
        };
      }).filter(m => m.gp_percent || m.schedule_variance_days);

      const analysisData = {
        project: {
          name: project.name,
          status: project.status,
          contract_value: project.contract_value,
          percent_complete: project.percent_complete || 0,
          current_project_age_days: currentProjectAge,
          planned_duration_days: plannedDuration,
          days_remaining_to_target: daysRemaining
        },
        budget: budget ? {
          revised_contract_value: budget.revised_contract_value,
          actual_costs: budget.actual_costs,
          forecast_at_completion: budget.forecast_at_completion,
          cost_to_complete: budget.cost_to_complete,
          gp_forecast: budget.gp_forecast
        } : null,
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          completion_rate: totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0,
          overdue: overdueTasks
        },
        risks: {
          active_count: activeRisks.length,
          high_impact_count: highImpactRisks.length
        },
        change_orders: {
          approved_count: approvedCOs.length,
          total_approved_impact: totalCOImpact
        },
        recent_issues: recentIssues.length,
        historical_performance: {
          avg_gp_percent: historicalMetrics.filter(m => m.gp_percent).length > 0
            ? historicalMetrics.reduce((sum, m) => sum + (m.gp_percent || 0), 0) / historicalMetrics.filter(m => m.gp_percent).length
            : null,
          avg_schedule_variance_days: historicalMetrics.filter(m => m.schedule_variance_days).length > 0
            ? historicalMetrics.reduce((sum, m) => sum + (m.schedule_variance_days || 0), 0) / historicalMetrics.filter(m => m.schedule_variance_days).length
            : null
        }
      };

      const prompt = `You are an expert construction project analyst. Analyze this project and provide BOTH forecasting AND risk analysis in a SINGLE comprehensive response.

PROJECT DATA:
${JSON.stringify(analysisData, null, 2)}

RECENT DAILY LOG ISSUES:
${recentIssues.map(log => {
  const issues = [];
  if (log.safety_issues) issues.push(`Safety: ${log.safety_issues_description}`);
  if (log.injuries_accidents) issues.push(`Injury: ${log.injuries_accidents_description}`);
  if (log.issues_delays) issues.push(`Issue: ${log.issues_delays}`);
  return `[${log.log_date}] ${issues.join(' | ')}`;
}).join('\n') || 'None reported'}

Provide a comprehensive analysis that includes:

1. PROJECT FORECAST (schedule, cost, profitability predictions)
2. EMERGING RISKS (6-10 potential risks with mitigation strategies)
3. OVERALL HEALTH ASSESSMENT

Use construction industry best practices (OSHA, CII, PMI) for recommendations.

Respond in JSON:
{
  "overall_health_score": number (0-100),
  "summary": "Executive summary combining forecast and risk outlook",
  "trending": "Improving/Stable/Worsening",
  "key_metrics": {
    "safety_trend": "Improving/Stable/Worsening",
    "schedule_trend": "Improving/Stable/Worsening",
    "cost_trend": "Improving/Stable/Worsening"
  },
  "schedule_forecast": {
    "predicted_completion_date": "YYYY-MM-DD",
    "confidence_level": "High/Medium/Low",
    "variance_from_target_days": number,
    "key_factors": ["factor 1", "factor 2"],
    "recommendations": ["rec 1", "rec 2"]
  },
  "cost_forecast": {
    "predicted_final_cost": number,
    "predicted_cost_overrun": number,
    "confidence_level": "High/Medium/Low",
    "cost_variance_percent": number,
    "key_risk_areas": ["area 1", "area 2"],
    "recommendations": ["rec 1", "rec 2"]
  },
  "profitability_forecast": {
    "predicted_gp_amount": number,
    "predicted_gp_percent": number,
    "compared_to_historical": "Above/Below/On Par",
    "confidence_level": "High/Medium/Low",
    "profitability_risks": ["risk 1", "risk 2"],
    "opportunities": ["opp 1", "opp 2"]
  },
  "identified_risks": [
    {
      "title": "Risk title",
      "description": "Detailed description",
      "category": "Safety/Schedule/Cost/Quality/Legal/Environmental",
      "severity": "High/Medium/Low",
      "probability": "High/Medium/Low",
      "impact": "High/Medium/Low",
      "evidence": ["data 1", "data 2"],
      "mitigation_strategies": [
        {
          "strategy": "Action",
          "timeline": "Immediate/This Week/This Month",
          "owner": "Role",
          "expected_impact": "Result",
          "industry_standard": "Reference"
        }
      ],
      "early_warning_indicators": ["indicator 1"],
      "financial_impact_estimate": "Low/Medium/High",
      "recommended_owner": "Role"
    }
  ],
  "critical_alerts": [
    {
      "severity": "High/Medium/Low",
      "category": "Schedule/Cost/Risk/Quality",
      "message": "Alert",
      "action_required": "Action"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_health_score: { type: "number" },
            summary: { type: "string" },
            trending: { type: "string" },
            key_metrics: {
              type: "object",
              properties: {
                safety_trend: { type: "string" },
                schedule_trend: { type: "string" },
                cost_trend: { type: "string" }
              }
            },
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
            identified_risks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  severity: { type: "string" },
                  probability: { type: "string" },
                  impact: { type: "string" },
                  evidence: { type: "array", items: { type: "string" } },
                  mitigation_strategies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        strategy: { type: "string" },
                        timeline: { type: "string" },
                        owner: { type: "string" },
                        expected_impact: { type: "string" },
                        industry_standard: { type: "string" }
                      }
                    }
                  },
                  early_warning_indicators: { type: "array", items: { type: "string" } },
                  financial_impact_estimate: { type: "string" },
                  recommended_owner: { type: "string" }
                }
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
            }
          }
        }
      });

      setAnalysis(result);
    } catch (err) {
      console.error('AI analysis error:', err);
      setError('Failed to complete AI analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateRisk = async (aiRisk, aiRiskIndex) => {
    const riskData = {
      project_id: projectId,
      title: aiRisk.title,
      description: aiRisk.description + '\n\n**Evidence:**\n' + aiRisk.evidence.map(e => `- ${e}`).join('\n'),
      category: aiRisk.category,
      probability: aiRisk.probability,
      impact: aiRisk.impact,
      status: 'Identified',
      source: 'Manual',
      owner: currentUser?.email || '',
      mitigation_plan: aiRisk.mitigation_strategies.map((s, idx) => 
        `${idx + 1}. ${s.strategy}\n   Timeline: ${s.timeline}\n   Owner: ${s.owner}\n   Expected Impact: ${s.expected_impact}${s.industry_standard ? `\n   Standard: ${s.industry_standard}` : ''}`
      ).join('\n\n'),
      aiRiskIndex
    };

    createRiskMutation.mutate(riskData);
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

  const getRiskSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return 'bg-red-100 text-red-800 border-red-300';
      case 'Medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Low': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskIcon = (category) => {
    switch (category) {
      case 'Schedule': return Calendar;
      case 'Cost': return DollarSign;
      case 'Safety': return AlertTriangle;
      default: return Shield;
    }
  };

  const filteredRisks = analysis?.identified_risks?.filter(risk => 
    selectedSeverity === 'all' || risk.severity === selectedSeverity
  ) || [];

  if (!project || project.status === 'Planning' || project.status === 'Bidding') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Project Intelligence</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive forecast & risk analysis powered by AI
                </p>
              </div>
            </div>
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
      </Card>

      {error && (
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
      )}

      {!analysis && !isAnalyzing && !error && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Project Intelligence</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Get comprehensive insights combining predictive forecasting with proactive risk analysis. 
              Our AI analyzes project data, historical performance, and current trends to provide actionable intelligence.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto text-sm">
              <div className="p-4 bg-blue-50 rounded-lg">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Predictive Forecasting</p>
                <p className="text-blue-700 text-xs mt-1">Schedule, cost & profitability predictions</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <Shield className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-purple-900">Risk Intelligence</p>
                <p className="text-purple-700 text-xs mt-1">Early warning & mitigation strategies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Running Comprehensive Analysis...</h3>
            <p className="text-gray-600">
              Analyzing {tasks.length} tasks, {risks.length} risks, {changeOrders.length} change orders, 
              {dailyLogs.length} daily logs, and {historicalProjects.length} historical projects.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Overall Health & Summary */}
          <Card className={`border-2 ${getHealthScoreBg(analysis.overall_health_score)}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  analysis.overall_health_score >= 80 ? 'bg-green-200' :
                  analysis.overall_health_score >= 60 ? 'bg-yellow-200' :
                  analysis.overall_health_score >= 40 ? 'bg-orange-200' : 'bg-red-200'
                }`}>
                  <div className={`text-2xl font-bold ${getHealthScoreColor(analysis.overall_health_score)}`}>
                    {analysis.overall_health_score}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Overall Project Health</h3>
                    {analysis.trending && (
                      <Badge variant="outline" className={
                        analysis.trending === 'Worsening' ? 'border-red-300 text-red-700' :
                        analysis.trending === 'Improving' ? 'border-green-300 text-green-700' :
                        'border-gray-300 text-gray-700'
                      }>
                        {analysis.trending === 'Worsening' ? '↗' : 
                         analysis.trending === 'Improving' ? '↘' : '→'} {analysis.trending}
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{analysis.summary}</p>
                  
                  {analysis.key_metrics && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-xs">
                        <span className="text-gray-600">Safety:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.key_metrics.safety_trend === 'Worsening' ? 'text-red-600' :
                          analysis.key_metrics.safety_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.key_metrics.safety_trend}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Schedule:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.key_metrics.schedule_trend === 'Worsening' ? 'text-red-600' :
                          analysis.key_metrics.schedule_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.key_metrics.schedule_trend}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Cost:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.key_metrics.cost_trend === 'Worsening' ? 'text-red-600' :
                          analysis.key_metrics.cost_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.key_metrics.cost_trend}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critical Alerts */}
          {analysis.critical_alerts && analysis.critical_alerts.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Alerts ({analysis.critical_alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {analysis.critical_alerts.map((alert, idx) => (
                    <div key={idx} className={`p-4 rounded-lg ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-start gap-2 mb-1">
                        <Badge className="text-xs">{alert.category}</Badge>
                        <Badge variant="outline" className="text-xs">{alert.severity} Priority</Badge>
                      </div>
                      <p className="font-medium text-gray-900 mb-2">{alert.message}</p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Action Required:</span> {alert.action_required}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="forecast" className="space-y-6">
            <TabsList className="bg-[#F5F4F3] border border-gray-200">
              <TabsTrigger value="forecast" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                Forecast
              </TabsTrigger>
              <TabsTrigger value="risks" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Emerging Risks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="forecast" className="space-y-6">
              {/* Forecast Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Schedule Forecast */}
                <Card className="bg-white border-gray-200">
                  <CardHeader className="border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Schedule
                      </CardTitle>
                      <Badge className={getConfidenceBadge(analysis.schedule_forecast.confidence_level)}>
                        {analysis.schedule_forecast.confidence_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Predicted Completion</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatDate(analysis.schedule_forecast.predicted_completion_date)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {analysis.schedule_forecast.variance_from_target_days > 0 ? (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-600 font-medium">
                              {analysis.schedule_forecast.variance_from_target_days} days late
                            </span>
                          </>
                        ) : analysis.schedule_forecast.variance_from_target_days < 0 ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">
                              {Math.abs(analysis.schedule_forecast.variance_from_target_days)} days early
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
                        {analysis.schedule_forecast.key_factors.map((factor, idx) => (
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
                        {analysis.schedule_forecast.recommendations.map((rec, idx) => (
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
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        Cost
                      </CardTitle>
                      <Badge className={getConfidenceBadge(analysis.cost_forecast.confidence_level)}>
                        {analysis.cost_forecast.confidence_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Predicted Final Cost</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(analysis.cost_forecast.predicted_final_cost)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {analysis.cost_forecast.predicted_cost_overrun > 0 ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-600 font-medium">
                              {formatCurrency(analysis.cost_forecast.predicted_cost_overrun)} overrun
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Within budget</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Key Risk Areas:</p>
                      <ul className="space-y-1">
                        {analysis.cost_forecast.key_risk_areas.map((area, idx) => (
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
                        {analysis.cost_forecast.recommendations.map((rec, idx) => (
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
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="w-5 h-5 text-purple-600" />
                        Profitability
                      </CardTitle>
                      <Badge className={getConfidenceBadge(analysis.profitability_forecast.confidence_level)}>
                        {analysis.profitability_forecast.confidence_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Predicted GP</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(analysis.profitability_forecast.predicted_gp_amount)}
                      </p>
                      <p className="text-lg text-gray-700 mt-1">
                        {analysis.profitability_forecast.predicted_gp_percent.toFixed(1)}% GP
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-600 font-medium">
                          {analysis.profitability_forecast.compared_to_historical} historical avg
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Risks:</p>
                      <ul className="space-y-1">
                        {analysis.profitability_forecast.profitability_risks.map((risk, idx) => (
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
                        {analysis.profitability_forecast.opportunities.map((opp, idx) => (
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
            </TabsContent>

            <TabsContent value="risks" className="space-y-6">
              {/* Risk Filters */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Filter by severity:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={selectedSeverity === 'all' ? 'default' : 'outline'}
                      onClick={() => setSelectedSeverity('all')}
                      className={selectedSeverity === 'all' ? 'bg-indigo-600 text-white' : 'border-gray-300'}
                    >
                      All ({analysis.identified_risks.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedSeverity === 'High' ? 'default' : 'outline'}
                      onClick={() => setSelectedSeverity('High')}
                      className={selectedSeverity === 'High' ? 'bg-red-600 text-white' : 'border-gray-300'}
                    >
                      High ({analysis.identified_risks.filter(r => r.severity === 'High').length})
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedSeverity === 'Medium' ? 'default' : 'outline'}
                      onClick={() => setSelectedSeverity('Medium')}
                      className={selectedSeverity === 'Medium' ? 'bg-orange-600 text-white' : 'border-gray-300'}
                    >
                      Medium ({analysis.identified_risks.filter(r => r.severity === 'Medium').length})
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedSeverity === 'Low' ? 'default' : 'outline'}
                      onClick={() => setSelectedSeverity('Low')}
                      className={selectedSeverity === 'Low' ? 'bg-yellow-600 text-white' : 'border-gray-300'}
                    >
                      Low ({analysis.identified_risks.filter(r => r.severity === 'Low').length})
                    </Button>
                  </div>
                </div>
                
                {createdRisks.size > 0 && (
                  <span className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    {createdRisks.size} risk{createdRisks.size !== 1 ? 's' : ''} added to register
                  </span>
                )}
              </div>

              {/* Identified Risks */}
              <div className="space-y-4">
                {filteredRisks.map((risk, idx) => {
                  const Icon = getRiskIcon(risk.category);
                  const isCreated = createdRisks.has(idx);
                  
                  return (
                    <Card key={idx} className={`border-gray-200 ${isCreated ? 'bg-green-50' : 'bg-white'}`}>
                      <CardHeader className="border-b border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              risk.severity === 'High' ? 'bg-red-100' :
                              risk.severity === 'Medium' ? 'bg-orange-100' :
                              'bg-yellow-100'
                            }`}>
                              <Icon className={`w-5 h-5 ${
                                risk.severity === 'High' ? 'text-red-700' :
                                risk.severity === 'Medium' ? 'text-orange-700' :
                                'text-yellow-700'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <CardTitle className="text-base">{risk.title}</CardTitle>
                                <Badge className={getRiskSeverityColor(risk.severity)}>
                                  {risk.severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {risk.category}
                                </Badge>
                                {isCreated && (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Added
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mb-2">{risk.description}</p>
                              {risk.financial_impact_estimate && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Est. Impact:</span> {risk.financial_impact_estimate}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-600 mb-1">Risk Score</div>
                            <div className={`text-2xl font-bold ${
                              risk.severity === 'High' ? 'text-red-600' :
                              risk.severity === 'Medium' ? 'text-orange-600' :
                              'text-yellow-600'
                            }`}>
                              {risk.probability?.[0]}/{risk.impact?.[0]}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        {/* Evidence */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <p className="text-sm font-semibold text-gray-900">Evidence:</p>
                          </div>
                          <ul className="space-y-1 ml-6">
                            {risk.evidence.map((item, i) => (
                              <li key={i} className="text-sm text-gray-700 list-disc">{item}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Mitigation Strategies */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-green-600" />
                            <p className="text-sm font-semibold text-gray-900">Mitigation Strategies:</p>
                          </div>
                          <div className="space-y-3">
                            {risk.mitigation_strategies.map((strategy, i) => (
                              <div key={i} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <ChevronRight className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 mb-2">{strategy.strategy}</p>
                                    <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                                      <div>
                                        <span className="text-gray-600">Timeline:</span>
                                        <p className="font-medium text-gray-900">{strategy.timeline}</p>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Owner:</span>
                                        <p className="font-medium text-gray-900">{strategy.owner}</p>
                                      </div>
                                    </div>
                                    <div className="text-xs mb-2">
                                      <span className="text-gray-600">Expected Impact:</span>
                                      <p className="font-medium text-gray-900">{strategy.expected_impact}</p>
                                    </div>
                                    {strategy.industry_standard && (
                                      <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                                        <span className="text-blue-700 font-medium">📚 Industry Standard:</span>
                                        <p className="text-blue-800 mt-1">{strategy.industry_standard}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Early Warning Indicators */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <p className="text-sm font-semibold text-gray-900">Early Warning Indicators:</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {risk.early_warning_indicators.map((indicator, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-300">
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="pt-3 border-t border-gray-200">
                          {isCreated ? (
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="text-sm font-medium">Added to risk register</span>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleCreateRisk(risk, idx)}
                              disabled={createRiskMutation.isPending}
                              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              {createRiskMutation.isPending ? 'Adding...' : 'Add to Risk Register'}
                            </Button>
                          )}
                          {risk.recommended_owner && (
                            <p className="text-xs text-gray-600 mt-2">
                              <span className="font-medium">Recommended Owner:</span> {risk.recommended_owner}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Disclaimer */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">AI Intelligence Disclaimer</p>
                  <p className="text-blue-800">
                    This analysis combines predictive forecasting with risk intelligence using AI to identify patterns across project data. 
                    While designed to provide valuable insights, actual outcomes may vary. Use these insights as a planning tool in 
                    conjunction with professional judgment and direct observation.
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