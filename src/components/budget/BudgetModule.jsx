import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  FileText, 
  History, 
  BarChart3,
  Loader2
} from "lucide-react";
import BudgetLineItems from "./BudgetLineItems";
import BudgetRevisions from "./BudgetRevisions";
import BudgetVsActualReport from "./BudgetVsActualReport";

export default function BudgetModule({ projectId, project }) {
  const [budgetTotals, setBudgetTotals] = React.useState(null);

  const { data: estimate } = useQuery({
    queryKey: ['estimate', project?.estimate_id],
    queryFn: async () => {
      if (!project?.estimate_id) return null;
      const estimates = await base44.entities.Estimate.list();
      return estimates.find(e => e.id === project.estimate_id);
    },
    enabled: !!project?.estimate_id,
  });

  const { data: lineItems = [], isLoading } = useQuery({
    queryKey: ['budgetLineItems', projectId],
    queryFn: () => base44.entities.BudgetLineItem.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills', projectId],
    queryFn: () => base44.entities.Bill.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  // Calculate actuals from bills
  const getActualsByCategory = React.useMemo(() => {
    const categoryMap = {};
    
    bills.forEach(bill => {
      if (bill.status === 'Paid' || bill.status === 'Approved') {
        const amount = bill.amount || 0;
        let category = 'Other';
        
        switch (bill.category) {
          case 'Labor - Field':
            category = 'Labor - Field';
            break;
          case 'Labor - Site Supervision':
            category = 'Labor - Supervision';
            break;
          case 'Project Management':
            category = 'Labor - Project Management';
            break;
          case 'Materials':
            category = 'Materials';
            break;
          case 'Subcontractor':
            category = 'Subcontractors';
            break;
          case 'Equipment Rental':
            category = 'Equipment Rental';
            break;
          case 'Permits & Inspections':
            category = 'Permits & Fees';
            break;
          case 'Job-Specific Insurance':
            category = 'Insurance';
            break;
          case 'Site Utilities':
            category = 'Utilities';
            break;
          case 'Waste Disposal':
            category = 'Waste Disposal';
            break;
          case 'Professional Services':
            category = 'Professional Services';
            break;
          default:
            category = 'Other';
        }
        
        categoryMap[category] = (categoryMap[category] || 0) + amount;
      }
    });

    return categoryMap;
  }, [bills]);

  // Enhance line items with actuals
  const enhancedLineItems = React.useMemo(() => {
    return lineItems.map(item => {
      const actual = getActualsByCategory[item.category] || 0;
      const revised = item.revised_amount || item.budgeted_amount || 0;
      const variance = revised - actual;
      const variancePercent = revised > 0 ? ((variance / revised) * 100) : 0;
      
      return {
        ...item,
        actual_amount: actual,
        variance,
        variance_percent: variancePercent
      };
    });
  }, [lineItems, getActualsByCategory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="line-items" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="line-items" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Budget Line Items
          </TabsTrigger>
          <TabsTrigger value="revisions" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <History className="w-4 h-4 mr-2" />
            Revisions
          </TabsTrigger>
          <TabsTrigger value="report" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Budget vs Actual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="line-items">
          <BudgetLineItems 
            projectId={projectId} 
            estimate={estimate}
            onTotalsChange={setBudgetTotals}
          />
        </TabsContent>

        <TabsContent value="revisions">
          <BudgetRevisions 
            projectId={projectId}
            lineItems={enhancedLineItems}
            currentTotal={budgetTotals?.revised || 0}
          />
        </TabsContent>

        <TabsContent value="report">
          <BudgetVsActualReport 
            lineItems={enhancedLineItems}
            projectName={project?.name || 'Project'}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}