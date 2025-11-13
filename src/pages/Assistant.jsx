
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Pin,
  Sparkles,
  Loader2,
  Brain,
  Globe,
  GitMerge,
  Building2,
  FileSearch,
  Search
} from "lucide-react";
import ChatMessage from "../components/assistant/ChatMessage";
import QuickActions from "../components/assistant/QuickActions";
import NewChatModal from "../components/assistant/NewChatModal";
import { toast } from "sonner";

const AGENT_NAME = "dalcore_assistant";

export default function AssistantPage() {
  const [selectedThreadId, setSelectedThreadId] = React.useState(null);
  const [messageInput, setMessageInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [showNewChatModal, setShowNewChatModal] = React.useState(false);
  const [researchMode, setResearchMode] = React.useState("Company");
  const messagesEndRef = React.useRef(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['chatThreads', user?.email],
    queryFn: () => base44.entities.ChatThread.filter({ user_email: user.email }, '-last_message_at'),
    enabled: !!user?.email,
  });

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const { data: conversation } = useQuery({
    queryKey: ['agentConversation', selectedThread?.agent_conversation_id],
    queryFn: async () => {
      const conv = await base44.agents.getConversation(selectedThread.agent_conversation_id);
      // Ensure messages array exists
      if (conv && !Array.isArray(conv.messages)) {
        conv.messages = [];
      }
      return conv;
    },
    enabled: !!selectedThread?.agent_conversation_id,
    refetchInterval: sending ? 1000 : false,
  });

  React.useEffect(() => {
    if (threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const createThreadMutation = useMutation({
    mutationFn: async ({ title, scope_type, scope_id }) => {
      const agentConversation = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { title }
      });

      return base44.entities.ChatThread.create({
        user_email: user.email,
        agent_conversation_id: agentConversation.id,
        title,
        scope_type,
        scope_id,
        last_message_at: new Date().toISOString()
      });
    },
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      setSelectedThreadId(newThread.id);
      setShowNewChatModal(false);
      toast.success('New conversation started');
    },
    onError: (error) => {
      console.error('Error creating thread:', error);
      toast.error('Failed to create conversation');
    }
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (threadId) => base44.entities.ChatThread.delete(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      const remainingThreads = threads.filter(t => t.id !== selectedThreadId);
      setSelectedThreadId(remainingThreads[0]?.id || null);
      toast.success('Conversation deleted');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ threadId, pinned }) => 
      base44.entities.ChatThread.update(threadId, { pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
    },
  });

  const handleSendMessage = async (messageText = null) => {
    const text = messageText || messageInput.trim();
    if (!text || !selectedThread || sending) return;

    setSending(true);
    setMessageInput("");

    try {
      // Update thread last message time
      await base44.entities.ChatThread.update(selectedThread.id, {
        last_message_at: new Date().toISOString()
      });

      // Get fresh conversation with retry logic
      let conv;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          conv = await base44.agents.getConversation(selectedThread.agent_conversation_id);
          
          // Ensure messages array exists
          if (conv && !Array.isArray(conv.messages)) {
            conv.messages = [];
          }
          
          if (conv && conv.id) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        } catch (error) {
          console.error(`Error fetching conversation (attempt ${retries + 1}):`, error);
          retries++;
          if (retries >= maxRetries) {
            throw new Error("Failed to load conversation");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!conv || !conv.id) {
        throw new Error("Failed to load valid conversation");
      }

      // Build message with mode metadata
      let messageContent = text;

      // Add research mode instruction to message if not Company-only
      if (researchMode === "Web") {
        messageContent = `[RESEARCH MODE: Web Search Only - Use only external web sources, industry data, and public information to answer this question. Do not reference internal company data.]\n\n${text}`;
      } else if (researchMode === "Blended") {
        messageContent = `[RESEARCH MODE: Blended - Combine internal company data with external web research for comprehensive analysis. Use web search to supplement company data with industry benchmarks, best practices, and market insights.]\n\n${text}`;
      }

      // Add message (this triggers agent response)
      await base44.agents.addMessage(conv, {
        role: "user",
        content: messageContent
      });

      // Invalidate to refresh
      queryClient.invalidateQueries({ queryKey: ['agentConversation'] });
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (prompt) => {
    setMessageInput(prompt);
    setTimeout(() => {
      handleSendMessage(prompt);
    }, 500);
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case "Web":
        return <Globe className="w-4 h-4" />;
      case "Blended":
        return <GitMerge className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getModeDescription = (mode) => {
    switch (mode) {
      case "Web":
        return "External web research - industry standards, best practices, regulations, market data";
      case "Blended":
        return "Company data + web research - comprehensive analysis with external benchmarks and industry context";
      default:
        return "Company data only - analyze your projects, financials, schedules, documents, and operations";
    }
  };

  // Document search suggestions
  const documentSearchSuggestions = [
    "Search for all contracts signed this year",
    "Find RFIs related to foundation work",
    "Show me change orders over $50,000",
    "Find all permits for the Main Street project",
    "Search invoices from last quarter"
  ];

  return (
    <div className="h-[calc(100vh-80px)] flex gap-6">
      {/* Sidebar - Thread List */}
      <div className="w-80 flex flex-col bg-white rounded-lg border border-gray-300 overflow-hidden">
        <div className="p-4 border-b border-gray-300 bg-[#F5F4F3]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#1B4D3E]" />
              <h2 className="font-semibold text-gray-900">DALCORE Brain</h2>
            </div>
            <Button
              size="sm"
              onClick={() => setShowNewChatModal(true)}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            AI assistant with access to all your data and the web
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-3">No conversations yet</p>
              <Button
                onClick={() => setShowNewChatModal(true)}
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700"
              >
                Start First Chat
              </Button>
            </div>
          ) : (
            threads
              .sort((a, b) => {
                // Pin sorting first
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                // Then by last message time
                return new Date(b.last_message_at) - new Date(a.last_message_at);
              })
              .map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full p-4 text-left border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selectedThreadId === thread.id ? 'bg-[#F5F4F3]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-1 flex-1">
                      {thread.title}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinMutation.mutate({ 
                            threadId: thread.id, 
                            pinned: !thread.pinned 
                          });
                        }}
                        className={`p-1 rounded hover:bg-gray-200 ${
                          thread.pinned ? 'text-yellow-600' : 'text-gray-400'
                        }`}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this conversation?')) {
                            deleteThreadMutation.mutate(thread.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(thread.last_message_at).toLocaleDateString()} • {thread.scope_type}
                  </p>
                </button>
              ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-300 overflow-hidden">
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-300 bg-[#F5F4F3]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4D3E] to-[#2A6B5A] flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedThread.title}</h2>
                    <p className="text-xs text-gray-600">Search all data, analyze operations, research industry</p>
                  </div>
                </div>

                {/* Research Mode Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Mode:</span>
                  <Select value={researchMode} onValueChange={setResearchMode}>
                    <SelectTrigger className="w-[140px] h-8 bg-white border-gray-300 text-gray-900 text-xs">
                      <div className="flex items-center gap-2">
                        {getModeIcon(researchMode)}
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="Company">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>Company Only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Blended">
                        <div className="flex items-center gap-2">
                          <GitMerge className="w-4 h-4" />
                          <span>Blended</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Web">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>Web Only</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Mode Description */}
              <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                {getModeIcon(researchMode)}
                <span>{getModeDescription(researchMode)}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {(!conversation?.messages || conversation.messages.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1B4D3E] to-[#2A6B5A] flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    DALCORE Brain is Ready
                  </h3>
                  <p className="text-sm text-gray-600 mb-2 max-w-md mx-auto">
                    I have access to all your projects, financials, schedules, documents, and operations. 
                    I can also search the web for industry insights.
                  </p>
                  
                  {/* Mode Info Boxes */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-blue-900 font-semibold">
                          <Building2 className="w-3 h-3" />
                          <span>Company</span>
                        </div>
                        <p className="text-blue-800">Internal data analysis only</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-blue-900 font-semibold">
                          <GitMerge className="w-3 h-3" />
                          <span>Blended</span>
                        </div>
                        <p className="text-blue-800">Company + industry benchmarks</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-blue-900 font-semibold">
                          <Globe className="w-3 h-3" />
                          <span>Web</span>
                        </div>
                        <p className="text-blue-800">External research only</p>
                      </div>
                    </div>
                  </div>

                  {/* Document Search Examples */}
                  <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <FileSearch className="w-4 h-4 text-purple-700" />
                      <p className="text-sm font-semibold text-purple-900">Document Search Examples:</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {documentSearchSuggestions.slice(0, 4).map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuickAction(suggestion)}
                          className="px-3 py-2 bg-white border border-purple-200 rounded text-xs text-left hover:bg-purple-100 transition-colors"
                        >
                          <Search className="w-3 h-3 inline mr-1" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <QuickActions onAsk={handleQuickAction} isLoading={sending} />
                </div>
              )}

              {conversation?.messages?.map((message, idx) => (
                <ChatMessage key={idx} message={message} />
              ))}

              {sending && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">
                    {researchMode === "Web" ? "Researching web sources..." : 
                     researchMode === "Blended" ? "Analyzing company data and web sources..." : 
                     "Analyzing your data..."}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-300 bg-white">
              <div className="flex gap-3">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    researchMode === "Web" 
                      ? "Ask about industry best practices, market trends, regulations..." 
                      : researchMode === "Blended"
                      ? "Ask to compare your data with industry benchmarks..."
                      : "Ask about projects, financials, schedules, documents, risks..."
                  }
                  className="flex-1 resize-none bg-white border-gray-300 text-gray-900"
                  rows={2}
                  disabled={sending}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!messageInput.trim() || sending}
                  className="bg-[#1B4D3E] hover:bg-[#14503C] text-white self-end"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Brain className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select a conversation or start a new one
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                DALCORE Brain can search all your data and the web
              </p>
              <Button
                onClick={() => setShowNewChatModal(true)}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start New Analysis
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreate={(data) => createThreadMutation.mutate(data)}
        />
      )}
    </div>
  );
}
