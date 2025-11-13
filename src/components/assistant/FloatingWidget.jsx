
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, ClipboardList, X, Loader2, Brain, Send, Plus, Sparkles, Building2, GitMerge, Globe } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "../shared/DateFormatter";
import { toast } from "sonner";
import ChatMessage from "./ChatMessage";

const AGENT_NAME = "dalcore_assistant";

export default function FloatingWidget() {
  const [showDailyLogModal, setShowDailyLogModal] = React.useState(false);
  const [showAssistantModal, setShowAssistantModal] = React.useState(false);
  const [messageInput, setMessageInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [researchMode, setResearchMode] = React.useState("Company");
  const [activeThreadId, setActiveThreadId] = React.useState(null);
  const messagesEndRef = React.useRef(null);
  const [formData, setFormData] = React.useState({
    project_id: '',
    log_date: formatDate(new Date(), 'yyyy-MM-dd'),
    work_performed: '',
    subcontractors: [],
    equipment_materials: [''],
    inspections_meetings: [''],
    safety_issues: false,
    injuries_accidents: false,
    safety_issues_description: '',
    injuries_accidents_description: '',
    issues_delays: '',
    notes_next_steps: '',
    weather: '',
    temperature: '',
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['chatThreads', currentUser?.email],
    queryFn: () => base44.entities.ChatThread.filter({ user_email: currentUser.email }, '-last_message_at'),
    enabled: !!currentUser?.email && showAssistantModal,
  });

  // Get active thread
  const activeThread = React.useMemo(() => {
    if (!threads || threads.length === 0) return null;
    if (activeThreadId) {
      return threads.find(t => t.id === activeThreadId) || threads[0];
    }
    return threads[0];
  }, [threads, activeThreadId]);

  // Set active thread when threads load
  React.useEffect(() => {
    if (threads && threads.length > 0 && !activeThreadId) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  const { data: conversation } = useQuery({
    queryKey: ['agentConversation', activeThread?.agent_conversation_id],
    queryFn: async () => {
      const conv = await base44.agents.getConversation(activeThread.agent_conversation_id);
      // Ensure messages array exists
      if (conv && !Array.isArray(conv.messages)) {
        conv.messages = [];
      }
      return conv;
    },
    enabled: !!activeThread?.agent_conversation_id && showAssistantModal,
    refetchInterval: showAssistantModal && sending ? 1000 : false,
  });

  React.useEffect(() => {
    if (showAssistantModal && conversation?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation?.messages, showAssistantModal]);

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const agentConversation = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { title: 'Quick Chat' }
      });

      const newThread = await base44.entities.ChatThread.create({
        user_email: currentUser.email,
        agent_conversation_id: agentConversation.id,
        title: 'Quick Chat',
        scope_type: 'Company',
        scope_id: null,
        last_message_at: new Date().toISOString()
      });

      return newThread;
    },
    onSuccess: (newThread) => {
      setActiveThreadId(newThread.id);
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
    },
  });

  const handleSendMessage = async (messageText = null) => {
    const text = messageText || messageInput.trim();
    if (!text || sending) return;

    setSending(true);
    setMessageInput("");

    try {
      let threadToUse = activeThread;

      // Create thread if none exists
      if (!threadToUse) {
        const newThread = await createThreadMutation.mutateAsync();
        
        // Wait for thread to be created and queries to update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Fetch the updated thread
        const updatedThreads = await base44.entities.ChatThread.filter({ 
          user_email: currentUser.email 
        }, '-last_message_at');
        
        threadToUse = updatedThreads.find(t => t.id === newThread.id);
        
        if (!threadToUse) {
          throw new Error("Failed to create thread");
        }
      }

      if (!threadToUse.agent_conversation_id) {
        throw new Error("Thread does not have a conversation ID");
      }

      // ALWAYS fetch the conversation fresh to ensure it has all required properties
      let conversationToUse;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          conversationToUse = await base44.agents.getConversation(threadToUse.agent_conversation_id);
          
          // Ensure messages array exists
          if (conversationToUse && !Array.isArray(conversationToUse.messages)) {
            conversationToUse.messages = [];
          }
          
          // Verify the conversation is properly structured
          if (conversationToUse && conversationToUse.id) {
            break; // Successfully got a valid conversation
          }
          
          // If not valid, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        } catch (error) {
          console.error(`Error fetching conversation (attempt ${retries + 1}):`, error);
          retries++;
          if (retries >= maxRetries) {
            throw new Error("Failed to load conversation after multiple attempts");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!conversationToUse || !conversationToUse.id) {
        throw new Error("Failed to load valid conversation");
      }

      // Update thread timestamp
      await base44.entities.ChatThread.update(threadToUse.id, {
        last_message_at: new Date().toISOString()
      });

      // Build message with research mode
      let messageContent = text;
      if (researchMode === "Web") {
        messageContent = `[RESEARCH MODE: Web Search Only - Use only external web sources, industry data, and public information to answer this question. Do not reference internal company data.]\n\n${text}`;
      } else if (researchMode === "Blended") {
        messageContent = `[RESEARCH MODE: Blended - Combine internal company data with external web research for comprehensive analysis. Use web search to supplement company data with industry benchmarks, best practices, and market insights.]\n\n${text}`;
      }

      // Send message
      await base44.agents.addMessage(conversationToUse, {
        role: "user",
        content: messageContent
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['agentConversation'] });
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.stack);
      toast.error('Failed to send message. Please try closing and reopening the chat.');
    } finally {
      setSending(false);
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
        return <Globe className="w-3 h-3" />;
      case "Blended":
        return <GitMerge className="w-3 h-3" />;
      default:
        return <Building2 className="w-3 h-3" />;
    }
  };

  const activeProjects = projects.filter(p => ['Active', 'Planning'].includes(p.status));
  const subcontractors = companies.filter(c => c.type === 'Subcontractor');

  const createDailyLogMutation = useMutation({
    mutationFn: async (data) => {
      const dailyLog = await base44.entities.DailyLog.create(data);
      
      const risksToCreate = [];
      
      if (data.safety_issues && data.safety_issues_description) {
        risksToCreate.push({
          project_id: data.project_id,
          title: `Safety Issue - ${formatDate(data.log_date, 'MMM d, yyyy')}`,
          description: data.safety_issues_description,
          category: 'Safety',
          probability: 'Medium',
          impact: 'High',
          status: 'Identified',
          source: 'Daily Log - Safety',
          daily_log_id: dailyLog.id,
        });
      }
      
      if (data.injuries_accidents && data.injuries_accidents_description) {
        risksToCreate.push({
          project_id: data.project_id,
          title: `Injury/Accident - ${formatDate(data.log_date, 'MMM d, yyyy')}`,
          description: data.injuries_accidents_description,
          category: 'Safety',
          probability: 'High',
          impact: 'High',
          status: 'Identified',
          source: 'Daily Log - Injury',
          daily_log_id: dailyLog.id,
        });
      }
      
      if (data.issues_delays) {
        risksToCreate.push({
          project_id: data.project_id,
          title: `Issue/Delay - ${formatDate(data.log_date, 'MMM d, yyyy')}`,
          description: data.issues_delays,
          category: 'Schedule',
          probability: 'Medium',
          impact: 'Medium',
          status: 'Identified',
          source: 'Daily Log - Issue/Delay',
          daily_log_id: dailyLog.id,
        });
      }
      
      if (risksToCreate.length > 0) {
        await base44.entities.Risk.bulkCreate(risksToCreate);
      }
      
      return dailyLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs'] });
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setShowDailyLogModal(false);
      resetForm();
      toast.success('Daily log created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create daily log');
      console.error('Daily log creation error:', error);
    },
  });

  const resetForm = () => {
    setFormData({
      project_id: '',
      log_date: formatDate(new Date(), 'yyyy-MM-dd'),
      work_performed: '',
      subcontractors: [],
      equipment_materials: [''],
      inspections_meetings: [''],
      safety_issues: false,
      injuries_accidents: false,
      safety_issues_description: '',
      injuries_accidents_description: '',
      issues_delays: '',
      notes_next_steps: '',
      weather: '',
      temperature: '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanedData = {
      ...formData,
      prepared_by: currentUser?.email || '',
      equipment_materials: formData.equipment_materials.filter(item => item.trim()),
      inspections_meetings: formData.inspections_meetings.filter(item => item.trim()),
      safety_issues_description: formData.safety_issues ? formData.safety_issues_description : undefined,
      injuries_accidents_description: formData.injuries_accidents ? formData.injuries_accidents_description : undefined,
    };

    createDailyLogMutation.mutate(cleanedData);
  };

  const addSubcontractor = () => {
    setFormData({
      ...formData,
      subcontractors: [...formData.subcontractors, { name: '', trade: '', num_workers: 0, work_performed: '' }]
    });
  };

  const removeSubcontractor = (index) => {
    setFormData({
      ...formData,
      subcontractors: formData.subcontractors.filter((_, i) => i !== index)
    });
  };

  const updateSubcontractor = (index, field, value) => {
    const updated = [...formData.subcontractors];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'name') {
      const selectedCompany = subcontractors.find(s => s.name === value);
      if (selectedCompany) {
        updated[index].trade = selectedCompany.trade || '';
      }
    }
    
    setFormData({ ...formData, subcontractors: updated });
  };

  const addEquipmentItem = () => {
    setFormData({
      ...formData,
      equipment_materials: [...formData.equipment_materials, '']
    });
  };

  const updateEquipmentItem = (index, value) => {
    const updated = [...formData.equipment_materials];
    updated[index] = value;
    setFormData({ ...formData, equipment_materials: updated });
  };

  const addInspectionItem = () => {
    setFormData({
      ...formData,
      inspections_meetings: [...formData.inspections_meetings, '']
    });
  };

  const updateInspectionItem = (index, value) => {
    const updated = [...formData.inspections_meetings];
    updated[index] = value;
    setFormData({ ...formData, inspections_meetings: updated });
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <Button
          onClick={() => setShowAssistantModal(true)}
          className="w-11 h-11 rounded-full bg-[#0E351F] hover:bg-[#1B4D3E] text-white shadow-lg"
          title="DALCORE Brain"
        >
          <Brain className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={() => setShowDailyLogModal(true)}
          className="w-11 h-11 rounded-full bg-[#3B5B48] hover:bg-[#5A7765] text-white shadow-lg"
          title="Quick Daily Log"
        >
          <ClipboardList className="w-4 h-4" />
        </Button>
      </div>

      {/* DALCORE Brain Modal */}
      <Dialog open={showAssistantModal} onOpenChange={setShowAssistantModal}>
        <DialogContent className="bg-white border-gray-300 text-gray-900 max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-gray-300 bg-[#F5F4F3] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1B4D3E] to-[#2A6B5A] flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base">DALCORE Brain</DialogTitle>
                  <p className="text-xs text-gray-600">AI-powered business analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={researchMode} onValueChange={setResearchMode}>
                  <SelectTrigger className="w-[120px] h-7 bg-white border-gray-300 text-gray-900 text-xs">
                    <div className="flex items-center gap-1.5">
                      {getModeIcon(researchMode)}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Company">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        <span className="text-xs">Company</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Blended">
                      <div className="flex items-center gap-2">
                        <GitMerge className="w-3 h-3" />
                        <span className="text-xs">Blended</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Web">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3" />
                        <span className="text-xs">Web</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(createPageUrl('Assistant'))}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  Open Full Page
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {(!conversation?.messages || conversation.messages.length === 0) && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1B4D3E] to-[#2A6B5A] flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  DALCORE Brain is Ready
                </h3>
                <p className="text-xs text-gray-600 mb-4 max-w-md mx-auto">
                  Ask me anything about your projects, financials, schedules, or risks.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                  <Button
                    onClick={() => handleQuickAction("Analyze the health of all my active projects")}
                    disabled={sending}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Project Health
                  </Button>
                  <Button
                    onClick={() => handleQuickAction("Give me a financial summary across all projects")}
                    disabled={sending}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Financial Summary
                  </Button>
                  <Button
                    onClick={() => handleQuickAction("What are my critical upcoming deadlines?")}
                    disabled={sending}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Upcoming Deadlines
                  </Button>
                  <Button
                    onClick={() => handleQuickAction("Analyze all current risks")}
                    disabled={sending}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    Risk Analysis
                  </Button>
                </div>
              </div>
            )}

            {conversation?.messages?.map((message, idx) => (
              <ChatMessage key={idx} message={message} />
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">
                  {researchMode === "Web" ? "Researching web sources..." : 
                   researchMode === "Blended" ? "Analyzing company data and web sources..." : 
                   "Analyzing your data..."}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-300 bg-white shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  researchMode === "Web" 
                    ? "Ask about industry best practices..." 
                    : researchMode === "Blended"
                    ? "Compare your data with industry benchmarks..."
                    : "Ask about your projects, financials, risks..."
                }
                className="flex-1 resize-none bg-white border-gray-300 text-gray-900 text-sm"
                rows={2}
                disabled={sending}
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!messageInput.trim() || sending}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white self-end"
                size="sm"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Log Modal */}
      <Dialog open={showDailyLogModal} onOpenChange={setShowDailyLogModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Quick Daily Log</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Project *</Label>
              <Select
                required
                value={formData.project_id}
                onValueChange={(value) => setFormData({...formData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select active project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300 max-h-60">
                  {activeProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                required
                value={formData.log_date || ''}
                onChange={(e) => setFormData({...formData, log_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Work Performed Today *</Label>
              <Textarea
                required
                value={formData.work_performed || ''}
                onChange={(e) => setFormData({...formData, work_performed: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
                placeholder="Describe work completed today..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Subcontractors On-Site</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubcontractor}
                  className="border-gray-300 text-gray-700"
                  disabled={subcontractors.length === 0}
                >
                  Add Subcontractor
                </Button>
              </div>
              
              {formData.subcontractors.map((sub, index) => (
                <Card key={index} className="bg-white border-gray-300 p-3">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Select
                          value={sub.name}
                          onValueChange={(value) => updateSubcontractor(index, 'name', value)}
                        >
                          <SelectTrigger className="bg-white border-gray-300 text-gray-900 h-8 text-sm">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-300 max-h-40">
                            {subcontractors.map((company) => (
                              <SelectItem key={company.id} value={company.name}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Trade</Label>
                        <Input
                          value={sub.trade}
                          onChange={(e) => updateSubcontractor(index, 'trade', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs"># Workers</Label>
                        <Input
                          type="number"
                          value={sub.num_workers}
                          onChange={(e) => updateSubcontractor(index, 'num_workers', parseInt(e.target.value, 10) || 0)}
                          className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Work Performed</Label>
                        <Input
                          value={sub.work_performed}
                          onChange={(e) => updateSubcontractor(index, 'work_performed', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubcontractor(index)}
                      className="text-red-600 hover:text-red-700 h-7 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Equipment & Materials</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEquipmentItem}
                  className="border-gray-300 text-gray-700 h-7 text-xs"
                >
                  Add Item
                </Button>
              </div>
              {formData.equipment_materials.map((item, index) => (
                <Input
                  key={index}
                  value={item}
                  onChange={(e) => updateEquipmentItem(index, e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 text-sm"
                  placeholder="e.g., Crane delivered, Concrete pour"
                />
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Inspections & Meetings</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInspectionItem}
                  className="border-gray-300 text-gray-700 h-7 text-xs"
                >
                  Add Item
                </Button>
              </div>
              {formData.inspections_meetings.map((item, index) => (
                <Input
                  key={index}
                  value={item}
                  onChange={(e) => updateInspectionItem(index, e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 text-sm"
                  placeholder="e.g., City inspector reviewed framing"
                />
              ))}
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Safety & Incidents</Label>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.safety_issues}
                    onCheckedChange={(checked) => setFormData({...formData, safety_issues: checked})}
                    id="safety_issues"
                  />
                  <Label htmlFor="safety_issues" className="text-gray-900">Were there any safety issues today?</Label>
                </div>
                
                {formData.safety_issues && (
                  <Textarea
                    value={formData.safety_issues_description || ''}
                    onChange={(e) => setFormData({...formData, safety_issues_description: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="Describe the safety issue... (This will create a risk)"
                    rows={2}
                  />
                )}

                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.injuries_accidents}
                    onCheckedChange={(checked) => setFormData({...formData, injuries_accidents: checked})}
                    id="injuries_accidents"
                  />
                  <Label htmlFor="injuries_accidents" className="text-gray-900">Any injuries or accidents?</Label>
                </div>
                
                {formData.injuries_accidents && (
                  <Textarea
                    value={formData.injuries_accidents_description || ''}
                    onChange={(e) => setFormData({...formData, injuries_accidents_description: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="Describe the injury or accident... (This will create a high-priority risk)"
                    rows={2}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Issues & Delays</Label>
              <p className="text-xs text-gray-600">Any problems, delays, or unexpected events? (This will create a risk)</p>
              <Textarea
                value={formData.issues_delays || ''}
                onChange={(e) => setFormData({...formData, issues_delays: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Notes & Next Steps</Label>
              <Textarea
                value={formData.notes_next_steps || ''}
                onChange={(e) => setFormData({...formData, notes_next_steps: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weather</Label>
                <Input
                  value={formData.weather || ''}
                  onChange={(e) => setFormData({...formData, weather: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., Sunny, Rainy"
                />
              </div>
              <div>
                <Label>Temperature</Label>
                <Input
                  value={formData.temperature || ''}
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., 75°F"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDailyLogModal(false);
                  resetForm();
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createDailyLogMutation.isPending}
              >
                {createDailyLogMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Daily Log'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
