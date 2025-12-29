import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const auditData = React.useMemo(() => {
    if (projectsLoading || poLoading || billsLoading || materialCostsLoading) {
      return [];
    }

    // Filter projects completed in 2025
    const completedProjects2025 = projects.filter(p => {
      if (!p.actual_completion_date) return false;
      const completionYear = new Date(p.actual_completion_date).getFullYear();
      return completionYear === 2025;
    });

    const projectAudits = completedProjects2025.map(project => {
      // Calculate Revenue: Completed performance obligations for this project
      const projectPOs = performanceObligations.filter(po => 
        po.project_id === project.id && po.status === 'Completed'
      );
      const revenue = projectPOs.reduce((sum, po) => sum + (po.allocated_value || 0), 0);

      // Calculate COGS from Bills (approved in 2025)
      const projectBills = bills.filter(b => 
        b.project_id === project.id &&
        b.category && cogsCategories.includes(b.category) &&
        b.approved_at &&
        new Date(b.approved_at).getFullYear() === 2025
      );
      const cogsFromBills = projectBills.reduce((sum, b) => sum + (b.amount || 0), 0);

      // Calculate COGS from Material Costs (approved in 2025)
      const projectMaterialCosts = materialCosts.filter(m => 
        m.project_id === project.id &&
        m.approved &&
        m.date &&
        new Date(m.date).getFullYear() === 2025
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

  const totals = React.useMemo(() => {
    return {
      totalRevenue: auditData.reduce((sum, p) => sum + p.revenue, 0),
      totalCOGS: auditData.reduce((sum, p) => sum + p.totalCOGS, 0),
      totalGrossProfit: auditData.reduce((sum, p) => sum + p.grossProfit, 0),
      totalCogsFromBills: auditData.reduce((sum, p) => sum + p.cogsFromBills, 0),
      totalCogsFromMaterials: auditData.reduce((sum, p) => sum + p.cogsFromMaterials, 0),
      avgGrossMargin: auditData.length > 0 
        ? auditData.reduce((sum, p) => sum + p.grossMargin, 0) / auditData.length 
        : 0
    };
  }, [auditData]);

  const handleExport = () => {
    const csv = [
      ['2025 TAX AUDIT - COMPLETED PROJECTS'],
      [`Generated: ${format(new Date(), 'MMM d, yyyy')}`],
      [''],
      ['Project Number', 'Project Name', 'Client', 'Completion Date', 'Contract Value', 'Revenue', 'COGS (Bills)', 'COGS (Materials)', 'Total COGS', 'Gross Profit', 'Gross Margin %'],
      ...auditData.map(p => [
        p.projectNumber || '-',
        p.projectName,
        p.clientName,
        formatDate(p.completionDate),
        p.contractValue,
        p.revenue,
        p.cogsFromBills,
        p.cogsFromMaterials,
        p.totalCOGS,
        p.grossProfit,
        p.grossMargin.toFixed(2) + '%'
      ]),
      [''],
      ['TOTALS', '', '', '', '', totals.totalRevenue, totals.totalCogsFromBills, totals.totalCogsFromMaterials, totals.totalCOGS, totals.totalGrossProfit, totals.avgGrossMargin.toFixed(2) + '%']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2025_Tax_Audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const isLoading = projectsLoading || poLoading || billsLoading || materialCostsLoading;

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
          <h2 className="text-2xl font-bold text-gray-900">2025 Tax Audit</h2>
          <p className="text-gray-600 mt-1">
            Gross profit analysis for projects completed in 2025 (by actual completion date)
          </p>
        </div>
        <Button
          onClick={handleExport}
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
                <p className="text-3xl font-bold text-gray-900">{auditData.length}</p>
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
                <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
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
                <p className="text-3xl font-bold text-red-600">{formatCurrency(totals.totalCOGS)}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Bills: {formatCurrency(totals.totalCogsFromBills)} + Materials: {formatCurrency(totals.totalCogsFromMaterials)}
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
                <p className="text-3xl font-bold text-[#0E351F]">{formatCurrency(totals.totalGrossProfit)}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Avg Margin: {totals.avgGrossMargin.toFixed(1)}%
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Total COGS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Gross Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditData.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                      No projects were completed in 2025 (based on actual completion date)
                    </td>
                  </tr>
                ) : (
                  auditData.map((project) => (
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
              {auditData.length > 0 && (
                <tfoot className="bg-[#E8E7DD] border-t-2 border-gray-400">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-900">TOTALS:</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalCogsFromBills)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalCogsFromMaterials)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totals.totalCOGS)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totals.totalGrossProfit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0E351F]">{totals.avgGrossMargin.toFixed(1)}%</td>
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
          <h3 className="font-semibold text-blue-900 mb-2">Audit Methodology</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Projects Included:</strong> Only projects with an actual completion date in 2025</li>
            <li><strong>Revenue Recognition:</strong> All completed performance obligations linked to each project</li>
            <li><strong>COGS from Bills:</strong> All bills approved in 2025 with COGS categories (Subcontractor, Materials, Labor, Equipment, etc.)</li>
            <li><strong>COGS from Materials:</strong> All approved material costs (including Tools and Fuel) dated in 2025</li>
            <li><strong>Exclusions:</strong> Operating expenses (Salaries, Insurance, Professional Services) are not allocated to project-level COGS</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}