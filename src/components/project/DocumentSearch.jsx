import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Loader2, 
  FileText,
  Sparkles,
  ArrowRight,
  Calendar,
  DollarSign,
  Tag
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";

export default function DocumentSearch({ projectId, onDocumentSelect }) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState(null);

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => base44.entities.Document.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() || documents.length === 0) return;

    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      const documentContext = documents.map(d => ({
        id: d.id,
        name: d.name,
        folder: d.folder,
        type: d.type,
        description: d.description,
        tags: d.tags,
        created_date: d.created_date
      }));

      const prompt = `You are an expert document search assistant for construction projects. 

The user is searching for: "${query}"

Available documents in this project:
${JSON.stringify(documentContext, null, 2)}

Analyze the search query and find the most relevant documents. Consider:
- Direct name matches
- Description content
- Tags and keywords
- Document types and folders
- Dates if mentioned
- Related topics and concepts
- Synonyms and construction terminology

For example:
- "contract with Smith" → look for contracts, client names, vendor names
- "permits" → look in Permits folder, permit-related documents
- "change orders from May" → look for change orders from that timeframe
- "latest invoice" → find recent invoices
- "RFI about foundation" → look for RFIs with foundation-related content

Provide search results sorted by relevance with reasoning for each match.

Respond in JSON:
{
  "search_summary": "brief summary of what was searched for",
  "results": [
    {
      "document_id": "id",
      "document_name": "name",
      "relevance_score": number (0-100),
      "match_reason": "why this document matches the query",
      "key_highlights": ["highlight 1", "highlight 2"],
      "suggested_action": "what the user might want to do with this document"
    }
  ],
  "suggestions": ["related search 1", "related search 2"]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            search_summary: { type: "string" },
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  document_id: { type: "string" },
                  document_name: { type: "string" },
                  relevance_score: { type: "number" },
                  match_reason: { type: "string" },
                  key_highlights: { type: "array", items: { type: "string" } },
                  suggested_action: { type: "string" }
                }
              }
            },
            suggestions: { type: "array", items: { type: "string" } }
          }
        }
      });

      setResults(result);
    } catch (err) {
      console.error('Document search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const getRelevanceColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents using natural language... (e.g., 'latest invoice', 'permits from June', 'RFI about foundation')"
                  className="pl-10 bg-white border-gray-300 text-gray-900"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Search
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              💡 Use natural language to find documents: "contracts signed last month", "change orders over $10k", "permits for electrical work"
            </p>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          {/* Search Summary */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{results.search_summary}</p>
                  <p className="text-sm text-gray-600">
                    Found {results.results?.length || 0} relevant document{results.results?.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {results.results && results.results.length > 0 ? (
            <div className="space-y-4">
              {results.results.map((result, idx) => {
                const doc = documents.find(d => d.id === result.document_id);
                if (!doc) return null;

                return (
                  <Card key={idx} className="bg-white border-gray-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="w-6 h-6 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900">{result.document_name}</h4>
                              <Badge className={getRelevanceColor(result.relevance_score)}>
                                {result.relevance_score}% match
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                              <span>{doc.folder}</span>
                              <span>•</span>
                              <span>{doc.type}</span>
                              {doc.created_date && (
                                <>
                                  <span>•</span>
                                  <span>{formatDate(doc.created_date)}</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mb-3">
                              <span className="font-medium">Match reason:</span> {result.match_reason}
                            </p>
                            {result.key_highlights && result.key_highlights.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-gray-700 mb-1">Key Highlights:</p>
                                <div className="flex flex-wrap gap-2">
                                  {result.key_highlights.map((highlight, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {highlight}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {result.suggested_action && (
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                <span className="font-medium text-blue-900">💡 Suggested: </span>
                                <span className="text-blue-800">{result.suggested_action}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => onDocumentSelect(doc)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          View
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-white border-gray-200">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No documents found matching your search.</p>
                <p className="text-sm text-gray-500 mt-2">Try different keywords or search terms.</p>
              </CardContent>
            </Card>
          )}

          {/* Search Suggestions */}
          {results.suggestions && results.suggestions.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-sm">Related Searches</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {results.suggestions.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery(suggestion);
                        handleSearch();
                      }}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!results && !isSearching && documents.length === 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No documents in this project yet.</p>
            <p className="text-sm text-gray-500 mt-2">Upload documents to start searching.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}