
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Users,
  Shield,
  Zap,
  BarChart3,
  LogOut
} from "lucide-react";
import { parseISO, startOfYear, isWithinInterval } from "date-fns";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
  });

  const { data: performanceObligations = [] } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list(),
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  const activeProjects = projects.filter(p => p.status === 'Active');
  const pipelineValue = opportunities
    .filter(o => ['Qualified', 'Bidding', 'Awarded'].includes(o.stage))
    .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

  // Calculate current year revenue
  const currentYear = new Date().getFullYear();
  
  // Revenue Recognized: Completed obligations in current year
  const currentYearRevenueRecognized = performanceObligations
    .filter(po => {
      if (po.status !== 'Completed' || !po.completion_date) return false;
      const completionYear = new Date(po.completion_date).getFullYear();
      return completionYear === currentYear;
    })
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  // Revenue Pending Recognition: Not Started + In Progress obligations
  const currentYearRevenuePending = performanceObligations
    .filter(po => {
      if (!['Not Started', 'In Progress'].includes(po.status)) return false;
      // Include if estimated completion is in current year, or if no estimated date, include all pending
      if (!po.estimated_completion_date) return true;
      const estimatedYear = new Date(po.estimated_completion_date).getFullYear();
      return estimatedYear === currentYear;
    })
    .reduce((sum, po) => sum + (po.allocated_value || 0), 0);

  // Total Revenue (Recognized + Pending for current year)
  const currentYearTotalRevenue = currentYearRevenueRecognized + currentYearRevenuePending;

  const quickLinks = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      url: "Dashboard",
      description: "Executive overview & analytics",
      gradient: "from-emerald-400 via-emerald-500 to-emerald-600"
    },
    {
      title: "Projects",
      icon: FolderOpen,
      url: "Projects",
      description: "Manage active construction projects",
      gradient: "from-teal-400 via-teal-500 to-teal-600"
    },
    {
      title: "Opportunities",
      icon: Briefcase,
      url: "Opportunities",
      description: "Track bids & new business",
      gradient: "from-cyan-400 via-cyan-500 to-cyan-600"
    },
    {
      title: "Finance",
      icon: DollarSign,
      url: "Finance",
      description: "Invoices, bills & cash flow",
      gradient: "from-green-400 via-green-500 to-green-600"
    },
    {
      title: "Schedule",
      icon: Calendar,
      url: "Schedule",
      description: "Project timelines & milestones",
      gradient: "from-lime-400 via-lime-500 to-lime-600"
    },
    {
      title: "Companies",
      icon: Building2,
      url: "Companies",
      description: "Clients, vendors & subcontractors",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500"
    },
  ];

  const features = [
    {
      icon: TrendingUp,
      title: "Real-Time Financials",
      description: "Track budgets, costs, AR/AP, and profitability across all projects"
    },
    {
      icon: CheckCircle,
      title: "Smart Project Management",
      description: "Manage schedules, daily logs, change orders, and documents"
    },
    {
      icon: Shield,
      title: "Risk Intelligence",
      description: "AI-powered risk detection from daily logs and activities"
    },
    {
      icon: Zap,
      title: "Intelligent Assistant",
      description: "AI agent with full platform access for instant answers"
    },
  ];

  const formatCurrency = (value) => {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="min-h-screen bg-[#0A1F14]">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative">
        {/* User Badge in Top Right */}
        {user && (
          <div className="absolute top-6 right-6 z-10">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left">
                <p className="text-xs text-emerald-300">Welcome back</p>
                <p className="text-sm font-semibold text-white">{user.full_name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 text-emerald-300" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="mb-12 flex justify-center">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f46dde05ec96bd3a391a72/b8af18823_DALCORE_Primary_White.png"
                alt="DALCORE Contracting"
                className="h-40 w-auto opacity-0 animate-fade-in"
                style={{ animation: 'fadeIn 1s ease-in forwards' }}
              />
            </div>

            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-fade-in {
                animation: fadeIn 1s ease-in forwards;
              }
            `}</style>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              Construction Management Intelligence
            </h2>
            <p className="text-xl text-emerald-100/80 mb-10 max-w-3xl mx-auto leading-relaxed">
              Your complete platform for real-time financials, intelligent risk detection, and seamless project tracking
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={() => navigate(createPageUrl('Dashboard'))}
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-lg px-10 py-7 rounded-xl shadow-2xl shadow-emerald-500/25 transition-all hover:scale-105"
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Open Dashboard
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('Projects'))}
                size="lg"
                className="bg-white/10 backdrop-blur-xl border-2 border-white/30 text-white hover:bg-white/20 hover:border-white/50 text-lg px-10 py-7 rounded-xl transition-all hover:scale-105"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                View Projects
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <Card className="bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-400/50 transition-all duration-300 hover:scale-105 shadow-xl">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30">
                    <FolderOpen className="w-8 h-8 text-emerald-400" />
                  </div>
                  <TrendingUp className="w-6 h-6 text-emerald-400/60" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{activeProjects.length}</p>
                <p className="text-lg text-emerald-200 font-medium">Active Projects</p>
                <p className="text-sm text-emerald-100/50 mt-2">
                  {projects.length} total projects
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-teal-400/50 transition-all duration-300 hover:scale-105 shadow-xl">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-teal-500/20 border border-teal-400/30">
                    <DollarSign className="w-8 h-8 text-teal-400" />
                  </div>
                  <BarChart3 className="w-6 h-6 text-teal-400/60" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{formatCurrency(pipelineValue)}</p>
                <p className="text-lg text-teal-200 font-medium">Pipeline Value</p>
                <p className="text-sm text-teal-100/50 mt-2">
                  {opportunities.filter(o => ['Qualified', 'Bidding', 'Awarded'].includes(o.stage)).length} opportunities
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-cyan-400/50 transition-all duration-300 hover:scale-105 shadow-xl">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-4 rounded-2xl bg-cyan-500/20 border border-cyan-400/30">
                    <FileText className="w-8 h-8 text-cyan-400" />
                  </div>
                  <CheckCircle className="w-6 h-6 text-cyan-400/60" />
                </div>
                <p className="text-5xl font-bold text-white mb-2">{formatCurrency(currentYearTotalRevenue)}</p>
                <p className="text-lg text-cyan-200 font-medium">{currentYear} Revenue</p>
                <p className="text-sm text-cyan-100/50 mt-2">
                  {formatCurrency(currentYearRevenueRecognized)} recognized
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="relative bg-gradient-to-b from-transparent via-[#0D2A1C]/50 to-transparent py-20">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12">
                <h3 className="text-4xl font-bold text-white mb-4">
                  Quick Access
                </h3>
                <p className="text-lg text-emerald-100/60">
                  Jump directly into any module
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quickLinks.map((link, idx) => (
                  <Card
                    key={link.url}
                    className="group cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/10 overflow-hidden"
                    onClick={() => navigate(createPageUrl(link.url))}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <CardContent className="p-0">
                      <div className={`h-1 bg-gradient-to-r ${link.gradient}`}></div>
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${link.gradient} bg-opacity-20 group-hover:scale-110 transition-transform`}>
                            <link.icon className="w-6 h-6 text-white" />
                          </div>
                          <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2">
                          {link.title}
                        </h4>
                        <p className="text-sm text-emerald-100/60 leading-relaxed">
                          {link.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="relative py-20">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h3 className="text-4xl font-bold text-white mb-4">
                  Why DALCORE OS?
                </h3>
                <p className="text-lg text-emerald-100/60">
                  Everything you need to run a modern construction business
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="text-center group"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 backdrop-blur-xl border border-white/10 mb-6 group-hover:scale-110 group-hover:border-emerald-400/50 transition-all">
                      <feature.icon className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-3">
                      {feature.title}
                    </h4>
                    <p className="text-emerald-100/60 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative py-20">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10"></div>
            <div className="relative max-w-4xl mx-auto px-6 text-center">
              <div className="mb-8">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f46dde05ec96bd3a391a72/619a02375_DALCORE_WordmarkIcon_White.png"
                  alt="DALCORE"
                  className="h-16 w-auto mx-auto opacity-90"
                />
              </div>
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to get started?
              </h3>
              <p className="text-xl text-emerald-100/80 mb-10 leading-relaxed">
                Access your dashboard and start managing your projects more efficiently
              </p>
              <Button
                onClick={() => navigate(createPageUrl('Dashboard'))}
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-lg px-12 py-7 rounded-xl shadow-2xl shadow-emerald-500/25 transition-all hover:scale-105"
              >
                <LayoutDashboard className="w-5 h-5 mr-2" />
                Open Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          <div className="relative border-t border-white/10 py-12">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f46dde05ec96bd3a391a72/f67edfc82_DALCORE_Icon_White.png"
                    alt="DALCORE"
                    className="w-10 h-10"
                  />
                  <div className="text-left">
                    <p className="text-sm text-white font-semibold">DALCORE OS</p>
                    <p className="text-xs text-emerald-100/50">Construction Management Intelligence</p>
                  </div>
                </div>
                <p className="text-sm text-emerald-100/50">
                  © 2025 DALCORE Contracting. All rights reserved.
                </p>
                <p className="text-sm text-emerald-100/50">
                  Powered by <span className="text-emerald-400 font-semibold">base44</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
