import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import OpportunityAnalytics from "../components/opportunity/OpportunityAnalytics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { formatCurrency } from "../components/shared/DateFormatter";
import { List, BarChart3 } from "lucide-react";

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
    mutationFn: async ({ id, stage, opportunityData }) => {
      console.log('Stage change requested:', { id, stage, opportunityData });
      
      // If moving to "Under Contract", create a project
      if (stage === 'Under Contract') {
        const opportunity = opportunityData;
        
        // Generate project number
        const projects = await base44.entities.Project.list();
        const year = new Date().getFullYear();
        const projectNumbers = projects
          .filter(p => p.number && p.number.startsWith(`P-${year}`))
          .map(p => {
            const match = p.number.match(/P-\d{4}-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        const nextNumber = projectNumbers.length > 0 ? Math.max(...projectNumbers) + 1 : 1;
        const projectNumber = `P-${year}-${String(nextNumber).padStart(3, '0')}`;

        console.log('Creating project with number:', projectNumber);

        // Create the project
        const project = await base44.entities.Project.create({
          number: projectNumber,
          name: opportunity.name,
          client_id: opportunity.client_id,
          opportunity_id: opportunity.id,
          status: 'Planning',
          contract_value: opportunity.estimated_value || 0,
          start_date: opportunity.project_start_date || null,
          description: opportunity.description || '',
          notes: `Converted from opportunity on ${new Date().toLocaleDateString()}\n\n${opportunity.notes || ''}`,
        });

        console.log('Project created:', project);

        // Update opportunity with project link and new stage
        const updatedOpp = await base44.entities.Opportunity.update(id, {
          stage: 'Under Contract',
          project_id: project.id
        });

        console.log('Opportunity updated:', updatedOpp);

        // Invalidate queries
        await queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        // Show success message and navigate
        setTimeout(() => {
          alert(`✅ Project created successfully!\n\nProject Number: ${projectNumber}\n\nThe opportunity has been moved to Projects.`);
          navigate(createPageUrl(`ProjectDetail?id=${project.id}`));
        }, 100);
        
        return updatedOpp;
      }

      // Normal stage update
      return await base44.entities.Opportunity.update(id, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onError: (error) => {
      console.error('Stage update failed:', error);
      alert(`Failed to update opportunity: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleRowClick = (opportunity) => {
    navigate(createPageUrl(`OpportunityDetail?id=${opportunity.id}`));
  };

  const handleStageChange = (opportunity, newStage, e) => {
    e.stopPropagation(); // Prevent row click navigation
    
    // Confirm if moving to Under Contract
    if (newStage === 'Under Contract') {
      const confirmed = confirm(
        `This will create a new project for "${opportunity.name}" and remove it from the opportunities pipeline.\n\nContinue?`
      );
      if (!confirmed) return;
    }
    
    updateStageMutation.mutate({ 
      id: opportunity.id, 
      stage: newStage,
      opportunityData: opportunity 
    });
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <div className="cursor-pointer hover:opacity-80 transition-opacity">
              <StatusBadge status={row.stage} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white border-gray-300">
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Lead', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Lead" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Qualified', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Qualified" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Bidding', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Bidding" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'No Longer Bidding', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="No Longer Bidding" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Awarded', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Awarded" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Under Contract', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Under Contract" />
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => handleStageChange(row, 'Lost', e)}
              className="cursor-pointer"
            >
              <StatusBadge status="Lost" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="list" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <List className="w-4 h-4 mr-2" />
            Opportunities List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
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
        </TabsContent>

        <TabsContent value="analytics">
          <OpportunityAnalytics opportunities={activeOpportunities} />
        </TabsContent>
      </Tabs>

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