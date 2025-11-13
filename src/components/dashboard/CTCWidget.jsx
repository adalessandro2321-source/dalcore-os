
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
import { ArrowUpRight, AlertTriangle } from "lucide-react";

export default function CTCWidget() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: projectBudgets = [] } = useQuery({ // Renamed from 'budgets' to 'projectBudgets'
    queryKey: ['projectBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const activeProjects = projects.filter(p => p.status === 'Active');

  // Transformed projects to include budget-related data directly on the project object
  const projectsWithCTC = activeProjects.map(project => {
    const budget = projectBudgets.find(b => b.project_id === project.id);
    return {
      ...project,
      revised_contract_value: budget?.revised_contract_value || project.contract_value || 0,
      cost_to_complete: budget?.cost_to_complete || 0,
      forecast_at_completion: budget?.forecast_at_completion || 0,
      percent_complete_cost: budget?.percent_complete_cost || 0,
      actual_costs: budget?.actual_costs || 0, // Added for table display
      gp_forecast: budget?.gp_forecast || 0,   // Added for health indicator and table display
      ar_open: budget?.ar_open || 0,           // Added for table display
    };
  });

  // Calculate totals based on the new projectsWithCTC structure
  const totalCTC = projectsWithCTC.reduce((sum, p) => sum + p.cost_to_complete, 0); // Not used in render, but part of outline
  const totalContractValue = projectsWithCTC.reduce((sum, p) => sum + p.revised_contract_value, 0); // Not used in render, but part of outline

  const [sortField, setSortField] = React.useState('cost_to_complete');
  const [sortDirection, setSortDirection] = React.useState('desc');

  const sortedProjects = [...projectsWithCTC].sort((a, b) => {
    // Ensure that sorting uses the actual property on the project object
    const aValue = a[sortField] || 0;
    const bValue = b[sortField] || 0;
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending when changing sort field
    }
  };

  // getHealthIndicator now takes the full project object, as budget data is flattened
  const getHealthIndicator = (project) => {
    if (!project) return null; // Should not happen with the current mapping, but good safeguard
    const gpMargin = project.revised_contract_value > 0
      ? (project.gp_forecast / project.revised_contract_value) * 100
      : 0;

    if (gpMargin < 0 || project.cost_to_complete < 0) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />;
    } else if (gpMargin < 5) {
      return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
    }
    return <div className="w-2 h-2 rounded-full bg-[#1B4D3E]" />;
  };

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className="bg-[#F5F4F3] border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-300">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-900">Cost-to-Complete Overview</CardTitle>
          <Link
            to={createPageUrl("Projects")}
            className="text-sm text-[#1B4D3E] hover:text-[#14503C] flex items-center gap-1 font-medium"
          >
            View all
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedProjects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No active projects yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-300 hover:bg-[#EBEAE8]">
                  <TableHead className="text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-gray-700">Project</TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('revised_contract_value')}
                  >
                    Contract
                  </TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('actual_costs')}
                  >
                    Actual
                  </TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('forecast_at_completion')}
                  >
                    EAC
                  </TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('cost_to_complete')}
                  >
                    CTC
                  </TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('percent_complete_cost')}
                  >
                    % Complete
                  </TableHead>
                  <TableHead
                    className="text-gray-700 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort('gp_forecast')}
                  >
                    GP Forecast
                  </TableHead>
                  <TableHead className="text-gray-700">AR Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.map((project) => {
                  // 'b' is no longer used, project contains all necessary data
                  return (
                    <TableRow
                      key={project.id}
                      className="border-b border-gray-300 hover:bg-[#EBEAE8] cursor-pointer transition-colors"
                      onClick={() => window.location.href = createPageUrl(`ProjectDetail?id=${project.id}`)}
                    >
                      <TableCell>
                        {getHealthIndicator(project)} {/* Pass project directly */}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{project.name}</div>
                          <div className="text-xs text-gray-600">{project.number}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatCurrency(project.revised_contract_value)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatCurrency(project.actual_costs)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatCurrency(project.forecast_at_completion)}
                      </TableCell>
                      <TableCell className={
                        (project.cost_to_complete < 0) ? 'text-red-600 font-semibold' :
                        (project.cost_to_complete < 10000) ? 'text-yellow-700' :
                        'text-gray-900'
                      }>
                        {formatCurrency(project.cost_to_complete)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {(project.percent_complete_cost).toFixed(1)}%
                      </TableCell>
                      <TableCell className={
                        (project.gp_forecast < 0) ? 'text-red-600 font-semibold' :
                        (project.gp_forecast < 50000) ? 'text-yellow-700' :
                        'text-[#1B4D3E] font-semibold'
                      }>
                        {formatCurrency(project.gp_forecast)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatCurrency(project.ar_open)}
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
  );
}
