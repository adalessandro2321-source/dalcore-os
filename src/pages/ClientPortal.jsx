import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  FolderOpen,
  FileText,
  DollarSign,
  MessageSquare,
  Star,
  TrendingUp,
  Clock,
  CheckCircle
} from "lucide-react";
import ClientProjects from "../components/client-portal/ClientProjects";
import ClientOpportunities from "../components/client-portal/ClientOpportunities";
import ClientInvoices from "../components/client-portal/ClientInvoices";
import ClientDocuments from "../components/client-portal/ClientDocuments";
import ClientMessages from "../components/client-portal/ClientMessages";
import ClientFeedbackForm from "../components/client-portal/ClientFeedbackForm";
import { formatCurrency } from "../components/shared/DateFormatter";

export default function ClientPortal() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: company } = useQuery({
    queryKey: ['clientCompany', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      // Find company associated with this user's email
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.email === user.email || c.type === 'Owner');
    },
    enabled: !!user?.email,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['clientProjects', company?.id],
    queryFn: () => base44.entities.Project.filter({ client_id: company.id }, '-created_date'),
    enabled: !!company?.id,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['clientOpportunities', company?.id],
    queryFn: () => base44.entities.Opportunity.filter({ client_id: company.id }, '-created_date'),
    enabled: !!company?.id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['clientInvoices', company?.id],
    queryFn: () => base44.entities.Invoice.filter({ client_id: company.id }, '-created_date'),
    enabled: !!company?.id,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ['clientUnreadMessages', company?.id],
    queryFn: async () => {
      const messages = await base44.entities.ClientMessage.filter({ 
        client_id: company.id,
        read: false,
        sender_type: 'Team'
      });
      return messages;
    },
    enabled: !!company?.id,
  });

  // Calculate statistics
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid').length;
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'Paid')
    .reduce((sum, inv) => sum + (inv.balance_open || inv.total || 0), 0);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-[#0E351F] to-[#3B5B48] rounded-xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {company?.name || user.full_name}</h1>
            <p className="text-gray-200">Here's an overview of your projects and account status</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Building2 className="w-12 h-12" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Projects</p>
                <p className="text-3xl font-bold text-[#0E351F]">{activeProjects}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-[#0E351F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed Projects</p>
                <p className="text-3xl font-bold text-green-600">{completedProjects}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totalOutstanding)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{unpaidInvoices} unpaid invoices</p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">New Messages</p>
                <p className="text-3xl font-bold text-blue-600">{unreadMessages.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="projects" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FolderOpen className="w-4 h-4 mr-2" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <MessageSquare className="w-4 h-4 mr-2" />
            Messages
            {unreadMessages.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {unreadMessages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <Star className="w-4 h-4 mr-2" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <ClientProjects projects={projects} company={company} />
        </TabsContent>

        <TabsContent value="opportunities">
          <ClientOpportunities opportunities={opportunities} company={company} />
        </TabsContent>

        <TabsContent value="invoices">
          <ClientInvoices invoices={invoices} company={company} />
        </TabsContent>

        <TabsContent value="documents">
          <ClientDocuments companyId={company?.id} projects={projects} />
        </TabsContent>

        <TabsContent value="messages">
          <ClientMessages companyId={company?.id} userEmail={user?.email} />
        </TabsContent>

        <TabsContent value="feedback">
          <ClientFeedbackForm 
            projects={projects.filter(p => p.status === 'Completed')} 
            companyId={company?.id}
            userEmail={user?.email}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}