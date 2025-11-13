
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Loader2, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  DollarSign,
  Shield,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  ClipboardList,
  Plus, 
  CheckCircle2
} from "lucide-react";

export default function AIRiskAnalysis({ projectId = null, showProjectFilter = false }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedSeverity, setSelectedSeverity] = React.useState('all');
  const [createdRisks, setCreatedRisks] = React.useState(new Set());
  
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: !projectId,
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: async () => {
      const all = await base44.entities.DailyLog.list('-log_date');
      return projectId ? all.filter(d => d.project_id === projectId).slice(0, 30) : all.slice(0, 50);
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const all = await base44.entities.Task.list();
      return projectId ? all.filter(t => t.project_id === projectId) : all;
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['projectBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const { data: existingRisks = [] } = useQuery({
    queryKey: ['risks', projectId],
    queryFn: async () => {
      const all = await base44.entities.Risk.list();
      return projectId ? all.filter(r => r.project_id === projectId) : all;
    },
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: async () => {
      const all = await base44.entities.ChangeOrder.list();
      return projectId ? all.filter(co => co.project_id === projectId) : all;
    },
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
      // Mark this risk as created
      setCreatedRisks(prev => new Set([...prev, variables.aiRiskIndex]));
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setCreatedRisks(new Set()); // Reset created risks

    try {
      // Prepare analysis data
      const analysisScope = projectId 
        ? projects.filter(p => p.id === projectId)
        : projects.filter(p => ['Active', 'Planning'].includes(p.status));

      // Analyze daily logs for patterns
      const recentIssues = dailyLogs.filter(log => 
        log.issues_delays || log.safety_issues || log.injuries_accidents
      ).slice(0, 20);

      // Analyze task schedule deviations
      const today = new Date();
      const overdueTasks = tasks.filter(t => 
        t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
      );

      const tasksByProject = tasks.reduce((acc, task) => {
        if (!acc[task.project_id]) acc[task.project_id] = [];
        acc[task.project_id].push(task);
        return acc;
      }, {});

      // Calculate schedule health per project
      const scheduleHealth = analysisScope.map(project => {
        const projectTasks = tasksByProject[project.id] || [];
        const completedOnTime = projectTasks.filter(t => 
          t.percent_complete === 100 && (!t.finish_date || new Date(t.finish_date) >= new Date())
        ).length;
        const total = projectTasks.length;
        return {
          project_id: project.id,
          project_name: project.name,
          completion_rate: total > 0 ? (completedOnTime / total * 100) : 100,
          overdue_count: projectTasks.filter(t => 
            t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
          ).length
        };
      });

      // Budget variance analysis
      const budgetRisks = analysisScope.map(project => {
        const budget = budgets.find(b => b.project_id === project.id);
        if (!budget) return null;

        const costVariance = budget.forecast_at_completion - budget.revised_contract_value;
        const costVariancePercent = budget.revised_contract_value > 0 
          ? (costVariance / budget.revised_contract_value * 100) 
          : 0;

        return {
          project_id: project.id,
          project_name: project.name,
          cost_variance: costVariance,
          cost_variance_percent: costVariancePercent,
          ctc_negative: (budget.cost_to_complete || 0) < 0,
          gp_negative: (budget.gp_forecast || 0) < 0
        };
      }).filter(Boolean);

      // Change order patterns
      const coAnalysis = analysisScope.map(project => {
        const projectCOs = changeOrders.filter(co => co.project_id === project.id);
        const approvedCOs = projectCOs.filter(co => co.status === 'Approved');
        const totalCOImpact = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
        
        return {
          project_id: project.id,
          project_name: project.name,
          co_count: projectCOs.length,
          approved_count: approvedCOs.length,
          total_impact: totalCOImpact,
          avg_impact: approvedCOs.length > 0 ? totalCOImpact / approvedCOs.length : 0
        };
      });

      // Existing risk patterns
      const riskPatterns = existingRisks.reduce((acc, risk) => {
        acc[risk.category] = (acc[risk.category] || 0) + 1;
        return acc;
      }, {});

      const activeRiskCount = existingRisks.filter(r => 
        ['Identified', 'Monitoring'].includes(r.status)
      ).length;

      const prompt = `You are an expert construction risk analyst with deep knowledge of project management, safety, and financial controls.

Analyze the following project data and proactively identify potential risks that may not be obvious. Look for patterns, trends, and early warning signs.

PROJECT SCOPE:
${analysisScope.map(p => `- ${p.name} (${p.status})`).join('\n')}

RECENT DAILY LOG ISSUES (Last 20):
${recentIssues.map(log => {
  const issues = [];
  if (log.safety_issues) issues.push(`Safety: ${log.safety_issues_description}`);
  if (log.injuries_accidents) issues.push(`Injury: ${log.injuries_accidents_description}`);
  if (log.issues_delays) issues.push(`Issue: ${log.issues_delays}`);
  return `[${log.log_date}] ${issues.join(' | ')}`;
}).join('\n') || 'None reported'}

SCHEDULE HEALTH:
${scheduleHealth.map(sh => 
  `${sh.project_name}: ${sh.completion_rate.toFixed(0)}% on-time completion, ${sh.overdue_count} overdue tasks`
).join('\n')}

BUDGET VARIANCES:
${budgetRisks.map(br => 
  `${br.project_name}: ${br.cost_variance_percent > 0 ? '+' : ''}${br.cost_variance_percent.toFixed(1)}% variance${br.ctc_negative ? ', NEGATIVE CTC' : ''}${br.gp_negative ? ', NEGATIVE GP' : ''}`
).join('\n')}

CHANGE ORDER PATTERNS:
${coAnalysis.map(co => 
  `${co.project_name}: ${co.co_count} COs (${co.approved_count} approved), $${co.total_impact.toFixed(0)} total impact`
).join('\n')}

EXISTING RISK PROFILE:
- Total active risks: ${activeRiskCount}
- By category: ${Object.entries(riskPatterns).map(([cat, count]) => `${cat} (${count})`).join(', ')}

TASK: Identify 6-10 potential risks that may be developing based on patterns in this data. For each risk:

1. Look for trends and correlations (e.g., repeated issues, budget trending, schedule slippage)
2. Identify early warning signs that may indicate larger problems  
3. Consider secondary effects (e.g., how schedule delays might impact costs)
4. Check if this risk already exists in the system - if similar risk exists, focus on NEW emerging patterns
5. Suggest specific, actionable mitigation strategies based on construction industry best practices

Focus on:
- Safety patterns that could escalate
- Budget overruns that may worsen
- Schedule delays creating cascading impacts
- Quality issues from rushed work
- Resource constraints causing bottlenecks
- Weather/seasonal impacts
- Subcontractor performance issues
- Material supply chain risks
- Payment/cash flow concerns
- Regulatory compliance risks

For mitigation strategies, reference:
- OSHA safety standards where applicable
- Construction Industry Institute (CII) best practices
- Project Management Institute (PMI) guidelines
- Lean construction principles
- Historical success patterns from similar situations

Return a JSON array with this structure:
{
  "identified_risks": [
    {
      "title": "Brief risk title",
      "description": "Detailed description of the potential risk and the pattern/data that indicates it",
      "category": "Safety/Schedule/Cost/Quality/Legal/Environmental",
      "severity": "High/Medium/Low",
      "probability": "High/Medium/Low", 
      "impact": "High/Medium/Low",
      "evidence": ["data point 1", "data point 2", "data point 3"],
      "project_ids": ["id1", "id2"] or null for company-wide,
      "similar_to_existing": false,
      "mitigation_strategies": [
        {
          "strategy": "Specific action to take",
          "timeline": "When to implement (Immediate/This Week/This Month)",
          "owner": "Who should own this (Project Manager/Superintendent/Safety Officer/etc)",
          "expected_impact": "What this will accomplish",
          "industry_standard": "Reference to industry best practice (e.g., 'Per OSHA 1926.501' or 'CII Best Practice 142-1')"
        }
      ],
      "early_warning_indicators": ["indicator 1", "indicator 2", "indicator 3"],
      "financial_impact_estimate": "Low ($X-$Y)/Medium ($X-$Y)/High ($X-$Y+)/None",
      "recommended_owner": "Project Manager/Safety Manager/Superintendent/CFO/etc"
    }
  ],
  "overall_risk_profile": {
    "level": "High/Medium/Low",
    "summary": "2-3 sentence executive summary of overall risk posture",
    "top_priority": "The single most important risk to address immediately",
    "trending": "Improving/Stable/Worsening",
    "key_metrics": {
      "safety_trend": "Improving/Stable/Worsening",
      "schedule_trend": "Improving/Stable/Worsening", 
      "cost_trend": "Improving/Stable/Worsening"
    }
  }
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
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
                  project_ids: { 
                    anyOf: [
                      { type: "array", items: { type: "string" } },
                      { type: "null" }
                    ]
                  },
                  similar_to_existing: { type: "boolean" },
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
                      },
                      required: ["strategy", "timeline", "owner", "expected_impact"]
                    }
                  },
                  early_warning_indicators: { type: "array", items: { type: "string" } },
                  financial_impact_estimate: { type: "string" },
                  recommended_owner: { type: "string" }
                },
                required: ["title", "description", "category", "severity", "probability", "impact", "evidence", "mitigation_strategies", "early_warning_indicators", "similar_to_existing", "financial_impact_estimate", "recommended_owner"]
              }
            },
            overall_risk_profile: {
              type: "object",
              properties: {
                level: { type: "string" },
                summary: { type: "string" },
                top_priority: { type: "string" },
                trending: { type: "string" },
                key_metrics: {
                  type: "object",
                  properties: {
                    safety_trend: { type: "string" },
                    schedule_trend: { type: "string" },
                    cost_trend: { type: "string" }
                  },
                  required: ["safety_trend", "schedule_trend", "cost_trend"]
                }
              },
              required: ["level", "summary", "top_priority", "trending", "key_metrics"]
            }
          },
          required: ["identified_risks", "overall_risk_profile"]
        }
      });

      setAnalysis(result);
    } catch (err) {
      console.error('Risk analysis error:', err);
      setError('Failed to complete risk analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateRisk = async (aiRisk, aiRiskIndex) => {
    // Determine which project to assign
    let targetProjectId = projectId;
    if (!targetProjectId && aiRisk.project_ids && aiRisk.project_ids.length > 0) {
      targetProjectId = aiRisk.project_ids[0]; // Use first project if multiple
    }

    if (!targetProjectId) {
      alert('Cannot create risk: No project specified');
      return;
    }

    const riskData = {
      project_id: targetProjectId,
      title: aiRisk.title,
      description: aiRisk.description + '\n\n**Evidence:**\n' + aiRisk.evidence.map(e => `- ${e}`).join('\n'),
      category: aiRisk.category,
      probability: aiRisk.probability,
      impact: aiRisk.impact,
      status: 'Identified',
      source: 'AI Analysis', // Changed source to AI Analysis
      owner: aiRisk.recommended_owner || currentUser?.email || 'AI System', // Use recommended owner or current user
      mitigation_plan: aiRisk.mitigation_strategies.map((s, idx) => 
        `${idx + 1}. ${s.strategy}\n   Timeline: ${s.timeline}\n   Owner: ${s.owner}\n   Expected Impact: ${s.expected_impact}${s.industry_standard ? `\n   Standard: ${s.industry_standard}` : ''}`
      ).join('\n\n'),
      aiRiskIndex, // Store for tracking which AI suggestion this came from
      financial_impact_estimate: aiRisk.financial_impact_estimate,
      early_warning_indicators: aiRisk.early_warning_indicators.join(', ')
    };

    createRiskMutation.mutate(riskData);
  };

  const getSeverityColor = (severity) => {
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
      case 'Quality': return CheckCircle2; // Using CheckCircle2 for Quality
      case 'Legal': return Shield;
      case 'Environmental': return Lightbulb; // Using Lightbulb for Environmental as a placeholder
      default: return Shield;
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const filteredRisks = analysis?.identified_risks?.filter(risk => 
    selectedSeverity === 'all' || risk.severity === selectedSeverity
  ) || [];

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
                <CardTitle className="text-xl">AI Risk Intelligence</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Proactive risk identification from daily logs, schedule deviations, and budget patterns
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
                  Run Analysis
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Risk Analysis</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Our AI analyzes patterns across daily logs, task schedules, budget variances, and change orders 
              to proactively identify potential risks before they become problems.
            </p>
            <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto text-sm">
              <div className="p-4 bg-blue-50 rounded-lg">
                <ClipboardList className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Daily Logs</p>
                <p className="text-blue-700 text-xs mt-1">Pattern recognition</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-900">Schedule</p>
                <p className="text-green-700 text-xs mt-1">Deviation tracking</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-purple-900">Budget</p>
                <p className="text-purple-700 text-xs mt-1">Variance analysis</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                <p className="font-medium text-orange-900">Trends</p>
                <p className="text-orange-700 text-xs mt-1">Predictive insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Project Data...</h3>
            <p className="text-gray-600">
              Examining {dailyLogs.length} daily logs, {tasks.length} tasks, {budgets.length} budgets, 
              and {changeOrders.length} change orders for risk patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Overall Risk Profile */}
          <Card className={`border-2 ${
            analysis.overall_risk_profile.level === 'High' ? 'bg-red-50 border-red-300' :
            analysis.overall_risk_profile.level === 'Medium' ? 'bg-orange-50 border-orange-300' :
            'bg-green-50 border-green-300'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  analysis.overall_risk_profile.level === 'High' ? 'bg-red-200' :
                  analysis.overall_risk_profile.level === 'Medium' ? 'bg-orange-200' :
                  'bg-green-200'
                }`}>
                  <AlertTriangle className={`w-8 h-8 ${
                    analysis.overall_risk_profile.level === 'High' ? 'text-red-700' :
                    analysis.overall_risk_profile.level === 'Medium' ? 'text-orange-700' :
                    'text-green-700'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Overall Risk Profile</h3>
                    <Badge className={getSeverityColor(analysis.overall_risk_profile.level)}>
                      {analysis.overall_risk_profile.level} Risk Level
                    </Badge>
                    {analysis.overall_risk_profile.trending && (
                      <Badge variant="outline" className={`
                        ${analysis.overall_risk_profile.trending === 'Worsening' ? 'border-red-300 text-red-700' :
                          analysis.overall_risk_profile.trending === 'Improving' ? 'border-green-300 text-green-700' :
                          'border-gray-300 text-gray-700'}
                          flex items-center gap-1
                      `}>
                        {analysis.overall_risk_profile.trending === 'Worsening' ? '↗' : 
                         analysis.overall_risk_profile.trending === 'Improving' ? '↘' : '→'} {analysis.overall_risk_profile.trending}
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{analysis.overall_risk_profile.summary}</p>
                  
                  {/* Key Metrics */}
                  {analysis.overall_risk_profile.key_metrics && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-xs">
                        <span className="text-gray-600">Safety:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.overall_risk_profile.key_metrics.safety_trend === 'Worsening' ? 'text-red-600' :
                          analysis.overall_risk_profile.key_metrics.safety_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.overall_risk_profile.key_metrics.safety_trend}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Schedule:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.overall_risk_profile.key_metrics.schedule_trend === 'Worsening' ? 'text-red-600' :
                          analysis.overall_risk_profile.key_metrics.schedule_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.overall_risk_profile.key_metrics.schedule_trend}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-600">Cost:</span>
                        <span className={`ml-2 font-medium ${
                          analysis.overall_risk_profile.key_metrics.cost_trend === 'Worsening' ? 'text-red-600' :
                          analysis.overall_risk_profile.key_metrics.cost_trend === 'Improving' ? 'text-green-600' :
                          'text-gray-700'
                        }`}>
                          {analysis.overall_risk_profile.key_metrics.cost_trend}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 bg-white/60 rounded-lg border border-gray-300">
                    <p className="text-sm font-medium text-gray-900 mb-1">🎯 Top Priority:</p>
                    <p className="text-sm text-gray-700">{analysis.overall_risk_profile.top_priority}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Severity Filter */}
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
            
            <div className="text-sm text-gray-600">
              {createdRisks.size > 0 && (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {createdRisks.size} risk{createdRisks.size !== 1 ? 's' : ''} added to register
                </span>
              )}
            </div>
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
                            <Badge className={getSeverityColor(risk.severity)}>
                              {risk.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {risk.category}
                            </Badge>
                            {risk.similar_to_existing && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                Similar to Existing
                              </Badge>
                            )}
                            {isCreated && (
                              <Badge className="bg-green-100 text-green-800 border-green-300">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Added to Register
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{risk.description}</p>
                          
                          {risk.financial_impact_estimate && (
                            <div className="text-xs text-gray-600 mb-2">
                              <span className="font-medium">Est. Financial Impact:</span> {risk.financial_impact_estimate}
                            </div>
                          )}
                          
                          {risk.project_ids && risk.project_ids.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-600">Affects:</span>
                              {risk.project_ids.map(pid => (
                                <Badge key={pid} variant="outline" className="text-xs">
                                  {getProjectName(pid)}
                                </Badge>
                              ))}
                            </div>
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
                        <p className="text-sm font-semibold text-gray-900">Evidence & Patterns:</p>
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
                        <p className="text-sm font-semibold text-gray-900">Recommended Mitigation Strategies:</p>
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
                        <p className="text-sm font-semibold text-gray-900">Early Warning Indicators to Monitor:</p>
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
                          <span className="text-sm font-medium">Risk added to register successfully</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleCreateRisk(risk, idx)}
                          disabled={createRiskMutation.isPending}
                          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {createRiskMutation.isPending ? 'Adding to Register...' : 'Add to Risk Register'}
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

          {/* Disclaimer */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">AI-Powered Risk Intelligence</p>
                  <p className="text-blue-800">
                    This analysis is generated using AI to identify patterns and trends across your project data. 
                    While designed to provide valuable early warnings, it should be used in conjunction with 
                    professional judgment and direct observation. Review and validate all identified risks with 
                    your project team before taking action.
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
