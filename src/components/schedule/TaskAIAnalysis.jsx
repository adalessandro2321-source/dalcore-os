
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
  Calendar,
  Users,
  Target,
  Zap,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  FileText // New import for Daily Log Issues tab
} from "lucide-react";
import { formatDate } from "../shared/DateFormatter";
import { differenceInDays, format, addDays } from "date-fns";

export default function TaskAIAnalysis({ projectId, project, tasks, onTaskUpdate }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [appliedSuggestions, setAppliedSuggestions] = React.useState(new Set());
  const queryClient = useQueryClient();

  const { data: allProjects = [] } = useQuery({
    queryKey: ['allProjects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks'],
    queryFn: () => base44.entities.Task.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: async () => {
      const all = await base44.entities.DailyLog.list('-log_date');
      // Filter for current project and get recent 30 logs
      return all.filter(d => d.project_id === projectId).slice(0, 30);
    },
    enabled: !!projectId, // Only run if projectId is available
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }) => base44.entities.Task.update(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      // Potentially trigger onTaskUpdate if parent component needs immediate refresh
      // onTaskUpdate && onTaskUpdate();
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Calculate current project metrics
      const today = new Date();
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.percent_complete === 100).length;
      const inProgressTasks = tasks.filter(t => t.percent_complete > 0 && t.percent_complete < 100).length;
      const notStartedTasks = tasks.filter(t => !t.percent_complete || t.percent_complete === 0).length;
      const overdueTasks = tasks.filter(t =>
        t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
      ).length;

      // Analyze task dependencies
      const taskMap = {};
      tasks.forEach(task => {
        taskMap[task.id] = {
          ...task,
          dependents: [], // Tasks that depend on this one
          predecessorCount: task.predecessor_task_ids?.length || 0
        };
      });

      // Build dependency graph
      tasks.forEach(task => {
        if (task.predecessor_task_ids && task.predecessor_task_ids.length > 0) {
          task.predecessor_task_ids.forEach(predId => {
            if (taskMap[predId]) {
              taskMap[predId].dependents.push(task.id);
            }
          });
        }
      });

      // Calculate workload per responsible party
      const workloadByParty = {};
      tasks.filter(t => t.percent_complete < 100 && t.responsible_party_id).forEach(task => {
        const key = task.responsible_party_id;
        if (!workloadByParty[key]) {
          workloadByParty[key] = {
            id: key,
            type: task.responsible_party_type,
            taskCount: 0,
            totalDuration: 0,
            overdueTasks: 0
          };
        }
        workloadByParty[key].taskCount++;
        workloadByParty[key].totalDuration += task.duration_days || 0;
        if (task.finish_date && new Date(task.finish_date) < today) {
          workloadByParty[key].overdueTasks++;
        }
      });

      // Historical completion analysis (from completed projects)
      const completedProjects = allProjects.filter(p =>
        ['Completed', 'Closed'].includes(p.status) && p.start_date && p.actual_completion_date
      );

      const historicalTaskData = allTasks
        .filter(t => t.percent_complete === 100 && t.start_date && t.finish_date)
        .map(t => {
          const planned = t.duration_days || 1;
          const actual = Math.max(1, differenceInDays(new Date(t.finish_date), new Date(t.start_date)) + 1);
          return {
            trade: t.trade,
            planned_duration: planned,
            actual_duration: actual,
            variance_days: actual - planned,
            variance_percent: ((actual - planned) / planned * 100)
          };
        });

      // Calculate average completion variance by trade
      const varianceByTrade = {};
      historicalTaskData.forEach(h => {
        if (!h.trade) return;
        if (!varianceByTrade[h.trade]) {
          varianceByTrade[h.trade] = { count: 0, totalVariance: 0, avgDays: 0 };
        }
        varianceByTrade[h.trade].count++;
        varianceByTrade[h.trade].totalVariance += h.variance_percent;
        varianceByTrade[h.trade].avgDays += h.variance_days;
      });

      Object.keys(varianceByTrade).forEach(trade => {
        const data = varianceByTrade[trade];
        data.avgVariancePercent = data.totalVariance / data.count;
        data.avgVarianceDays = data.avgDays / data.count;
      });

      // Identify critical path tasks
      const criticalPathTasks = tasks.filter(t => t.critical);

      // Analyze daily log issues and their impact on schedule
      const recentIssues = dailyLogs.filter(log =>
        log.issues_delays || log.safety_issues || log.injuries_accidents
      );

      const safetyIssueCount = dailyLogs.filter(log => log.safety_issues).length;
      const injuryCount = dailyLogs.filter(log => log.injuries_accidents).length;

      const issuesByTrade = {};
      // Try to correlate issues with specific trades/tasks
      recentIssues.forEach(log => {
        if (log.subcontractors && log.subcontractors.length > 0) {
          log.subcontractors.forEach(sub => {
            if (sub.trade) { // Ensure trade exists
              if (!issuesByTrade[sub.trade]) {
                issuesByTrade[sub.trade] = {
                  issueCount: 0,
                  safetyIssues: 0,
                  delayDays: 0
                };
              }
              if (log.issues_delays) issuesByTrade[sub.trade].issueCount++;
              if (log.safety_issues) issuesByTrade[sub.trade].safetyIssues++;
            }
          });
        }
      });

      // Calculate average delay impact from recent issues
      const recentDelayLogs = dailyLogs.filter(log =>
        log.issues_delays && log.issues_delays.toLowerCase().includes('delay')
      ).slice(0, 10);

      const analysisData = {
        project: {
          name: project.name,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          not_started_tasks: notStartedTasks,
          overdue_tasks: overdueTasks,
          completion_percent: totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0,
          target_completion: project.target_completion_date,
          days_until_target: project.target_completion_date
            ? differenceInDays(new Date(project.target_completion_date), today)
            : null
        },
        dependencies: {
          tasks_with_dependencies: tasks.filter(t => t.predecessor_task_ids?.length > 0).length,
          tasks_blocking_others: Object.values(taskMap).filter(t => t.dependents.length > 0).length,
          critical_path_length: criticalPathTasks.length,
          max_dependency_depth: Math.max(...Object.values(taskMap).map(t => t.predecessorCount), 0)
        },
        workload: Object.values(workloadByParty).map(w => ({
          party_id: w.id,
          party_type: w.type,
          active_tasks: w.taskCount,
          total_duration_days: w.totalDuration,
          overdue_count: w.overdueTasks
        })),
        historical: {
          completed_projects_analyzed: completedProjects.length,
          completed_tasks_analyzed: historicalTaskData.length,
          trades_with_data: Object.keys(varianceByTrade).length,
          variance_by_trade: varianceByTrade
        },
        daily_log_issues: {
          total_recent_issues: recentIssues.length,
          safety_issues_count: safetyIssueCount,
          injury_count: injuryCount,
          issues_by_trade: issuesByTrade,
          recent_delay_descriptions: recentDelayLogs.map(log => ({
            date: log.log_date,
            issue: log.issues_delays,
            trades_affected: log.subcontractors?.map(s => s.trade).filter(Boolean) || []
          })),
          last_30_days_logs: dailyLogs.length
        },
        current_tasks: tasks.map(t => ({
          id: t.id,
          name: t.name,
          trade: t.trade,
          duration_days: t.duration_days,
          percent_complete: t.percent_complete,
          is_critical: t.critical,
          has_predecessors: (t.predecessor_task_ids?.length || 0) > 0,
          dependent_count: taskMap[t.id]?.dependents?.length || 0,
          responsible_party: t.responsible_party_id,
          start_date: t.start_date,
          finish_date: t.finish_date,
          days_until_due: t.finish_date ? differenceInDays(new Date(t.finish_date), today) : null,
          is_overdue: t.finish_date && new Date(t.finish_date) < today && t.percent_complete < 100
        }))
      };

      const prompt = `You are an expert construction project scheduler and analyst with deep knowledge of CPM scheduling, resource management, and construction sequencing.

Analyze this project's schedule and provide comprehensive AI-powered insights:

PROJECT SCHEDULE DATA:
${JSON.stringify(analysisData, null, 2)}

CRITICAL: Daily Log Issues Analysis
The project has logged ${recentIssues.length} issues in the last 30 days, including:
- ${safetyIssueCount} safety issues
- ${injuryCount} injuries/accidents
- ${recentDelayLogs.length} reported delays

Recent delay descriptions:
${recentDelayLogs.map(log => `[${log.log_date}] ${log.issues_delays}`).join('\n')}

IMPORTANT: When estimating task durations, you MUST factor in:
1. Recent daily log issues and their likely impact on remaining work
2. Safety issues that may slow down work or require additional safety measures
3. Trade-specific issues (some trades having more problems than others)
4. Pattern of delays - are they getting better or worse?
5. Weather, injuries, or recurring issues mentioned in daily logs

Your analysis should include:

1. TASK PRIORITIZATION - Rank top 5-10 tasks that should be prioritized based on:
   - Critical path analysis
   - Dependencies (blocking other tasks)
   - Completion status and deadlines
   - Resource availability
   - Risk of delays from daily log patterns
   - Recent issues affecting this trade/area

2. BOTTLENECK IDENTIFICATION - Identify potential bottlenecks:
   - Tasks with many dependencies
   - Resource constraints (overloaded parties)
   - Critical path delays
   - Tasks trending toward late completion
   - Trades with high issue counts from daily logs

3. COMPLETION TIME ESTIMATES - Provide realistic estimates accounting for:
   - Use historical variance data by trade
   - Account for current progress trends
   - **FACTOR IN recent daily log issues and delays**
   - **ADD buffer for trades with high issue counts**
   - **ADD buffer for safety concerns**
   - Consider project complexity
   - Flag tasks likely to exceed planned duration

   For each task estimate, explicitly consider:
   - Has this trade had safety or delay issues in daily logs?
   - Are there recurring problems affecting this work?
   - Should we add extra days due to recent project issues?

4. ASSIGNMENT RECOMMENDATIONS - Suggest optimal task assignments:
   - Identify overloaded vs underutilized resources
   - Recommend workload rebalancing
   - Suggest bringing in additional resources
   - Consider skill matching by trade
   - Factor in performance issues from daily logs

5. DAILY LOG IMPACT ASSESSMENT - Specific recommendations based on issues:
   - Which tasks need schedule adjustment due to logged issues
   - What mitigation is needed for recurring problems
   - Timeline impact of recent safety/delay issues

Use construction industry best practices (CPM scheduling, resource leveling, earned value management).

Respond in JSON:
{
  "overall_schedule_health": {
    "score": number (0-100),
    "status": "On Track/At Risk/Critical",
    "summary": "Executive summary of schedule health, MENTIONING impact of daily log issues if significant",
    "key_concerns": ["concern 1", "concern 2"],
    "forecast_completion_variance_days": number,
    "daily_log_impact": "How daily log issues are affecting the schedule"
  },
  "priority_tasks": [
    {
      "task_id": "id",
      "task_name": "name",
      "priority_level": "Critical/High/Medium",
      "priority_score": number (0-100),
      "reasons": ["reason 1", "reason 2"],
      "recommended_action": "specific action",
      "deadline_pressure": "Immediate/This Week/This Month",
      "blocking_tasks_count": number,
      "affected_by_daily_log_issues": true/false
    }
  ],
  "bottlenecks": [
    {
      "type": "Resource/Dependency/Timeline/Critical Path/Safety Issue/Quality Issue",
      "severity": "High/Medium/Low",
      "description": "what the bottleneck is",
      "affected_tasks": ["task 1", "task 2"],
      "impact": "how it affects project",
      "resolution": "how to resolve",
      "resolution_timeline": "when to act",
      "related_daily_log_issues": ["issue 1", "issue 2"] or null
    }
  ],
  "completion_estimates": [
    {
      "task_id": "id",
      "task_name": "name",
      "planned_duration_days": number,
      "estimated_actual_duration_days": number,
      "variance_days": number,
      "confidence": "High/Medium/Low",
      "reasoning": "why this estimate, INCLUDE daily log factors if applicable",
      "risk_factors": ["factor 1", "factor 2"],
      "recommended_buffer_days": number,
      "daily_log_adjustment": "None/Minor/Significant - explain if adjusted due to logged issues"
    }
  ],
  "assignment_recommendations": [
    {
      "recommendation_type": "Reassign/Add Resource/Rebalance/Urgent",
      "task_id": "id or null for general",
      "task_name": "name or general recommendation",
      "current_assignment": "current party",
      "current_workload": "workload description",
      "recommended_assignment": "who should do it",
      "reasoning": "why this change, include daily log performance if relevant",
      "expected_benefit": "outcome of change",
      "priority": "High/Medium/Low"
    }
  ],
  "daily_log_recommendations": [
    {
      "issue_type": "Safety/Delay/Quality/Resource",
      "description": "What issue was logged",
      "affected_trades": ["trade 1"],
      "schedule_impact": "How it affects schedule",
      "recommended_action": "What to do about it",
      "tasks_to_adjust": ["task 1", "task 2"]
    }
  ],
  "quick_wins": [
    {
      "action": "specific actionable item",
      "impact": "expected result",
      "effort": "Low/Medium/High",
      "timeline": "how long to implement"
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_schedule_health: {
              type: "object",
              properties: {
                score: { type: "number" },
                status: { type: "string" },
                summary: { type: "string" },
                key_concerns: { type: "array", items: { type: "string" } },
                forecast_completion_variance_days: { type: "number" },
                daily_log_impact: { type: "string" }
              }
            },
            priority_tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_id: { type: "string" },
                  task_name: { type: "string" },
                  priority_level: { type: "string" },
                  priority_score: { type: "number" },
                  reasons: { type: "array", items: { type: "string" } },
                  recommended_action: { type: "string" },
                  deadline_pressure: { type: "string" },
                  blocking_tasks_count: { type: "number" },
                  affected_by_daily_log_issues: { type: "boolean" }
                }
              }
            },
            bottlenecks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  affected_tasks: { type: "array", items: { type: "string" } },
                  impact: { type: "string" },
                  resolution: { type: "string" },
                  resolution_timeline: { type: "string" },
                  related_daily_log_issues: {
                    anyOf: [
                      { type: "array", items: { type: "string" } },
                      { type: "null" }
                    ]
                  }
                }
              }
            },
            completion_estimates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_id: { type: "string" },
                  task_name: { type: "string" },
                  planned_duration_days: { type: "number" },
                  estimated_actual_duration_days: { type: "number" },
                  variance_days: { type: "number" },
                  confidence: { type: "string" },
                  reasoning: { type: "string" },
                  risk_factors: { type: "array", items: { type: "string" } },
                  recommended_buffer_days: { type: "number" },
                  daily_log_adjustment: { type: "string" }
                }
              }
            },
            assignment_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  recommendation_type: { type: "string" },
                  task_id: { anyOf: [{ type: "string" }, { type: "null" }] },
                  task_name: { type: "string" },
                  current_assignment: { type: "string" },
                  current_workload: { type: "string" },
                  recommended_assignment: { type: "string" },
                  reasoning: { type: "string" },
                  expected_benefit: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            daily_log_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issue_type: { type: "string" },
                  description: { type: "string" },
                  affected_trades: { type: "array", items: { type: "string" } },
                  schedule_impact: { type: "string" },
                  recommended_action: { type: "string" },
                  tasks_to_adjust: { type: "array", items: { type: "string" } }
                }
              }
            },
            quick_wins: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  impact: { type: "string" },
                  effort: { type: "string" },
                  timeline: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAnalysis(result);
      setAppliedSuggestions(new Set()); // Reset applied suggestions when new analysis runs
    } catch (err) {
      console.error('Task AI analysis error:', err);
      setError('Failed to complete AI analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
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

  const getPriorityColor = (level) => {
    switch (level) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return 'border-l-4 border-red-500 bg-red-50';
      case 'Medium': return 'border-l-4 border-orange-500 bg-orange-50';
      case 'Low': return 'border-l-4 border-yellow-500 bg-yellow-50';
      default: return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const getResponsiblePartyName = (partyId, partyType) => {
    if (!partyId) return 'Unassigned';
    if (partyType === 'User') {
      const user = users.find(u => u.email === partyId);
      return user?.full_name || partyId;
    } else {
      const company = companies.find(c => c.id === partyId);
      return company?.name || partyId;
    }
  };

  const handleApplyDurationEstimate = async (estimate) => {
    const task = tasks.find(t => t.id === estimate.task_id);
    if (!task || !task.start_date) {
      alert("Cannot apply estimate: Task not found or start date is missing.");
      return;
    }

    const newDuration = estimate.estimated_actual_duration_days + estimate.recommended_buffer_days;
    const startDate = new Date(task.start_date);
    // duration_days includes start date, so add (duration - 1) days to start date to get finish date
    const newFinishDate = format(addDays(startDate, newDuration - 1), 'yyyy-MM-dd');

    try {
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        updates: {
          duration_days: newDuration,
          finish_date: newFinishDate
        }
      });
      setAppliedSuggestions(prev => new Set([...prev, `duration-${estimate.task_id}`]));
    } catch (err) {
      console.error('Failed to apply duration estimate:', err);
      alert('Failed to apply duration estimate. Please try again.');
    }
  };

  const handleApplyAssignment = async (recommendation) => {
    if (!recommendation.task_id) {
      alert("Cannot apply assignment: Task ID is missing for this recommendation.");
      return;
    }

    // Parse the recommended assignment to find the actual party
    let responsiblePartyId = null;
    let responsiblePartyType = null;

    // Try to find matching user
    const matchingUser = users.find(u =>
      u.full_name?.toLowerCase().includes(recommendation.recommended_assignment.toLowerCase()) ||
      u.email?.toLowerCase().includes(recommendation.recommended_assignment.toLowerCase())
    );

    if (matchingUser) {
      responsiblePartyId = matchingUser.email;
      responsiblePartyType = 'User';
    } else {
      // Try to find matching company
      const matchingCompany = companies.find(c =>
        c.name?.toLowerCase().includes(recommendation.recommended_assignment.toLowerCase())
      );

      if (matchingCompany) {
        responsiblePartyId = matchingCompany.id;
        responsiblePartyType = 'Company';
      }
    }

    if (responsiblePartyId && responsiblePartyType) {
      try {
        await updateTaskMutation.mutateAsync({
          taskId: recommendation.task_id,
          updates: {
            responsible_party_id: responsiblePartyId,
            responsible_party_type: responsiblePartyType
          }
        });
        setAppliedSuggestions(prev => new Set([...prev, `assignment-${recommendation.task_id}`]));
      } catch (err) {
        console.error('Failed to apply assignment:', err);
        alert('Failed to apply assignment. Please try again.');
      }
    } else {
      alert(`Could not find a user or company matching "${recommendation.recommended_assignment}". Please ensure the recommended party exists in your system.`);
    }
  };

  const isEstimateApplied = (estimateId) => appliedSuggestions.has(`duration-${estimateId}`);
  const isAssignmentApplied = (taskId) => appliedSuggestions.has(`assignment-${taskId}`);


  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Schedule Intelligence</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Smart task prioritization, bottleneck detection & workload optimization
                </p>
              </div>
            </div>
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing || tasks.length === 0}
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
            <Brain className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Schedule Analysis</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Get intelligent insights on task prioritization, bottleneck identification,
              completion estimates, and optimal resource assignments. Analysis includes
              impact assessment from daily log issues and delays.
            </p>
            {tasks.length === 0 ? (
              <p className="text-sm text-orange-600">Add tasks to this project to enable AI analysis</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto text-sm">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                  <p className="font-medium text-purple-900">Smart Prioritization</p>
                  <p className="text-purple-700 text-xs mt-1">Critical path & dependency analysis</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                  <p className="font-medium text-indigo-900">Issue Impact</p>
                  <p className="text-indigo-700 text-xs mt-1">Daily log delays factored in</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <p className="font-medium text-blue-900">Duration Estimates</p>
                  <p className="text-blue-700 text-xs mt-1">Based on historical + recent issues</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <Users className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="font-medium text-green-900">Assignment Optimization</p>
                  <p className="text-green-700 text-xs mt-1">Balance workload & skills</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Schedule...</h3>
            <p className="text-gray-600">
              Processing {tasks.length} tasks, {dailyLogs.length} daily logs, analyzing dependencies,
              workload distribution, historical completion patterns, and recent issue impacts...
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Overall Schedule Health */}
          <Card className={`border-2 ${getHealthScoreBg(analysis.overall_schedule_health.score)}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  analysis.overall_schedule_health.score >= 80 ? 'bg-green-200' :
                  analysis.overall_schedule_health.score >= 60 ? 'bg-yellow-200' :
                  analysis.overall_schedule_health.score >= 40 ? 'bg-orange-200' : 'bg-red-200'
                }`}>
                  <div className={`text-2xl font-bold ${getHealthScoreColor(analysis.overall_schedule_health.score)}`}>
                    {analysis.overall_schedule_health.score}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Schedule Health</h3>
                    <Badge variant="outline" className={
                      analysis.overall_schedule_health.status === 'Critical' ? 'border-red-300 text-red-700 bg-red-50' :
                      analysis.overall_schedule_health.status === 'At Risk' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                      'border-green-300 text-green-700 bg-green-50'
                    }>
                      {analysis.overall_schedule_health.status}
                    </Badge>
                    {analysis.overall_schedule_health.forecast_completion_variance_days && (
                      <Badge variant="outline">
                        {analysis.overall_schedule_health.forecast_completion_variance_days > 0 ? '⚠️' : '✓'}
                        {Math.abs(analysis.overall_schedule_health.forecast_completion_variance_days)} days {
                          analysis.overall_schedule_health.forecast_completion_variance_days > 0 ? 'behind' : 'ahead'
                        }
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{analysis.overall_schedule_health.summary}</p>

                  {analysis.overall_schedule_health.daily_log_impact && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-3">
                      <p className="text-sm font-medium text-orange-900 mb-1">📋 Daily Log Impact:</p>
                      <p className="text-sm text-orange-800">{analysis.overall_schedule_health.daily_log_impact}</p>
                    </div>
                  )}

                  {analysis.overall_schedule_health.key_concerns?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">Key Concerns:</p>
                      <ul className="space-y-1">
                        {analysis.overall_schedule_health.key_concerns.map((concern, idx) => (
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

          <Tabs defaultValue="priority" className="space-y-6">
            <TabsList className="bg-[#F5F4F3] border border-gray-200">
              <TabsTrigger value="priority" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Target className="w-4 h-4 mr-2" />
                Priority Tasks
              </TabsTrigger>
              <TabsTrigger value="bottlenecks" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Bottlenecks
              </TabsTrigger>
              <TabsTrigger value="estimates" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Duration Estimates
              </TabsTrigger>
              <TabsTrigger value="assignments" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Assignments
              </TabsTrigger>
              {analysis.daily_log_recommendations && analysis.daily_log_recommendations.length > 0 && (
                <TabsTrigger value="dailylog" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  Daily Log Issues
                </TabsTrigger>
              )}
              <TabsTrigger value="wins" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
                <Zap className="w-4 h-4 mr-2" />
                Quick Wins
              </TabsTrigger>
            </TabsList>

            <TabsContent value="priority" className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Tasks prioritized by critical path, dependencies, deadlines, and daily log issue impacts
              </p>
              {analysis.priority_tasks.map((task, idx) => {
                const taskData = tasks.find(t => t.id === task.task_id);

                return (
                  <Card key={idx} className="bg-white border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                            idx === 0 ? 'bg-red-100 text-red-700' :
                            idx === 1 ? 'bg-orange-100 text-orange-700' :
                            idx === 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">{task.task_name}</h4>
                              <Badge className={getPriorityColor(task.priority_level)}>
                                {task.priority_level} Priority
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Score: {task.priority_score}
                              </Badge>
                              {task.affected_by_daily_log_issues && (
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                                  📋 Issue Impact
                                </Badge>
                              )}
                            </div>

                            {taskData && (
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                <span>{taskData.percent_complete || 0}% complete</span>
                                {taskData.finish_date && (
                                  <>
                                    <span>•</span>
                                    <span>Due: {formatDate(taskData.finish_date)}</span>
                                  </>
                                )}
                                {taskData.responsible_party_id && (
                                  <>
                                    <span>•</span>
                                    <span>{getResponsiblePartyName(taskData.responsible_party_id, taskData.responsible_party_type)}</span>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-medium text-gray-700 mb-1">Why prioritize:</p>
                                <ul className="space-y-1">
                                  {task.reasons.map((reason, i) => (
                                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                      <span className="text-purple-600 mt-1">•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-blue-900 mb-1">Recommended Action:</p>
                                  <p className="text-sm text-blue-800">{task.recommended_action}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-xs">
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                  {task.deadline_pressure}
                                </Badge>
                                {task.blocking_tasks_count > 0 && (
                                  <span className="text-gray-600">
                                    Blocking {task.blocking_tasks_count} other task{task.blocking_tasks_count !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="bottlenecks" className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Potential schedule bottlenecks including those identified from daily log patterns
              </p>
              {analysis.bottlenecks.map((bottleneck, idx) => (
                <Card key={idx} className={`${getSeverityColor(bottleneck.severity)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-6 h-6 mt-1 flex-shrink-0 ${
                        bottleneck.severity === 'High' ? 'text-red-600' :
                        bottleneck.severity === 'Medium' ? 'text-orange-600' :
                        'text-yellow-600'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="text-xs">{bottleneck.type}</Badge>
                          <Badge variant="outline" className="text-xs">{bottleneck.severity} Severity</Badge>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">{bottleneck.description}</h4>

                        {bottleneck.related_daily_log_issues && bottleneck.related_daily_log_issues.length > 0 && (
                          <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded">
                            <p className="text-xs font-medium text-orange-900 mb-1">Related Daily Log Issues:</p>
                            <ul className="text-xs text-orange-800 space-y-0.5">
                              {bottleneck.related_daily_log_issues.map((issue, i) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bottleneck.affected_tasks?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-700 mb-1">Affected Tasks:</p>
                            <div className="flex flex-wrap gap-1">
                              {bottleneck.affected_tasks.map((taskName, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {taskName}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Impact:</span>
                            <p className="text-gray-600">{bottleneck.impact}</p>
                          </div>

                          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-green-900 mb-1">
                                Resolution ({bottleneck.resolution_timeline}):
                              </p>
                              <p className="text-sm text-green-800">{bottleneck.resolution}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="estimates" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Duration estimates adjusted for historical performance AND recent daily log issues
                </p>
                <p className="text-xs text-gray-600">
                  <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-600" />
                  {Array.from(appliedSuggestions).filter(s => s.startsWith('duration-')).length} applied
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F4F3] border-b border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Task</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Current</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Estimated</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">+Buffer</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">New Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Confidence</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Log Impact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Reasoning</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analysis.completion_estimates.map((estimate, idx) => {
                      const applied = isEstimateApplied(estimate.task_id);
                      const hasLogAdjustment = estimate.daily_log_adjustment &&
                        !estimate.daily_log_adjustment.startsWith('None');

                      return (
                        <tr key={idx} className={`hover:bg-gray-50 ${applied ? 'bg-green-50' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {estimate.task_name}
                            {applied && (
                              <CheckCircle2 className="w-4 h-4 inline ml-2 text-green-600" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900">
                            {estimate.planned_duration_days}d
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-900">
                            {estimate.estimated_actual_duration_days}d
                          </td>
                          <td className="px-4 py-3 text-center text-orange-600 font-medium">
                            +{estimate.recommended_buffer_days}d
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-600">
                            {estimate.estimated_actual_duration_days + estimate.recommended_buffer_days}d
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={
                              estimate.confidence === 'High' ? 'bg-green-50 text-green-700 border-green-300' :
                              estimate.confidence === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                              'bg-orange-50 text-orange-700 border-orange-300'
                            }>
                              {estimate.confidence}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasLogAdjustment ? (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                                Adjusted
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-500">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-md">
                            <details className="cursor-pointer">
                              <summary className="text-sm hover:text-gray-900">View details</summary>
                              <div className="mt-2 space-y-2 text-xs">
                                <p>{estimate.reasoning}</p>
                                {estimate.daily_log_adjustment && (
                                  <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                                    <p className="font-medium text-orange-900">Daily Log Factor:</p>
                                    <p className="text-orange-800">{estimate.daily_log_adjustment}</p>
                                  </div>
                                )}
                                {estimate.risk_factors?.length > 0 && (
                                  <div>
                                    <p className="font-medium">Risk Factors:</p>
                                    <ul className="list-disc list-inside">
                                      {estimate.risk_factors.map((factor, i) => (
                                        <li key={i}>{factor}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </details>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {applied ? (
                              <Badge className="bg-green-100 text-green-800">
                                Applied
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleApplyDurationEstimate(estimate)}
                                disabled={updateTaskMutation.isPending}
                                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white h-7 text-xs"
                              >
                                Apply
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Card className="bg-blue-50 border-blue-200 mt-4">
                <CardContent className="p-4 text-sm">
                  <p className="text-blue-900">
                    💡 <strong>Note:</strong> Duration estimates factor in both historical performance data
                    and recent daily log issues. Tasks affected by logged problems have additional buffer days added.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Resource optimization recommendations for balanced workload and improved efficiency
                </p>
                <p className="text-xs text-gray-600">
                  <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-600" />
                  {Array.from(appliedSuggestions).filter(s => s.startsWith('assignment-')).length} applied
                </p>
              </div>
              {analysis.assignment_recommendations.map((rec, idx) => {
                const applied = rec.task_id && isAssignmentApplied(rec.task_id);
                return (
                  <Card key={idx} className={`border-gray-200 ${
                    rec.priority === 'High' ? 'border-l-4 border-l-red-500' :
                    rec.priority === 'Medium' ? 'border-l-4 border-l-orange-500' :
                    'border-l-4 border-l-blue-500'
                  } ${applied ? 'bg-green-50' : 'bg-white'}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          rec.recommendation_type === 'Urgent' ? 'bg-red-100' :
                          rec.recommendation_type === 'Reassign' ? 'bg-orange-100' :
                          rec.recommendation_type === 'Add Resource' ? 'bg-green-100' :
                          'bg-blue-100'
                        }`}>
                          <Users className={`w-5 h-5 ${
                            rec.recommendation_type === 'Urgent' ? 'text-red-700' :
                            rec.recommendation_type === 'Reassign' ? 'text-orange-700' :
                            rec.recommendation_type === 'Add Resource' ? 'text-green-700' :
                            'text-blue-700'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="text-xs">{rec.recommendation_type}</Badge>
                            <Badge variant="outline" className="text-xs">{rec.priority} Priority</Badge>
                            {applied && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Applied
                              </Badge>
                            )}
                          </div>

                          <h4 className="font-semibold text-gray-900 mb-3">{rec.task_name}</h4>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">Current Assignment:</p>
                              <p className="text-sm text-gray-900">{rec.current_assignment}</p>
                              <p className="text-xs text-gray-600 mt-1">{rec.current_workload}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">Recommended Assignment:</p>
                              <p className="text-sm font-medium text-green-700">{rec.recommended_assignment}</p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm mb-3">
                            <div>
                              <span className="font-medium text-gray-700">Reasoning:</span>
                              <p className="text-gray-600">{rec.reasoning}</p>
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-green-900 mb-1">Expected Benefit:</p>
                                <p className="text-sm text-green-800">{rec.expected_benefit}</p>
                              </div>
                            </div>
                          </div>

                          {rec.task_id && !applied && (
                            <Button
                              size="sm"
                              onClick={() => handleApplyAssignment(rec)}
                              disabled={updateTaskMutation.isPending}
                              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Apply Assignment
                            </Button>
                          )}
                          {!rec.task_id && (
                            <p className="text-xs text-gray-600 italic">
                              This is a general recommendation - apply manually to specific tasks
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {analysis.daily_log_recommendations && analysis.daily_log_recommendations.length > 0 && (
              <TabsContent value="dailylog" className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Schedule recommendations based on issues identified in recent daily logs
                </p>
                {analysis.daily_log_recommendations.map((rec, idx) => (
                  <Card key={idx} className="bg-white border-l-4 border-l-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-orange-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className="text-xs bg-orange-100 text-orange-800">{rec.issue_type}</Badge>
                            {rec.affected_trades?.map((trade, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {trade}
                              </Badge>
                            ))}
                          </div>

                          <h4 className="font-semibold text-gray-900 mb-2">{rec.description}</h4>

                          <div className="space-y-2 text-sm">
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="font-medium text-red-900 mb-1">Schedule Impact:</p>
                              <p className="text-red-800">{rec.schedule_impact}</p>
                            </div>

                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="font-medium text-green-900 mb-1">Recommended Action:</p>
                              <p className="text-green-800">{rec.recommended_action}</p>
                            </div>

                            {rec.tasks_to_adjust?.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Tasks to Adjust:</p>
                                <div className="flex flex-wrap gap-2">
                                  {rec.tasks_to_adjust.map((taskName, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {taskName}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            )}

            <TabsContent value="wins" className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                High-impact, low-effort actions you can take immediately to improve schedule performance
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.quick_wins.map((win, idx) => (
                  <Card key={idx} className="bg-white border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <Zap className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={`text-xs ${
                              win.effort === 'Low' ? 'bg-green-50 text-green-700 border-green-300' :
                              win.effort === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                              'bg-orange-50 text-orange-700 border-orange-300'
                            }`}>
                              {win.effort} Effort
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {win.timeline}
                            </Badge>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{win.action}</p>
                          <div className="flex items-start gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-600">{win.impact}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
