import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  RefreshCw
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DocumentAIAnalysis({ document, projectId, onUpdate }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => base44.entities.Document.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => base44.entities.Task.filter({ project_id: projectId }),
    enabled: !!projectId && analysis?.relationships?.tasks?.length > 0,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: () => base44.entities.ChangeOrder.filter({ project_id: projectId }),
    enabled: !!projectId && analysis?.relationships?.change_orders?.length > 0,
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: () => base44.entities.DailyLog.filter({ project_id: projectId }),
    enabled: !!projectId && analysis?.relationships?.daily_logs?.length > 0,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      if (onUpdate) onUpdate();
    },
  });

  const analyzeDocument = async () => {
    if (!document || !document.file_url) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      // Get document content context
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

      const prompt = `You are an expert construction document analyst specializing in categorizing, extracting information, and identifying relationships in project documentation.

Analyze this document and provide comprehensive structured information:

DOCUMENT DETAILS:
- Name: ${document.name}
- Current Folder: ${document.folder || 'Not categorized'}
- Current Type: ${document.type || 'Unknown'}
- Current Description: ${document.description || 'None'}
- Current Tags: ${document.tags?.join(', ') || 'None'}

OTHER DOCUMENTS IN PROJECT:
${JSON.stringify(otherDocuments.slice(0, 50), null, 2)}

Your analysis should include:

1. CATEGORIZATION
   - Recommended folder (Contracts, Correspondences, Drawings & Specs, Estimates, Invoices, Permits, Photos, Proposals, Quotes, Schedules, Change Orders, Bills, Payments)
   - Document type (Plan, Specification, Contract, Change Order, Invoice, Bill, Payment, RFI, Submittal, Report, Other)
   - Confidence level for categorization

2. KEY INFORMATION EXTRACTION
   - Important dates (effective dates, due dates, completion dates)
   - Financial figures (amounts, costs, prices)
   - Parties involved (companies, individuals, roles)
   - Key topics and subjects
   - Action items or requirements
   - Deadlines

3. TAGS & METADATA
   - Suggested tags (5-10 relevant keywords)
   - Trade/discipline if applicable
   - Location/area if applicable
   - Priority level if applicable

4. DOCUMENT RELATIONSHIPS
   - Related document names/IDs from the list
   - Potential links to tasks (describe what tasks this relates to)
   - Potential links to change orders (if document mentions changes, scope modifications)
   - Potential links to daily logs (if document discusses site conditions, issues)
   - Relationship types (supersedes, references, supports, contradicts)

5. CONTENT SUMMARY
   - Executive summary (2-3 sentences)
   - Key points (bullet list)
   - Issues or concerns mentioned
   - Decisions or approvals documented

Consider construction industry context:
- Contract terms and conditions
- Schedule impacts
- Cost implications
- Safety concerns
- Quality requirements
- Compliance and regulatory issues

Respond in JSON:
{
  "categorization": {
    "recommended_folder": "folder name",
    "recommended_type": "type name",
    "confidence": "High/Medium/Low",
    "reasoning": "why this categorization"
  },
  "key_information": {
    "dates": [
      {
        "type": "Effective Date/Due Date/Completion Date/etc",
        "date": "YYYY-MM-DD",
        "description": "context"
      }
    ],
    "financial_figures": [
      {
        "type": "Contract Amount/Cost/Price/etc",
        "amount": number,
        "description": "context"
      }
    ],
    "parties": [
      {
        "name": "party name",
        "role": "Owner/GC/Subcontractor/etc",
        "context": "what they're involved in"
      }
    ],
    "key_topics": ["topic 1", "topic 2"],
    "action_items": ["action 1", "action 2"],
    "deadlines": [
      {
        "description": "what's due",
        "date": "YYYY-MM-DD",
        "priority": "High/Medium/Low"
      }
    ]
  },
  "tags": {
    "suggested_tags": ["tag1", "tag2", "tag3"],
    "trade": "trade name or null",
    "location": "location or null",
    "priority": "High/Medium/Low/null"
  },
  "relationships": {
    "related_documents": [
      {
        "document_id": "id",
        "document_name": "name",
        "relationship_type": "References/Supersedes/Supports/etc",
        "description": "how they're related"
      }
    ],
    "tasks": [
      {
        "description": "what task this relates to",
        "reasoning": "why it's related"
      }
    ],
    "change_orders": [
      {
        "description": "what change order this relates to",
        "reasoning": "why it's related"
      }
    ],
    "daily_logs": [
      {
        "description": "what daily log topic this relates to",
        "reasoning": "why it's related"
      }
    ]
  },
  "summary": {
    "executive_summary": "brief overview",
    "key_points": ["point 1", "point 2"],
    "issues_concerns": ["issue 1", "issue 2"],
    "decisions_approvals": ["decision 1", "decision 2"]
  }
}`;

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
            key_information: {
              type: "object",
              properties: {
                dates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      date: { type: "string" },
                      description: { type: "string" }
                    }
                  }
                },
                financial_figures: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      amount: { type: "number" },
                      description: { type: "string" }
                    }
                  }
                },
                parties: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      role: { type: "string" },
                      context: { type: "string" }
                    }
                  }
                },
                key_topics: { type: "array", items: { type: "string" } },
                action_items: { type: "array", items: { type: "string" } },
                deadlines: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      date: { type: "string" },
                      priority: { type: "string" }
                    }
                  }
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
                },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      reasoning: { type: "string" }
                    }
                  }
                },
                change_orders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      reasoning: { type: "string" }
                    }
                  }
                },
                daily_logs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      reasoning: { type: "string" }
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-orange-100 text-orange-800';
      case 'Low': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
                  Smart categorization, information extraction & relationship discovery
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
              Get instant AI analysis with automatic categorization, key information extraction, 
              intelligent tagging, and relationship discovery across your project documents.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <FileText className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
                <p className="font-medium text-indigo-900">Smart Categories</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <Tag className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-medium text-purple-900">Auto-Tagging</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <p className="font-medium text-blue-900">Extract Data</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <LinkIcon className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-900">Find Links</p>
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
              Reading content, extracting information, identifying relationships, and generating insights...
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
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

          {/* Key Information */}
          {analysis.key_information && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Extracted Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Dates */}
                {analysis.key_information.dates?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Important Dates</h4>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {analysis.key_information.dates.map((date, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-900">{date.type}</p>
                          <p className="text-lg font-semibold text-blue-800">
                            {formatDate(date.date)}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">{date.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Figures */}
                {analysis.key_information.financial_figures?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-gray-900">Financial Figures</h4>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {analysis.key_information.financial_figures.map((figure, idx) => (
                        <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-green-900">{figure.type}</p>
                          <p className="text-lg font-semibold text-green-800">
                            {formatCurrency(figure.amount)}
                          </p>
                          <p className="text-xs text-green-700 mt-1">{figure.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parties */}
                {analysis.key_information.parties?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900">Parties Involved</h4>
                    </div>
                    <div className="space-y-2">
                      {analysis.key_information.parties.map((party, idx) => (
                        <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-purple-900">{party.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {party.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-purple-700">{party.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Topics */}
                {analysis.key_information.key_topics?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Key Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.key_information.key_topics.map((topic, idx) => (
                        <Badge key={idx} variant="outline" className="bg-gray-50">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {analysis.key_information.action_items?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Action Items</h4>
                    <ul className="space-y-2">
                      {analysis.key_information.action_items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deadlines */}
                {analysis.key_information.deadlines?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Deadlines</h4>
                    <div className="space-y-2">
                      {analysis.key_information.deadlines.map((deadline, idx) => (
                        <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-orange-900">{deadline.description}</p>
                            <p className="text-sm text-orange-700">
                              Due: {formatDate(deadline.date)}
                            </p>
                          </div>
                          <Badge className={getPriorityColor(deadline.priority)}>
                            {deadline.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                      <Badge className={getPriorityColor(analysis.tags.priority)}>
                        {analysis.tags.priority}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relationships */}
          {analysis.relationships && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-green-600" />
                  Document Relationships
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Related Documents */}
                {analysis.relationships.related_documents?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Related Documents</h4>
                    <div className="space-y-2">
                      {analysis.relationships.related_documents.map((rel, idx) => {
                        const relatedDoc = allDocuments.find(d => d.id === rel.document_id);
                        return (
                          <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-green-600" />
                                <p className="font-medium text-green-900">{rel.document_name}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {rel.relationship_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-green-700">{rel.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {analysis.relationships.tasks?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Related Tasks</h4>
                    <div className="space-y-2">
                      {analysis.relationships.tasks.map((task, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="font-medium text-blue-900 mb-1">{task.description}</p>
                          <p className="text-sm text-blue-700">{task.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Change Orders */}
                {analysis.relationships.change_orders?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Related Change Orders</h4>
                    <div className="space-y-2">
                      {analysis.relationships.change_orders.map((co, idx) => (
                        <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="font-medium text-orange-900 mb-1">{co.description}</p>
                          <p className="text-sm text-orange-700">{co.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Logs */}
                {analysis.relationships.daily_logs?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Related Daily Log Topics</h4>
                    <div className="space-y-2">
                      {analysis.relationships.daily_logs.map((log, idx) => (
                        <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="font-medium text-purple-900 mb-1">{log.description}</p>
                          <p className="text-sm text-purple-700">{log.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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