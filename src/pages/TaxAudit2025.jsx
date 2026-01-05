import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "../components/shared/DateFormatter";
import { format } from "date-fns";

export default function TaxAudit2025() {
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: performanceObligations = [], isLoading: poLoading } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list(),
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list(),
  });

  const { data: materialCosts = [], isLoading: materialCostsLoading } = useQuery({
    queryKey: ['materialCosts'],
    queryFn: () => base44.entities.MaterialCost.list(),
  });

  const { data: operatingExpenses = [], isLoading: operatingExpensesLoading } = useQuery({
    queryKey: ['operatingExpenses'],
    queryFn: () => base44.entities.OperatingExpense.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const cogsCategories = [
    'Labor - Field',
    'Labor - Site Supervision',
    'Materials',
    'Subcontractor',
    'Equipment Rental',
    'Permits & Inspections',
    'Waste Disposal',
    'Site Utilities',
    'Job-Specific Insurance',
    'Project Management'
  ];

  // Calculate total 2025 Operating Expenses
  const totalOperatingExpenses2025 = React.useMemo(() => {
    if (operatingExpensesLoading) return 0;
    return operatingExpenses.filter(oe => {
      if (!oe.date) return false;
      const expenseYear = new Date(oe.date).getUTCFullYear();
      return expenseYear === 2025;
    }).reduce((sum, oe) => sum + (oe.amount || 0), 0);
  }, [operatingExpenses, operatingExpensesLoading]);

  const auditData2025 = React.useMemo(() => {
    if (projectsLoading || poLoading || billsLoading || materialCostsLoading) {
      return [];
    }

    // Filter all completed projects for 2025 tax audit
    const completedProjects2025 = projects.filter(p => p.status === 'Completed');

    const projectAudits = completedProjects2025.map(project => {
      // Calculate Revenue: Completed performance obligations for this project
      const projectPOs = performanceObligations.filter(po => 
        po.project_id === project.id && po.status === 'Completed'
      );
      const revenue = projectPOs.reduce((sum, po) => sum + (po.allocated_value || 0), 0);

      // Calculate COGS from all Bills (excluding Draft and Void)
      const projectBills = bills.filter(b => 
        b.project_id === project.id &&
        b.status !== 'Draft' &&
        b.status !== 'Void'
      );
      const cogsFromBills = projectBills.reduce((sum, b) => sum + (b.amount || 0), 0);

      // Calculate COGS from all approved Material Costs
      const projectMaterialCosts = materialCosts.filter(m => 
        m.project_id === project.id &&
        m.approved
      );
      const cogsFromMaterials = projectMaterialCosts.reduce((sum, m) => sum + (m.amount || 0), 0);

      const totalCOGS = cogsFromBills + cogsFromMaterials;
      const grossProfit = revenue - totalCOGS;
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Get breakdown by bill category
      const cogsByCategory = {};
      projectBills.forEach(b => {
        const category = b.category || 'Other';
        cogsByCategory[category] = (cogsByCategory[category] || 0) + (b.amount || 0);
      });

      const client = companies.find(c => c.id === project.client_id);

      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.number,
        clientName: client?.name || '-',
        completionDate: project.actual_completion_date,
        revenue,
        cogsFromBills,
        cogsFromMaterials,
        totalCOGS,
        grossProfit,
        grossMargin,
        cogsByCategory,
        contractValue: project.contract_value || 0
      };
    });

    // Sort by completion date
    return projectAudits.sort((a, b) => 
      new Date(a.completionDate) - new Date(b.completionDate)
    );
  }, [projects, performanceObligations, bills, materialCosts, companies, projectsLoading, poLoading, billsLoading, materialCostsLoading]);

  const auditData2026 = React.useMemo(() => {
    if (projectsLoading || poLoading || billsLoading || materialCostsLoading) {
      return [];
    }

    // Filter projects NOT completed in 2025 (for 2026 forward look)
    const projects2026 = projects.filter(p => {
      // Include if not completed yet (Active, Planning, On Hold)
      if (['Active', 'Planning', 'On Hold'].includes(p.status)) return true;
      
      // Include if completed but after 2025
      if (p.status === 'Completed' && p.actual_completion_date) {
        const completionYear = new Date(p.actual_completion_date).getUTCFullYear();
        return completionYear > 2025;
      }
      
      return false;
    });

    const projectAudits = projects2026.map(project => {
      // Calculate Revenue: Completed performance obligations for this project
      const projectPOs = performanceObligations.filter(po => 
        po.project_id === project.id && po.status === 'Completed'
      );
      const revenue = projectPOs.reduce((sum, po) => sum + (po.allocated_value || 0), 0);

      // Calculate COGS from all Bills (excluding Draft and Void)
      const projectBills = bills.filter(b => 
        b.project_id === project.id &&
        b.status !== 'Draft' &&
        b.status !== 'Void'
      );
      const cogsFromBills = projectBills.reduce((sum, b) => sum + (b.amount || 0), 0);

      // Calculate COGS from all approved Material Costs
      const projectMaterialCosts = materialCosts.filter(m => 
        m.project_id === project.id &&
        m.approved
      );
      const cogsFromMaterials = projectMaterialCosts.reduce((sum, m) => sum + (m.amount || 0), 0);

      const totalCOGS = cogsFromBills + cogsFromMaterials;
      const grossProfit = revenue - totalCOGS;
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Get breakdown by bill category
      const cogsByCategory = {};
      projectBills.forEach(b => {
        const category = b.category || 'Other';
        cogsByCategory[category] = (cogsByCategory[category] || 0) + (b.amount || 0);
      });

      const client = companies.find(c => c.id === project.client_id);

      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.number,
        clientName: client?.name || '-',
        completionDate: project.actual_completion_date,
        status: project.status,
        revenue,
        cogsFromBills,
        cogsFromMaterials,
        totalCOGS,
        grossProfit,
        grossMargin,
        cogsByCategory,
        contractValue: project.contract_value || 0
      };
    });

    // Sort by status (Active first) then by name
    return projectAudits.sort((a, b) => {
      if (a.status === b.status) {
        return a.projectName.localeCompare(b.projectName);
      }
      return a.status === 'Active' ? -1 : 1;
    });
  }, [projects, performanceObligations, bills, materialCosts, companies, projectsLoading, poLoading, billsLoading, materialCostsLoading]);

  const totals2025 = React.useMemo(() => {
    const projectCOGS = auditData2025.reduce((sum, p) => sum + p.totalCOGS, 0);
    const finalTotalCOGS = projectCOGS + totalOperatingExpenses2025;
    const totalRevenue = auditData2025.reduce((sum, p) => sum + p.revenue, 0);
    const finalTotalGrossProfit = totalRevenue - finalTotalCOGS;
    const finalAvgGrossMargin = totalRevenue > 0 
      ? (finalTotalGrossProfit / totalRevenue) * 100 
      : 0;

    return {
      totalRevenue: totalRevenue,
      totalCOGS: finalTotalCOGS,
      totalGrossProfit: finalTotalGrossProfit,
      totalCogsFromBills: auditData2025.reduce((sum, p) => sum + p.cogsFromBills, 0),
      totalCogsFromMaterials: auditData2025.reduce((sum, p) => sum + p.cogsFromMaterials, 0),
      totalOperatingExpenses2025: totalOperatingExpenses2025,
      avgGrossMargin: finalAvgGrossMargin
    };
  }, [auditData2025, totalOperatingExpenses2025]);

  const totals2026 = React.useMemo(() => {
    const totalRevenue = auditData2026.reduce((sum, p) => sum + p.revenue, 0);
    const totalCOGS = auditData2026.reduce((sum, p) => sum + p.totalCOGS, 0);
    const totalGrossProfit = totalRevenue - totalCOGS;
    const avgGrossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue: totalRevenue,
      totalCOGS: totalCOGS,
      totalGrossProfit: totalGrossProfit,
      totalCogsFromBills: auditData2026.reduce((sum, p) => sum + p.cogsFromBills, 0),
      totalCogsFromMaterials: auditData2026.reduce((sum, p) => sum + p.cogsFromMaterials, 0),
      avgGrossMargin: avgGrossMargin
    };
  }, [auditData2026]);

  const handleExport = (year, data, totals) => {
    const csv = [
      [`${year} TAX AUDIT - ${year === '2025' ? 'COMPLETED PROJECTS' : 'ONGOING & FUTURE PROJECTS'}`],
      [`Generated: ${format(new Date(), 'MMM d, yyyy')}`],
      [''],
      ['Project Number', 'Project Name', 'Client', year === '2026' ? 'Status' : 'Completion Date', 'Contract Value', 'Revenue', 'COGS (Bills)', 'COGS (Materials)', 'Project COGS', 'Gross Profit', 'Margin %'],
      ...data.map(p => [
        p.projectNumber || '-',
        p.projectName,
        p.clientName,
        year === '2026' ? p.status : formatDate(p.completionDate),
        p.contractValue,
        p.revenue,
        p.cogsFromBills,
        p.cogsFromMaterials,
        p.totalCOGS,
        p.grossProfit,
        p.grossMargin.toFixed(2) + '%'
      ]),
      [''],
      ['PROJECT TOTALS', '', '', '', '', totals.totalRevenue, totals.totalCogsFromBills, totals.totalCogsFromMaterials, totals.totalCogsFromBills + totals.totalCogsFromMaterials, totals.totalRevenue - (totals.totalCogsFromBills + totals.totalCogsFromMaterials), '-'],
      ...(year === '2025' ? [
        ['2025 OPERATING EXPENSES', '', '', '', '', '', '', '', totals.totalOperatingExpenses2025, '', ''],
        ['GRAND TOTALS', '', '', '', '', totals.totalRevenue, '', '', totals.totalCOGS, totals.totalGrossProfit, totals.avgGrossMargin.toFixed(2) + '%']
      ] : [
        ['TOTALS', '', '', '', '', totals.totalRevenue, '', '', totals.totalCOGS, totals.totalGrossProfit, totals.avgGrossMargin.toFixed(2) + '%']
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${year}_Tax_Audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const isLoading = projectsLoading || poLoading || billsLoading || materialCostsLoading || operatingExpensesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading audit data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tax Audit</h2>
          <p className="text-gray-600 mt-1">
            Financial analysis by tax year
          </p>
        </div>
      </div>

      <Tabs defaultValue="2025" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="2025">2025 (Completed)</TabsTrigger>
          <TabsTrigger value="2026">2026 (Ongoing)</TabsTrigger>
        </TabsList>

        <TabsContent value="2025" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">2025 Tax Year</h3>
              <p className="text-sm text-gray-600 mt-1">
                Completed projects - gross profit analysis
              </p>
            </div>
            <Button
              onClick={() => handleExport('2025', auditData2025, totals2025)}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Projects Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{auditData2025.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(totals2025.totalRevenue)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total COGS</p>
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(totals2025.totalCOGS)}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Bills: {formatCurrency(totals2025.totalCogsFromBills)} + Materials: {formatCurrency(totals2025.totalCogsFromMaterials)} + OpEx: {formatCurrency(totals2025.totalOperatingExpenses2025)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Gross Profit</p>
                    <p className="text-3xl font-bold text-[#0E351F]">{formatCurrency(totals2025.totalGrossProfit)}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Avg Margin: {totals2025.avgGrossMargin.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-[#0E351F]" />
                </div>
              </CardContent>
            </Card>
          </div>

      {/* Detailed Table */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>Project-by-Project Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F4F3] border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Completed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Contract Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">COGS (Bills)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">COGS (Materials)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Project COGS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Gross Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditData2025.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                      No completed projects found
                    </td>
                  </tr>
                ) : (
                  auditData2025.map((project) => (
                    <tr key={project.projectId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{project.projectName}</p>
                          {project.projectNumber && (
                            <p className="text-xs text-gray-600">{project.projectNumber}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{project.clientName}</td>
                      <td className="px-4 py-3 text-gray-900">{formatDate(project.completionDate)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.contractValue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(project.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.cogsFromBills)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.cogsFromMaterials)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(project.totalCOGS)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(project.grossProfit)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${project.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {project.grossMargin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {auditData2025.length > 0 && (
                <tfoot className="bg-[#E8E7DD] border-t-2 border-gray-400">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-900">PROJECT TOTALS:</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totals2025.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2025.totalCogsFromBills)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2025.totalCogsFromMaterials)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2025.totalCogsFromBills + totals2025.totalCogsFromMaterials)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2025.totalRevenue - (totals2025.totalCogsFromBills + totals2025.totalCogsFromMaterials))}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">-</td>
                  </tr>
                  <tr>
                    <td colSpan="7" className="px-4 py-3 text-right font-bold text-gray-900">2025 OPERATING EXPENSES:</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">{formatCurrency(totals2025.totalOperatingExpenses2025)}</td>
                    <td colSpan="2"></td>
                  </tr>
                  <tr className="border-t-2 border-gray-500">
                    <td colSpan="7" className="px-4 py-3 text-right font-bold text-gray-900">GRAND TOTALS:</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totals2025.totalCOGS)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2025.totalGrossProfit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0E351F]">{totals2025.avgGrossMargin.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

          {/* Notes */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-2">2025 Audit Methodology</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>Projects Included:</strong> All projects with status 'Completed'</li>
                <li><strong>Revenue Recognition:</strong> All completed performance obligations linked to each project</li>
                <li><strong>COGS from Bills:</strong> All bills linked to each project (excluding Draft and Void status)</li>
                <li><strong>COGS from Materials:</strong> All approved material costs (including Tools and Fuel)</li>
                <li><strong>Operating Expenses:</strong> All 2025 operating expenses are included in the total COGS calculation as a separate line item</li>
                <li><strong>Note:</strong> Operating expenses are not allocated to individual projects; they are shown as a separate total</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2026" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">2026 Tax Year</h3>
              <p className="text-sm text-gray-600 mt-1">
                Ongoing & future projects - not completed in 2025
              </p>
            </div>
            <Button
              onClick={() => handleExport('2026', auditData2026, totals2026)}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Projects</p>
                    <p className="text-3xl font-bold text-gray-900">{auditData2026.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Revenue (To Date)</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(totals2026.totalRevenue)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total COGS (To Date)</p>
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(totals2026.totalCOGS)}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Bills: {formatCurrency(totals2026.totalCogsFromBills)} + Materials: {formatCurrency(totals2026.totalCogsFromMaterials)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Gross Profit (To Date)</p>
                    <p className="text-3xl font-bold text-[#0E351F]">{formatCurrency(totals2026.totalGrossProfit)}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Margin: {totals2026.avgGrossMargin.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-[#0E351F]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card className="bg-white border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <CardTitle>Project-by-Project Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F4F3] border-b border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Contract Value</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">COGS (Bills)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">COGS (Materials)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Project COGS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Gross Profit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {auditData2026.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                          No ongoing projects found
                        </td>
                      </tr>
                    ) : (
                      auditData2026.map((project) => (
                        <tr key={project.projectId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{project.projectName}</p>
                              {project.projectNumber && (
                                <p className="text-xs text-gray-600">{project.projectNumber}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{project.clientName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              project.status === 'Active' ? 'bg-green-100 text-green-800' :
                              project.status === 'Planning' ? 'bg-blue-100 text-blue-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {project.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.contractValue)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(project.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.cogsFromBills)}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(project.cogsFromMaterials)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(project.totalCOGS)}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(project.grossProfit)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${project.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {project.grossMargin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {auditData2026.length > 0 && (
                    <tfoot className="bg-[#E8E7DD] border-t-2 border-gray-400">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-900">TOTALS:</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totals2026.totalRevenue)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2026.totalCogsFromBills)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2026.totalCogsFromMaterials)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totals2026.totalCOGS)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals2026.totalGrossProfit)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#0E351F]">{totals2026.avgGrossMargin.toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-blue-900 mb-2">2026 Report Methodology</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>Projects Included:</strong> All projects NOT completed in 2025 (Active, Planning, On Hold, or completed after 2025)</li>
                <li><strong>Revenue Recognition:</strong> Completed performance obligations to date</li>
                <li><strong>COGS Calculation:</strong> All bills and approved material costs incurred to date</li>
                <li><strong>Note:</strong> This is a forward-looking report showing work in progress and future projects</li>
                <li><strong>Important:</strong> Final profit margins will be determined upon project completion</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}