import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";

export default function PerformanceObligations() {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    status: 'Not Started',
    percentage_of_contract: 0
  });
  const queryClient = useQueryClient();

  const { data: obligations = [], isLoading } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Calculate allocated value from percentage
      const project = projects.find(p => p.id === data.project_id);
      const allocated_value = project ? (project.contract_value || 0) * (data.percentage_of_contract / 100) : 0;
      
      return base44.entities.PerformanceObligation.create({
        ...data,
        allocated_value,
        completion_date: data.status === 'Completed' ? (data.completion_date || new Date().toISOString()) : data.completion_date
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      setShowCreateModal(false);
      setFormData({ status: 'Not Started', percentage_of_contract: 0 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PerformanceObligation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDeleteClick = (e, obligation) => {
    e.stopPropagation();
    if (confirm(`Delete performance obligation "${obligation.name}"?`)) {
      deleteMutation.mutate(obligation.id);
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || '-';
  };

  const columns = [
    {
      header: "Project",
      accessorKey: "project_id",
      cell: (row) => <span className="font-medium">{getProjectName(row.project_id)}</span>,
      sortable: true,
    },
    {
      header: "Obligation",
      accessorKey: "name",
      sortable: true,
    },
    {
      header: "% of Contract",
      accessorKey: "percentage_of_contract",
      cell: (row) => `${row.percentage_of_contract}%`,
      sortable: true,
    },
    {
      header: "Allocated Value",
      accessorKey: "allocated_value",
      cell: (row) => formatCurrency(row.allocated_value),
      sortable: true,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    },
    {
      header: "Completion Date",
      accessorKey: "completion_date",
      cell: (row) => formatDate(row.completion_date),
      sortable: true,
    },
    {
      header: "Actions",
      sortable: false,
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => handleDeleteClick(e, row)}
          className="text-gray-600 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Obligations</h2>
          <p className="text-gray-600 mt-1">Revenue recognition tracking</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={obligations}
        isLoading={isLoading}
        onCreateNew={() => setShowCreateModal(true)}
        emptyMessage="No performance obligations yet. Create your first one."
        searchPlaceholder="Search obligations..."
        statusFilter={{
          field: 'status',
          options: ['Not Started', 'In Progress', 'Completed']
        }}
      />

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Performance Obligation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Project <span className="text-red-600">*</span></Label>
              <Select
                required
                value={formData.project_id || ''}
                onValueChange={(value) => setFormData({...formData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {formatCurrency(project.contract_value || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Obligation Name <span className="text-red-600">*</span></Label>
              <Input
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border-gray-300"
                placeholder="e.g., Phase 1 - Foundation"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>% of Contract Value <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.percentage_of_contract || ''}
                  onChange={(e) => setFormData({...formData, percentage_of_contract: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status || 'Not Started'}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estimated Completion</Label>
                <Input
                  type="date"
                  value={formData.estimated_completion_date || ''}
                  onChange={(e) => setFormData({...formData, estimated_completion_date: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>
              {formData.status === 'Completed' && (
                <div>
                  <Label>Actual Completion Date <span className="text-red-600">*</span></Label>
                  <Input
                    type="date"
                    required
                    value={formData.completion_date || ''}
                    onChange={(e) => setFormData({...formData, completion_date: e.target.value})}
                    className="bg-white border-gray-300"
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-gray-300"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ status: 'Not Started', percentage_of_contract: 0 });
                }}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Obligation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}