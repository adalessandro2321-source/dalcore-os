import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Brain, 
  Loader2, 
  FileText, 
  Tag,
  Link as LinkIcon,
  Calendar,
  DollarSign,
  Users,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Check,
  X,
  ClipboardList,
  CalendarPlus,
  Receipt,
  FileCheck
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DocumentAIAnalysis({ document, projectId, onUpdate }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedItems, setSelectedItems] = React.useState({
    tasks: [],
    financials: [],
    dates: [],
    changeOrders: []
  });
  const [applyingData, setApplyingData] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => base44.entities.Document.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: projectBudget } = useQuery({
    queryKey: ['projectBudget', projectId],
    queryFn: async () => {
      const budgets = await base44.entities.ProjectBudget.filter({ project_id: projectId });
      return budgets[0];
    },
    enabled: !!projectId,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      if (onUpdate) onUpdate();
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: (data) => {
      if (projectBudget?.id) {
        return base44.entities.ProjectBudget.update(projectBudget.id, data);
      }
      return base44.entities.ProjectBudget.create({ project_id: projectId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
    },
  });

  const createChangeOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.ChangeOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
    },
  });

  const analyzeDocument = async () => {
    if (!document || !document.file_url) return;
    
    setIsAnalyzing(true);
    setError(null);
    setSelectedItems({ tasks: [], financials: [], dates: [], changeOrders: [] });

    try {
      const otherDocuments = allDocuments
        .filter(d => d.id !== document.id)
        .map(d => ({
          id: d.id,
          name: d.name,
          folder: d.folder,
          type: d.type,
          description: d.description,
          tags: d.tags
        }));

      const prompt = `You are an expert construction document analyst. Analyze this document and extract actionable data that can be imported into project management systems.

DOCUMENT DETAILS:
- Name: ${document.name}
- Current Folder: ${document.folder || 'Not categorized'}
- Current Type: ${document.type || 'Unknown'}

PROJECT CONTEXT:
- Project Name: ${project?.name || 'Unknown'}
- Current Contract Value: ${project?.contract_value || 0}
- Current Start Date: ${project?.start_date || 'Not set'}
- Current Target Completion: ${project?.target_completion_date || 'Not set'}

Provide structured analysis with ACTIONABLE DATA that can be directly imported:

1. CATEGORIZATION - Smart folder/type recommendations

2. ACTIONABLE SCHEDULE DATA - Tasks/milestones that can be created
   - Extract specific tasks with dates, durations, responsible parties
   - Include predecessor/successor relationships if mentioned
   - Extract any schedule milestones

3. ACTIONABLE FINANCIAL DATA - Financial figures that can update project budgets
   - Contract amounts, change order values, costs
   - Include what field each amount should update (contract_value, budget, etc.)

4. ACTIONABLE PROJECT DATES - Dates that can update project settings
   - Start dates, completion dates, key milestones
   - Specify which project field to update

5. ACTIONABLE CHANGE ORDERS - If this is a change order or mentions scope changes
   - Extract CO number, description, cost impact, schedule impact

6. TAGS & RELATIONSHIPS

7. SUMMARY with key points and concerns

Respond in JSON with this structure for actionable items:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        file_urls: [document.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            categorization: {
              type: "object",
              properties: {
                recommended_folder: { type: "string" },
                recommended_type: { type: "string" },
                confidence: { type: "string" },
                reasoning: { type: "string" }
              }
            },
            actionable_tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  start_date: { type: "string" },
                  finish_date: { type: "string" },
                  duration_days: { type: "number" },
                  responsible_party: { type: "string" },
                  trade: { type: "string" },
                  predecessors: { type: "string" },
                  confidence: { type: "string" }
                }
              }
            },
            actionable_financials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  amount: { type: "number" },
                  target_field: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "string" }
                }
              }
            },
            actionable_dates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  date: { type: "string" },
                  target_field: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "string" }
                }
              }
            },
            actionable_change_orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  number: { type: "string" },
                  reason: { type: "string" },
                  description: { type: "string" },
                  cost_impact: { type: "number" },
                  schedule_impact_days: { type: "number" },
                  confidence: { type: "string" }
                }
              }
            },
            tags: {
              type: "object",
              properties: {
                suggested_tags: { type: "array", items: { type: "string" } },
                trade: { anyOf: [{ type: "string" }, { type: "null" }] },
                location: { anyOf: [{ type: "string" }, { type: "null" }] },
                priority: { anyOf: [{ type: "string" }, { type: "null" }] }
              }
            },
            relationships: {
              type: "object",
              properties: {
                related_documents: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      document_id: { type: "string" },
                      document_name: { type: "string" },
                      relationship_type: { type: "string" },
                      description: { type: "string" }
                    }
                  }
                }
              }
            },
            summary: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                issues_concerns: { type: "array", items: { type: "string" } },
                decisions_approvals: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });

      setAnalysis(result);
    } catch (err) {
      console.error('Document AI analysis error:', err);
      setError('Failed to analyze document. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleItemSelection = (category, index) => {
    setSelectedItems(prev => {
      const current = prev[category] || [];
      if (current.includes(index)) {
        return { ...prev, [category]: current.filter(i => i !== index) };
      } else {
        return { ...prev, [category]: [...current, index] };
      }
    });
  };

  const selectAllInCategory = (category, items) => {
    setSelectedItems(prev => ({
      ...prev,
      [category]: items.map((_, idx) => idx)
    }));
  };

  const deselectAllInCategory = (category) => {
    setSelectedItems(prev => ({
      ...prev,
      [category]: []
    }));
  };

  const applySelectedData = async () => {
    setApplyingData(true);
    
    try {
      // Apply selected tasks
      if (selectedItems.tasks.length > 0 && analysis?.actionable_tasks) {
        for (const idx of selectedItems.tasks) {
          const task = analysis.actionable_tasks[idx];
          await createTaskMutation.mutateAsync({
            project_id: projectId,
            name: task.name,
            description: task.description || '',
            start_date: task.start_date || null,
            finish_date: task.finish_date || null,
            duration_days: task.duration_days || null,
            trade: task.trade || null,
            notes: `Extracted from document: ${document.name}`
          });
        }
      }

      // Apply selected financials
      if (selectedItems.financials.length > 0 && analysis?.actionable_financials) {
        const projectUpdates = {};
        const budgetUpdates = {};

        for (const idx of selectedItems.financials) {
          const financial = analysis.actionable_financials[idx];
          const field = financial.target_field?.toLowerCase();
          
          if (field === 'contract_value' || field === 'contract value') {
            projectUpdates.contract_value = financial.amount;
          } else if (field === 'budget') {
            projectUpdates.budget = financial.amount;
          } else if (field === 'original_contract_value') {
            budgetUpdates.original_contract_value = financial.amount;
            budgetUpdates.revised_contract_value = financial.amount;
          }
        }

        if (Object.keys(projectUpdates).length > 0) {
          await updateProjectMutation.mutateAsync(projectUpdates);
        }
        if (Object.keys(budgetUpdates).length > 0) {
          await updateBudgetMutation.mutateAsync(budgetUpdates);
        }
      }

      // Apply selected dates
      if (selectedItems.dates.length > 0 && analysis?.actionable_dates) {
        const projectUpdates = {};

        for (const idx of selectedItems.dates) {
          const dateItem = analysis.actionable_dates[idx];
          const field = dateItem.target_field?.toLowerCase();
          
          if (field === 'start_date' || field === 'start date') {
            projectUpdates.start_date = dateItem.date;
          } else if (field === 'target_completion_date' || field === 'completion date' || field === 'end date') {
            projectUpdates.target_completion_date = dateItem.date;
          }
        }

        if (Object.keys(projectUpdates).length > 0) {
          await updateProjectMutation.mutateAsync(projectUpdates);
        }
      }

      // Apply selected change orders
      if (selectedItems.changeOrders.length > 0 && analysis?.actionable_change_orders) {
        for (const idx of selectedItems.changeOrders) {
          const co = analysis.actionable_change_orders[idx];
          await createChangeOrderMutation.mutateAsync({
            project_id: projectId,
            number: co.number || `CO-${Date.now().toString().slice(-6)}`,
            reason: co.reason || 'Scope Change',
            description: co.description || '',
            cost_impact: co.cost_impact || 0,
            schedule_impact_days: co.schedule_impact_days || 0,
            status: 'Pending',
            notes: `Extracted from document: ${document.name}`
          });
        }
      }

      // Clear selections after successful apply
      setSelectedItems({ tasks: [], financials: [], dates: [], changeOrders: [] });
      
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error applying data:', err);
      setError('Failed to apply some data. Please try again.');
    } finally {
      setApplyingData(false);
    }
  };

  const handleApplyCategorization = async () => {
    if (!analysis?.categorization) return;

    await updateDocumentMutation.mutateAsync({
      id: document.id,
      data: {
        folder: analysis.categorization.recommended_folder,
        type: analysis.categorization.recommended_type
      }
    });
  };

  const handleApplyTags = async () => {
    if (!analysis?.tags?.suggested_tags) return;

    await updateDocumentMutation.mutateAsync({
      id: document.id,
      data: {
        tags: [...new Set([...(document.tags || []), ...analysis.tags.suggested_tags])]
      }
    });
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'High': return 'bg-green-100 text-green-800 border-green-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTotalSelectedCount = () => {
    return selectedItems.tasks.length + 
           selectedItems.financials.length + 
           selectedItems.dates.length + 
           selectedItems.changeOrders.length;
  };

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI Document Analysis</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Extract schedule, financial data & more - then accept or reject
                </p>
              </div>
            </div>
            <Button
              onClick={analyzeDocument}
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
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Document
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
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Document Intelligence</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Extract actionable data from contracts, proposals, and schedules. 
              Review and selectively import into your project.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <CalendarPlus className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                <p className="font-medium text-indigo-900">Schedule Tasks</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-900">Financials</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Project Dates</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <Receipt className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                <p className="font-medium text-orange-900">Change Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Document...</h3>
            <p className="text-gray-600">
              Extracting schedule, financial data, dates, and more...
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Action Bar - Shows when items are selected */}
          {getTotalSelectedCount() > 0 && (
            <Card className="bg-green-50 border-green-300 sticky top-4 z-10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      {getTotalSelectedCount()} item(s) selected for import
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedItems({ tasks: [], financials: [], dates: [], changeOrders: [] })}
                      className="border-green-300 text-green-700"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                    <Button
                      onClick={applySelectedData}
                      disabled={applyingData}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      {applyingData ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Apply Selected Data
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categorization */}
          {analysis.categorization && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Smart Categorization
                  </CardTitle>
                  <Badge className={getConfidenceColor(analysis.categorization.confidence)}>
                    {analysis.categorization.confidence} Confidence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recommended Folder:</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {analysis.categorization.recommended_folder}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recommended Type:</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {analysis.categorization.recommended_type}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-4">{analysis.categorization.reasoning}</p>
                <Button
                  onClick={handleApplyCategorization}
                  disabled={updateDocumentMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  size="sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Apply Categorization
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actionable Tasks */}
          {analysis.actionable_tasks?.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarPlus className="w-5 h-5 text-blue-600" />
                    Extracted Schedule Tasks
                    <Badge variant="outline" className="ml-2">
                      {analysis.actionable_tasks.length} found
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllInCategory('tasks', analysis.actionable_tasks)}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deselectAllInCategory('tasks')}
                      className="text-xs"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {analysis.actionable_tasks.map((task, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedItems.tasks.includes(idx) 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleItemSelection('tasks', idx)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedItems.tasks.includes(idx)}
                          onCheckedChange={() => toggleItemSelection('tasks', idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-gray-900">{task.name}</p>
                            <Badge className={getConfidenceColor(task.confidence)}>
                              {task.confidence}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                            {task.start_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Start: {formatDate(task.start_date)}
                              </span>
                            )}
                            {task.finish_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                End: {formatDate(task.finish_date)}
                              </span>
                            )}
                            {task.duration_days && (
                              <span>{task.duration_days} days</span>
                            )}
                            {task.trade && (
                              <Badge variant="outline" className="text-xs">{task.trade}</Badge>
                            )}
                            {task.responsible_party && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {task.responsible_party}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actionable Financials */}
          {analysis.actionable_financials?.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Extracted Financial Data
                    <Badge variant="outline" className="ml-2">
                      {analysis.actionable_financials.length} found
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllInCategory('financials', analysis.actionable_financials)}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deselectAllInCategory('financials')}
                      className="text-xs"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {analysis.actionable_financials.map((financial, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedItems.financials.includes(idx) 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleItemSelection('financials', idx)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedItems.financials.includes(idx)}
                          onCheckedChange={() => toggleItemSelection('financials', idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{financial.type}</p>
                              <p className="text-2xl font-bold text-green-700">
                                {formatCurrency(financial.amount)}
                              </p>
                            </div>
                            <Badge className={getConfidenceColor(financial.confidence)}>
                              {financial.confidence}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Will update:</span>
                            <Badge variant="outline">{financial.target_field}</Badge>
                          </div>
                          {financial.description && (
                            <p className="text-sm text-gray-600 mt-2">{financial.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actionable Dates */}
          {analysis.actionable_dates?.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Extracted Project Dates
                    <Badge variant="outline" className="ml-2">
                      {analysis.actionable_dates.length} found
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllInCategory('dates', analysis.actionable_dates)}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deselectAllInCategory('dates')}
                      className="text-xs"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {analysis.actionable_dates.map((dateItem, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedItems.dates.includes(idx) 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleItemSelection('dates', idx)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedItems.dates.includes(idx)}
                          onCheckedChange={() => toggleItemSelection('dates', idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{dateItem.type}</p>
                              <p className="text-xl font-bold text-blue-700">
                                {formatDate(dateItem.date)}
                              </p>
                            </div>
                            <Badge className={getConfidenceColor(dateItem.confidence)}>
                              {dateItem.confidence}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Will update:</span>
                            <Badge variant="outline">{dateItem.target_field}</Badge>
                          </div>
                          {dateItem.description && (
                            <p className="text-sm text-gray-600 mt-2">{dateItem.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actionable Change Orders */}
          {analysis.actionable_change_orders?.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-orange-600" />
                    Extracted Change Orders
                    <Badge variant="outline" className="ml-2">
                      {analysis.actionable_change_orders.length} found
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllInCategory('changeOrders', analysis.actionable_change_orders)}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deselectAllInCategory('changeOrders')}
                      className="text-xs"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {analysis.actionable_change_orders.map((co, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedItems.changeOrders.includes(idx) 
                          ? 'bg-orange-50 border-orange-300' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleItemSelection('changeOrders', idx)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedItems.changeOrders.includes(idx)}
                          onCheckedChange={() => toggleItemSelection('changeOrders', idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900">
                                {co.number ? `CO #${co.number}` : 'Change Order'}: {co.reason}
                              </p>
                            </div>
                            <Badge className={getConfidenceColor(co.confidence)}>
                              {co.confidence}
                            </Badge>
                          </div>
                          {co.description && (
                            <p className="text-sm text-gray-600 mb-2">{co.description}</p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Cost Impact:</span>
                              <span className={`font-semibold ${co.cost_impact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {co.cost_impact >= 0 ? '+' : ''}{formatCurrency(co.cost_impact || 0)}
                              </span>
                            </div>
                            {co.schedule_impact_days !== null && co.schedule_impact_days !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">Schedule Impact:</span>
                                <span className={`font-semibold ${co.schedule_impact_days > 0 ? 'text-orange-700' : 'text-gray-700'}`}>
                                  {co.schedule_impact_days > 0 ? '+' : ''}{co.schedule_impact_days} days
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {analysis.tags && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-600" />
                    Smart Tags & Metadata
                  </CardTitle>
                  <Button
                    onClick={handleApplyTags}
                    disabled={updateDocumentMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    size="sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Apply Tags
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {analysis.tags.suggested_tags?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Suggested Tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.tags.suggested_tags.map((tag, idx) => (
                        <Badge key={idx} className="bg-indigo-100 text-indigo-800">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid md:grid-cols-3 gap-4">
                  {analysis.tags.trade && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Trade/Discipline:</p>
                      <Badge variant="outline">{analysis.tags.trade}</Badge>
                    </div>
                  )}
                  {analysis.tags.location && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Location:</p>
                      <Badge variant="outline">{analysis.tags.location}</Badge>
                    </div>
                  )}
                  {analysis.tags.priority && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Priority:</p>
                      <Badge className={getConfidenceColor(analysis.tags.priority)}>
                        {analysis.tags.priority}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {analysis.summary && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle>Document Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Executive Summary</h4>
                  <p className="text-gray-700">{analysis.summary.executive_summary}</p>
                </div>

                {analysis.summary.key_points?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Key Points</h4>
                    <ul className="space-y-1">
                      {analysis.summary.key_points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-indigo-600 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.summary.issues_concerns?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Issues & Concerns</h4>
                    <ul className="space-y-1">
                      {analysis.summary.issues_concerns.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.summary.decisions_approvals?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Decisions & Approvals</h4>
                    <ul className="space-y-1">
                      {analysis.summary.decisions_approvals.map((decision, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}