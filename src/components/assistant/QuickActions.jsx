import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar,
  FileText,
  BarChart3,
  Shield,
  Users,
  Clock,
  Target
} from "lucide-react";

export default function QuickActions({ onAsk, isLoading }) {
  const actions = [
    {
      icon: TrendingUp,
      label: "Project Health",
      prompt: "Analyze the health of all my active projects. Show me which projects are on track, which are at risk, and why.",
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      icon: DollarSign,
      label: "Financial Summary",
      prompt: "Give me a comprehensive financial summary across all projects: total contract values, CTC, GP forecast, AR/AP status, and overall profitability.",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: AlertTriangle,
      label: "Risk Analysis",
      prompt: "Identify all current risks across my projects. Analyze daily logs, change orders, and budget variances to highlight concerns that need immediate attention.",
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
    {
      icon: Calendar,
      label: "Schedule Overview",
      prompt: "Review the schedule status of all my active projects. Which projects are on schedule? Which are delayed? What's on the critical path?",
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      icon: DollarSign,
      label: "Cash Flow",
      prompt: "Analyze my cash flow situation: outstanding AR, upcoming AP, revenue recognition timeline, and cash position for the next 30-60 days.",
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      icon: BarChart3,
      label: "Budget Performance",
      prompt: "Compare budget vs actual costs across all projects. Show me cost variances, forecast accuracy, and projects trending over budget.",
      color: "text-red-600",
      bg: "bg-red-50"
    },
    {
      icon: FileText,
      label: "Change Order Impact",
      prompt: "Analyze all change orders across projects: total value, approval rates, impact on profitability, and patterns that indicate scope creep.",
      color: "text-indigo-600",
      bg: "bg-indigo-50"
    },
    {
      icon: Users,
      label: "Subcontractor Performance",
      prompt: "Review subcontractor performance across all projects. Analyze costs, schedule adherence, and quality based on daily logs and bills.",
      color: "text-teal-600",
      bg: "bg-teal-50"
    },
    {
      icon: Shield,
      label: "Safety Report",
      prompt: "Review safety across all projects: incidents from daily logs, safety issues, injuries, and recommendations for improvement.",
      color: "text-yellow-600",
      bg: "bg-yellow-50"
    },
    {
      icon: Clock,
      label: "Upcoming Deadlines",
      prompt: "What are my critical upcoming deadlines? Include task due dates, invoice due dates, bill payment deadlines, and performance obligation milestones.",
      color: "text-pink-600",
      bg: "bg-pink-50"
    },
    {
      icon: Target,
      label: "Performance Obligations",
      prompt: "Analyze performance obligations across all projects: what's completed, what's pending, revenue recognition timing, and milestone status.",
      color: "text-cyan-600",
      bg: "bg-cyan-50"
    },
    {
      icon: TrendingUp,
      label: "Profitability Analysis",
      prompt: "Analyze profitability across my portfolio: which projects are most profitable, what factors drive profit, and where can I improve margins?",
      color: "text-violet-600",
      bg: "bg-violet-50"
    }
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Insights</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {actions.map((action, idx) => (
          <Button
            key={idx}
            onClick={() => onAsk(action.prompt)}
            disabled={isLoading}
            variant="outline"
            className={`h-auto py-4 px-4 flex flex-col items-center gap-2 ${action.bg} border-gray-300 hover:border-gray-400 transition-all`}
          >
            <action.icon className={`w-6 h-6 ${action.color}`} />
            <span className="text-xs font-medium text-gray-900 text-center">
              {action.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}