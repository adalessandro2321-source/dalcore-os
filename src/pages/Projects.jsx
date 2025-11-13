
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Projects() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [projectToDelete, setProjectToDelete] = React.useState(null);
  const [formData, setFormData] = React.useState({
    status: 'Planning'
  });
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Fetch project budgets to get revised contract values
  const { data: projectBudgets = [] } = useQuery({
    queryKey: ['projectBudgets'],
    queryFn: () => base44.entities.ProjectBudget.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] }); // Invalidate budgets as well
      setShowCreateModal(false);
      setFormData({ status: 'Planning' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId) => base44.entities.Project.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] }); // Invalidate budgets as well
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.client_id) {
      alert('Please select a client');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleRowClick = (project) => {
    navigate(createPageUrl(`ProjectDetail?id=${project.id}`));
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id);
    }
  };

  const getClientName = (clientId) => {
    const client = companies.find(c => c.id === clientId);
    return client?.name || '-';
  };

  const getRevisedContractValue = (project) => {
    const budget = projectBudgets.find(b => b.project_id === project.id);
    if (budget && typeof budget.revised_contract_value === 'number') {
      return budget.revised_contract_value;
    }
    return project.contract_value || 0;
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return '-';
    }
  };

  const columns = [
    {
      header: "Number",
      accessorKey: "number",
      cell: (row) => <span className="font-mono text-sm">{row.number || '-'}</span>,
      sortable: true,
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortable: true,
    },
    {
      header: "Client",
      accessorKey: "client_id",
      cell: (row) => getClientName(row.client_id),
      sortable: true,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    },
    {
      header: "Contract Value",
      accessorKey: "contract_value",
      cell: (row) => {
        const originalValue = row.contract_value || 0;
        const revisedValue = getRevisedContractValue(row);
        const hasChangeOrders = revisedValue !== originalValue;
        return (
          <div className="flex flex-col">
            <span className="font-semibold">{formatCurrency(revisedValue)}</span>
            {hasChangeOrders && (
              <span className="text-xs text-gray-600">
                (Original: {formatCurrency(originalValue)})
              </span>
            )}
          </div>
        );
      },
      sortable: true,
    },
    {
      header: "% Complete",
      accessorKey: "percent_complete",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-300 rounded-full h-2 max-w-[80px]">
            <div
              className="bg-[#1B4D3E] h-2 rounded-full"
              style={{ width: `${row.percent_complete || 0}%` }}
            />
          </div>
          <span className="text-sm">{row.percent_complete || 0}%</span>
        </div>
      ),
      sortable: true,
    },
    {
      header: "Start Date",
      accessorKey: "start_date",
      cell: (row) => formatDate(row.start_date),
      sortable: true,
    },
    {
      header: "Target Completion",
      accessorKey: "target_completion_date",
      cell: (row) => formatDate(row.target_completion_date),
      sortable: true,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <p className="text-gray-600 mt-1">Manage all construction projects</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={projects}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        onCreateNew={() => setShowCreateModal(true)}
        emptyMessage="No projects yet. Create your first project."
        searchPlaceholder="Search projects..."
        statusFilter={{
          field: 'status',
          options: ['Planning', 'Bidding', 'Active', 'On Hold', 'Completed', 'Closed']
        }}
      />

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Project Number</Label>
                <Input
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="P-2024-001"
                />
              </div>
              <div>
                <Label>Project Name <span className="text-red-600">*</span></Label>
                <Input
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="Downtown Office Tower"
                />
              </div>
            </div>

            <div>
              <Label>Client <span className="text-red-600">*</span></Label>
              <Select
                required
                value={formData.client_id || ''}
                onValueChange={(value) => setFormData({...formData, client_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select client (required)" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {companies.filter(c => c.type === 'Owner').length === 0 ? (
                    <div className="p-2 text-sm text-gray-600">
                      No clients available. Please create a company with type "Owner" first.
                    </div>
                  ) : (
                    companies.filter(c => c.type === 'Owner').map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {companies.filter(c => c.type === 'Owner').length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  No clients found. Go to Companies page and create a company with type "Owner".
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contract Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.contract_value || ''}
                  onChange={(e) => setFormData({...formData, contract_value: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="5000000.00"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status || 'Planning'}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="Bidding">Bidding</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Input
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={formData.state || ''}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>ZIP</Label>
                <Input
                  value={formData.zip || ''}
                  onChange={(e) => setFormData({...formData, zip: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Target Completion</Label>
                <Input
                  type="date"
                  value={formData.target_completion_date || ''}
                  onChange={(e) => setFormData({...formData, target_completion_date: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ status: 'Planning' });
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending || !formData.client_id}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{projectToDelete?.name}</span>?
            </p>
            <p className="text-sm text-red-600">
              Warning: This will permanently delete the project and all associated data including documents, budgets, daily logs, and financial records. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
