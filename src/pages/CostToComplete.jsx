import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default function CostToComplete() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['projectBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const activeProjects = projects.filter(p => p.status === 'Active');

  const projectsWithBudgets = activeProjects.map(project => {
    const budget = budgets.find(b => b.project_id === project.id);
    return { ...project, budget };
  });

  const [sortField, setSortField] = React.useState('cost_to_complete');
  const [sortDirection, setSortDirection] = React.useState('desc');

  const sortedProjects = [...projectsWithBudgets].sort((a, b) => {
    const aValue = a.budget?.[sortField] || 0;
    const bValue = b.budget?.[sortField] || 0;
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportCSV = () => {
    const csv = [
      ['Project', 'Project #', 'Revised Contract', 'Actual Costs', 'EAC', 'CTC', '% Complete', 'GP Forecast', 'AP Open', 'AR Open'],
      ...sortedProjects.map(p => [
        p.name,
        p.number,
        p.budget?.revised_contract_value || 0,
        p.budget?.actual_costs || 0,
        p.budget?.forecast_at_completion || 0,
        p.budget?.cost_to_complete || 0,
        p.budget?.percent_complete_cost || 0,
        p.budget?.gp_forecast || 0,
        p.budget?.ap_open || 0,
        p.budget?.ar_open || 0,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CTC_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getHealthIndicator = (budget) => {
    if (!budget) return null;
    const gpMargin = budget.revised_contract_value > 0 
      ? (budget.gp_forecast / budget.revised_contract_value) * 100 
      : 0;
    
    if (gpMargin < 0 || budget.cost_to_complete < 0) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />;
    } else if (gpMargin < 5) {
      return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
    }
    return <div className="w-2 h-2 rounded-full bg-[#2A6B5A]" />;
  };

  const totals = sortedProjects.reduce((acc, p) => {
    const b = p.budget;
    return {
      revised_contract_value: acc.revised_contract_value + (b?.revised_contract_value || 0),
      actual_costs: acc.actual_costs + (b?.actual_costs || 0),
      forecast_at_completion: acc.forecast_at_completion + (b?.forecast_at_completion || 0),
      cost_to_complete: acc.cost_to_complete + (b?.cost_to_complete || 0),
      gp_forecast: acc.gp_forecast + (b?.gp_forecast || 0),
      ap_open: acc.ap_open + (b?.ap_open || 0),
      ar_open: acc.ar_open + (b?.ar_open || 0),
    };
  }, {
    revised_contract_value: 0,
    actual_costs: 0,
    forecast_at_completion: 0,
    cost_to_complete: 0,
    gp_forecast: 0,
    ap_open: 0,
    ar_open: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Cost-to-Complete</h2>
          <p className="text-gray-400 mt-1">Real-time financial tracking across all active projects</p>
        </div>
        <Button
          onClick={exportCSV}
          variant="outline"
          className="border-[#2A3441] text-gray-300"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#1A1F27] border-[#2A3441]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Contract Value</p>
            <p className="text-2xl font-bold text-gray-100">
              ${(totals.revised_contract_value / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1F27] border-[#2A3441]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Actual Costs</p>
            <p className="text-2xl font-bold text-gray-100">
              ${(totals.actual_costs / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1F27] border-[#2A3441]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total CTC</p>
            <p className={`text-2xl font-bold ${totals.cost_to_complete < 0 ? 'text-red-400' : 'text-gray-100'}`}>
              ${(totals.cost_to_complete / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1F27] border-[#2A3441]">
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total GP Forecast</p>
            <p className={`text-2xl font-bold ${totals.gp_forecast < 0 ? 'text-red-400' : 'text-[#2A6B5A]'}`}>
              ${(totals.gp_forecast / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card className="bg-[#1A1F27] border-[#2A3441]">
        <CardHeader className="border-b border-[#2A3441]">
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedProjects.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No active projects with budget data yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#2A3441] hover:bg-[#1A1F27]">
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Project</TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('revised_contract_value')}
                    >
                      Contract
                    </TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('actual_costs')}
                    >
                      Actual
                    </TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('forecast_at_completion')}
                    >
                      EAC
                    </TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('cost_to_complete')}
                    >
                      CTC
                    </TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('percent_complete_cost')}
                    >
                      % Complete
                    </TableHead>
                    <TableHead 
                      className="text-gray-400 cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('gp_forecast')}
                    >
                      GP Forecast
                    </TableHead>
                    <TableHead className="text-gray-400">AP Open</TableHead>
                    <TableHead className="text-gray-400">AR Open</TableHead>
                    <TableHead className="text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => {
                    const b = project.budget;
                    return (
                      <TableRow 
                        key={project.id}
                        className="border-b border-[#2A3441] hover:bg-[#252B35]"
                      >
                        <TableCell>
                          {getHealthIndicator(b)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-100">{project.name}</div>
                            <div className="text-xs text-gray-500">{project.number}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          ${((b?.revised_contract_value || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className="text-gray-300">
                          ${((b?.actual_costs || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className="text-gray-300">
                          ${((b?.forecast_at_completion || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className={
                          (b?.cost_to_complete || 0) < 0 ? 'text-red-400 font-semibold' :
                          (b?.cost_to_complete || 0) < 10000 ? 'text-yellow-400' :
                          'text-gray-300'
                        }>
                          ${((b?.cost_to_complete || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {(b?.percent_complete_cost || 0).toFixed(1)}%
                        </TableCell>
                        <TableCell className={
                          (b?.gp_forecast || 0) < 0 ? 'text-red-400 font-semibold' :
                          (b?.gp_forecast || 0) < 50000 ? 'text-yellow-400' :
                          'text-[#2A6B5A] font-semibold'
                        }>
                          ${((b?.gp_forecast || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className="text-gray-300">
                          ${((b?.ap_open || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell className="text-gray-300">
                          ${((b?.ar_open || 0) / 1000).toFixed(0)}K
                        </TableCell>
                        <TableCell>
                          <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-200">
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}