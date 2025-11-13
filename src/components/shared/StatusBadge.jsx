import React from "react";
import { Badge } from "@/components/ui/badge";

const statusConfig = {
  // Project statuses
  Planning: { bg: "bg-[#9FA097]/20", text: "text-[#5A7765]", border: "border-[#9FA097]/30" },
  Bidding: { bg: "bg-[#C9C8AF]/30", text: "text-[#3B5B48]", border: "border-[#C9C8AF]/40" },
  Active: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  "On Hold": { bg: "bg-orange-500/20", text: "text-orange-700", border: "border-orange-500/30" },
  Completed: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  Closed: { bg: "bg-[#9FA097]/20", text: "text-[#181E18]", border: "border-[#9FA097]/30" },
  
  // Opportunity stages
  Lead: { bg: "bg-[#C9C8AF]/30", text: "text-[#5A7765]", border: "border-[#C9C8AF]/40" },
  Qualified: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  Awarded: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  "Under Contract": { bg: "bg-blue-500/20", text: "text-blue-700", border: "border-blue-500/30" },
  Lost: { bg: "bg-red-500/20", text: "text-red-700", border: "border-red-500/30" },
  
  // Invoice/Bill statuses
  Draft: { bg: "bg-[#E8E7DD]", text: "text-[#5A7765]", border: "border-[#C9C8AF]" },
  Sent: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  Partial: { bg: "bg-[#C9C8AF]/30", text: "text-[#3B5B48]", border: "border-[#C9C8AF]/40" },
  Paid: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  Overdue: { bg: "bg-red-500/20", text: "text-red-700", border: "border-red-500/30" },
  Pending: { bg: "bg-[#C9C8AF]/30", text: "text-[#5A7765]", border: "border-[#C9C8AF]/40" },
  
  // Change Order statuses
  Approved: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  Rejected: { bg: "bg-red-500/20", text: "text-red-700", border: "border-red-500/30" },
  
  // Estimate statuses
  Submitted: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  
  // Risk statuses
  Identified: { bg: "bg-[#C9C8AF]/30", text: "text-[#5A7765]", border: "border-[#C9C8AF]/40" },
  Monitoring: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  Mitigated: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  Occurred: { bg: "bg-red-500/20", text: "text-red-700", border: "border-red-500/30" },
  
  // Contract statuses
  Signed: { bg: "bg-[#0E351F]/20", text: "text-[#0E351F]", border: "border-[#0E351F]/30" },
  Executed: { bg: "bg-[#3B5B48]/20", text: "text-[#3B5B48]", border: "border-[#3B5B48]/30" },
  Voided: { bg: "bg-red-500/20", text: "text-red-700", border: "border-red-500/30" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.Draft;
  
  return (
    <Badge 
      variant="outline"
      className={`${config.bg} ${config.text} border ${config.border} font-medium`}
    >
      {status}
    </Badge>
  );
}