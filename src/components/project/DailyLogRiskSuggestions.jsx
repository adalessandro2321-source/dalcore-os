import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, X, ExternalLink, CheckCircle } from "lucide-react";
import { formatDate } from "../shared/DateFormatter";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STORAGE_KEY_PREFIX = 'dailylog_suggestions_';

export default function DailyLogRiskSuggestions({ projectId }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Load dismissed and resolved suggestions from localStorage
  const [dismissedSuggestions, setDismissedSuggestions] = React.useState(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}_dismissed`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [resolvedSuggestions, setResolvedSuggestions] = React.useState(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}_resolved`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [suggestionStatuses, setSuggestionStatuses] = React.useState({});

  // Persist dismissed suggestions to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${projectId}_dismissed`,
        JSON.stringify(dismissedSuggestions)
      );
    } catch (error) {
      console.error('Failed to save dismissed suggestions:', error);
    }
  }, [dismissedSuggestions, projectId]);

  // Persist resolved suggestions to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${projectId}_resolved`,
        JSON.stringify(resolvedSuggestions)
      );
    } catch (error) {
      console.error('Failed to save resolved suggestions:', error);
    }
  }, [resolvedSuggestions, projectId]);

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: () => base44.entities.DailyLog.filter({ project_id: projectId }, '-log_date'),
    enabled: !!projectId,
  });

  const { data: existingRisks = [] } = useQuery({
    queryKey: ['risks', projectId],
    queryFn: () => base44.entities.Risk.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const createRiskMutation = useMutation({
    mutationFn: (data) => base44.entities.Risk.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks', projectId] });
    },
  });

  const dailyLogsWithRisks = new Set(
    existingRisks
      .filter(r => r.daily_log_id)
      .map(r => r.daily_log_id)
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const suggestions = React.useMemo(() => {
    return dailyLogs
      .filter(log => new Date(log.log_date) >= thirtyDaysAgo)
      .filter(log => !dismissedSuggestions.includes(log.id))
      .filter(log => !resolvedSuggestions.includes(log.id))
      .flatMap(log => {
        const risks = [];

        if (log.safety_issues && log.safety_issues_description && !dailyLogsWithRisks.has(`${log.id}-safety`)) {
          risks.push({
            id: `${log.id}-safety`,
            dailyLogId: log.id,
            logDate: log.log_date,
            title: "Safety Issue Reported",
            description: log.safety_issues_description,
            category: "Safety",
            source: "Daily Log - Safety",
            probability: "Medium",
            impact: "High"
          });
        }

        if (log.injuries_accidents && log.injuries_accidents_description && !dailyLogsWithRisks.has(`${log.id}-injury`)) {
          risks.push({
            id: `${log.id}-injury`,
            dailyLogId: log.id,
            logDate: log.log_date,
            title: "Injury/Accident Reported",
            description: log.injuries_accidents_description,
            category: "Safety",
            source: "Daily Log - Injury",
            probability: "High",
            impact: "High"
          });
        }

        if (log.issues_delays && log.issues_delays.trim().length > 0 && !dailyLogsWithRisks.has(`${log.id}-issue`)) {
          const content = log.issues_delays.toLowerCase();
          let category = "Schedule";
          if (content.includes('cost') || content.includes('budget') || content.includes('money')) {
            category = "Cost";
          } else if (content.includes('quality') || content.includes('defect')) {
            category = "Quality";
          } else if (content.includes('weather') || content.includes('environmental')) {
            category = "Environmental";
          }

          risks.push({
            id: `${log.id}-issue`,
            dailyLogId: log.id,
            logDate: log.log_date,
            title: "Issue/Delay from Daily Log",
            description: log.issues_delays,
            category: category,
            source: "Daily Log - Issue/Delay",
            probability: "Medium",
            impact: "Medium"
          });
        }

        return risks;
      });
  }, [dailyLogs, dismissedSuggestions, resolvedSuggestions, dailyLogsWithRisks, thirtyDaysAgo]);

  const handleCreateRisk = async (suggestion) => {
    const status = suggestionStatuses[suggestion.id] || "Identified";
    
    await createRiskMutation.mutateAsync({
      project_id: projectId,
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      probability: suggestion.probability,
      impact: suggestion.impact,
      status: status,
      daily_log_id: `${suggestion.dailyLogId}-${suggestion.source.split(' - ')[1].toLowerCase().replace('/', '')}`,
      source: suggestion.source,
      owner: currentUser?.email || '',
      // If status is Mitigated, set the mitigation completion info
      ...(status === 'Mitigated' ? {
        mitigation_complete_date: new Date().toISOString(),
        mitigation_complete_by: currentUser?.email || ''
      } : {})
    });
    
    // Add to dismissed suggestions so it doesn't show up again
    setDismissedSuggestions(prev => [...prev, suggestion.dailyLogId]);
  };

  const handleDismiss = (suggestionId) => {
    const dailyLogId = suggestionId.split('-')[0];
    setDismissedSuggestions(prev => [...prev, dailyLogId]);
  };

  const handleMarkResolved = (suggestionId) => {
    const dailyLogId = suggestionId.split('-')[0];
    setResolvedSuggestions(prev => [...prev, dailyLogId]);
  };

  const handleStatusChange = (suggestionId, status) => {
    setSuggestionStatuses({
      ...suggestionStatuses,
      [suggestionId]: status
    });
  };

  const handleNavigateToDailyLog = (dailyLogId) => {
    navigate(createPageUrl(`ProjectDetail?id=${projectId}#dailylogs`));
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-orange-50 border-orange-200">
      <CardHeader className="border-b border-orange-200">
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertTriangle className="w-5 h-5" />
          Risk Suggestions from Daily Logs ({suggestions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <p className="text-sm text-orange-800 mb-4">
          The following potential risks were identified from recent daily logs:
        </p>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-white rounded-lg p-4 border border-orange-200 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {suggestion.title}
                    </span>
                    <button
                      onClick={() => handleNavigateToDailyLog(suggestion.dailyLogId)}
                      className="text-xs text-gray-600 hover:text-[#0E351F] flex items-center gap-1"
                      title="View daily log"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {formatDate(suggestion.logDate)}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      suggestion.category === 'Safety' ? 'bg-red-100 text-red-800' :
                      suggestion.category === 'Schedule' ? 'bg-yellow-100 text-yellow-800' :
                      suggestion.category === 'Cost' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {suggestion.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{suggestion.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>Probability: {suggestion.probability}</span>
                    <span>Impact: {suggestion.impact}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-orange-100">
                <Select
                  value={suggestionStatuses[suggestion.id] || "Identified"}
                  onValueChange={(value) => handleStatusChange(suggestion.id, value)}
                >
                  <SelectTrigger className="h-8 w-32 bg-white border-gray-300 text-xs">
                    <SelectValue placeholder="Set status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Identified">Identified</SelectItem>
                    <SelectItem value="Monitoring">Monitoring</SelectItem>
                    <SelectItem value="Mitigated">Mitigated</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={() => handleCreateRisk(suggestion)}
                  disabled={createRiskMutation.isPending}
                  className="bg-[#1B4D3E] hover:bg-[#14503C] text-white h-8 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Risk
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkResolved(suggestion.id)}
                  className="text-green-700 border-green-300 hover:bg-green-50 h-8 text-xs"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Resolved
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(suggestion.id)}
                  className="text-gray-600 hover:text-gray-900 h-8 ml-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}