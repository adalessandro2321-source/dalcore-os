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
import { format } from "date-fns";
import { formatCurrency } from "../components/shared/DateFormatter";

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return format(new Date(dateString), 'MMM d, yyyy');
};

export default function Opportunities() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    stage: 'Lead'
  });
  const queryClient = useQueryClient();

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Filter out "Under Contract" opportunities - they're now projects
  const activeOpportunities = opportunities.filter(opp => opp.stage !== 'Under Contract');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Opportunity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setShowCreateModal(false);
      setFormData({ stage: 'Lead' });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }) => base44.entities.Opportunity.update(id, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleRowClick = (opportunity) => {
    navigate(createPageUrl(`OpportunityDetail?id=${opportunity.id}`));
  };

  const handleStageChange = (opportunityId, newStage, e) => {
    e.stopPropagation(); // Prevent row click navigation
    updateStageMutation.mutate({ id: opportunityId, stage: newStage });
  };

  const getClientName = (clientId) => {
    const client = companies.find(c => c.id === clientId);
    return client?.name || '-';
  };

  const columns = [
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
      header: "Stage",
      accessorKey: "stage",
      cell: (row) => (
        <Select
          value={row.stage}
          onValueChange={(value) => handleStageChange(row.id, value, event)}
        >
          <SelectTrigger 
            className="w-[180px] h-8 bg-white border-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue>
              <StatusBadge status={row.stage} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-300">
            <SelectItem value="Lead">
              <StatusBadge status="Lead" />
            </SelectItem>
            <SelectItem value="Qualified">
              <StatusBadge status="Qualified" />
            </SelectItem>
            <SelectItem value="Bidding">
              <StatusBadge status="Bidding" />
            </SelectItem>
            <SelectItem value="No Longer Bidding">
              <StatusBadge status="No Longer Bidding" />
            </SelectItem>
            <SelectItem value="Awarded">
              <StatusBadge status="Awarded" />
            </SelectItem>
            <SelectItem value="Lost">
              <StatusBadge status="Lost" />
            </SelectItem>
          </SelectContent>
        </Select>
      ),
      sortable: true,
    },
    {
      header: "Value",
      accessorKey: "estimated_value",
      cell: (row) => formatCurrency(row.estimated_value || 0),
      sortable: true,
    },
    {
      header: "Probability",
      accessorKey: "probability",
      cell: (row) => `${row.probability || 0}%`,
      sortable: true,
    },
    {
      header: "Bid Due",
      accessorKey: "bid_due_date",
      cell: (row) => formatDate(row.bid_due_date),
      sortable: true,
    },
    {
      header: "Assigned To",
      accessorKey: "assigned_to",
      cell: (row) => row.assigned_to || '-',
      sortable: true,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Pipeline</h2>
          <p className="text-gray-400 mt-1">Track opportunities and leads</p>
          <p className="text-xs text-gray-500 mt-1">
            Note: Opportunities marked "Under Contract" are automatically moved to Projects
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={activeOpportunities}
        isLoading={isLoading}
        onCreateNew={() => setShowCreateModal(true)}
        onRowClick={handleRowClick}
        emptyMessage="No opportunities yet. Add your first lead."
        statusFilter={{
          field: 'stage',
          options: ['Lead', 'Qualified', 'Bidding', 'No Longer Bidding', 'Awarded', 'Lost']
        }}
      />

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Opportunity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Opportunity Name</Label>
              <Input
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Downtown Office Renovation"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <Select
                  value={formData.client_id || ''}
                  onValueChange={(value) => setFormData({...formData, client_id: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    {companies.filter(c => c.type === 'Owner').map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stage</Label>
                <Select
                  value={formData.stage || 'Lead'}
                  onValueChange={(value) => setFormData({...formData, stage: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Qualified">Qualified</SelectItem>
                    <SelectItem value="Bidding">Bidding</SelectItem>
                    <SelectItem value="No Longer Bidding">No Longer Bidding</SelectItem>
                    <SelectItem value="Awarded">Awarded</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estimated Value</Label>
                <Input
                  type="number"
                  value={formData.estimated_value || ''}
                  onChange={(e) => setFormData({...formData, estimated_value: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="5000000"
                />
              </div>
              <div>
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability || ''}
                  onChange={(e) => setFormData({...formData, probability: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="75"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bid Due Date</Label>
                <Input
                  type="date"
                  value={formData.bid_due_date || ''}
                  onChange={(e) => setFormData({...formData, bid_due_date: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Project Start Date</Label>
                <Input
                  type="date"
                  value={formData.project_start_date || ''}
                  onChange={(e) => setFormData({...formData, project_start_date: e.target.value})}
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
                onClick={() => setShowCreateModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Opportunity'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}