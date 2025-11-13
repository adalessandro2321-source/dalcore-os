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
  Paperclip, 
  Mail, 
  MailOpen,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatDate } from "../shared/DateFormatter";
import { toast } from "sonner";

export default function ClientMessages({ companyId, userEmail }) {
  const [showNewMessage, setShowNewMessage] = React.useState(false);
  const [expandedThreads, setExpandedThreads] = React.useState(new Set());
  const [newMessage, setNewMessage] = React.useState({
    subject: '',
    message: '',
    project_id: '',
    priority: 'Normal'
  });

  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['clientMessages', companyId],
    queryFn: () => base44.entities.ClientMessage.filter({ client_id: companyId }, '-created_date'),
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['clientProjects', companyId],
    queryFn: () => base44.entities.Project.filter({ client_id: companyId }),
    enabled: !!companyId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (messageData) => base44.entities.ClientMessage.create(messageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientMessages'] });
      setNewMessage({ subject: '', message: '', project_id: '', priority: 'Normal' });
      setShowNewMessage(false);
      toast.success('Message sent successfully');
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.ClientMessage.update(id, { 
      read: true, 
      read_at: new Date().toISOString() 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientMessages'] });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.subject || !newMessage.message) {
      toast.error('Please fill in subject and message');
      return;
    }

    sendMessageMutation.mutate({
      client_id: companyId,
      sender_email: userEmail,
      sender_type: 'Client',
      subject: newMessage.subject,
      message: newMessage.message,
      project_id: newMessage.project_id || null,
      priority: newMessage.priority,
      thread_id: Date.now().toString()
    });
  };

  const toggleThread = (threadId) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedThreads(newExpanded);
  };

  const handleMessageClick = (message) => {
    if (!message.read && message.sender_type === 'Team') {
      markAsReadMutation.mutate({ id: message.id });
    }
    toggleThread(message.thread_id || message.id);
  };

  // Group messages by thread
  const threads = React.useMemo(() => {
    const threadMap = new Map();
    
    messages.forEach(msg => {
      const threadId = msg.thread_id || msg.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId).push(msg);
    });

    return Array.from(threadMap.entries()).map(([threadId, msgs]) => ({
      id: threadId,
      messages: msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
      latestMessage: msgs[msgs.length - 1]
    }));
  }, [messages]);

  const unreadCount = messages.filter(m => !m.read && m.sender_type === 'Team').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Messages</h3>
              <p className="text-sm text-gray-600">
                {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
            <Button
              onClick={() => setShowNewMessage(!showNewMessage)}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Message Form */}
      {showNewMessage && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle>Send New Message</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Subject</label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage({...newMessage, subject: e.target.value})}
                placeholder="Message subject"
                className="bg-white border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Related Project (Optional)</label>
                <Select
                  value={newMessage.project_id}
                  onValueChange={(value) => setNewMessage({...newMessage, project_id: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value={null}>No project</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Priority</label>
                <Select
                  value={newMessage.priority}
                  onValueChange={(value) => setNewMessage({...newMessage, priority: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">Message</label>
              <Textarea
                value={newMessage.message}
                onChange={(e) => setNewMessage({...newMessage, message: e.target.value})}
                placeholder="Type your message here..."
                className="bg-white border-gray-300"
                rows={6}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowNewMessage(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending}
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Your Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {threads.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">No messages yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Start a conversation with your project team
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {threads.map((thread) => {
                const isExpanded = expandedThreads.has(thread.id);
                const hasUnread = thread.messages.some(m => !m.read && m.sender_type === 'Team');
                const project = projects.find(p => p.id === thread.latestMessage.project_id);

                return (
                  <div key={thread.id} className="hover:bg-gray-50">
                    <div
                      onClick={() => handleMessageClick(thread.latestMessage)}
                      className="p-6 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          {hasUnread ? (
                            <Mail className="w-5 h-5 text-blue-600" />
                          ) : (
                            <MailOpen className="w-5 h-5 text-gray-400" />
                          )}
                          <div className="flex-1">
                            <h3 className={`font-semibold ${hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                              {thread.latestMessage.subject}
                            </h3>
                            {project && (
                              <p className="text-xs text-gray-600">Project: {project.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {thread.latestMessage.priority !== 'Normal' && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              thread.latestMessage.priority === 'Urgent' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {thread.latestMessage.priority}
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {formatDate(thread.latestMessage.created_date)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {!isExpanded && (
                        <p className="text-sm text-gray-600 line-clamp-2 ml-8">
                          {thread.latestMessage.message}
                        </p>
                      )}
                    </div>

                    {/* Expanded Thread */}
                    {isExpanded && (
                      <div className="px-6 pb-6 space-y-4 bg-gray-50">
                        {thread.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-4 rounded-lg ${
                              msg.sender_type === 'Client'
                                ? 'bg-blue-50 border border-blue-200 ml-8'
                                : 'bg-white border border-gray-200 mr-8'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">
                                  {msg.sender_type === 'Client' ? 'You' : 'DALCORE Team'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {formatDate(msg.created_date)}
                                </p>
                              </div>
                            </div>
                            <p className="text-gray-900 whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}