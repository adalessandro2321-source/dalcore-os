import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EditOpportunityModal({ opportunity, onClose, onSuccess }) {
  const [formData, setFormData] = React.useState({
    name: opportunity.name || '',
    client_id: opportunity.client_id || '',
    stage: opportunity.stage || 'Lead',
    estimated_value: opportunity.estimated_value || '',
    probability: opportunity.probability || 0,
    bid_due_date: opportunity.bid_due_date || '',
    project_start_date: opportunity.project_start_date || '',
    assigned_to: opportunity.assigned_to || '',
    description: opportunity.description || '',
    notes: opportunity.notes || '',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Submitting opportunity update with data:', data);
      
      // If moving to "Under Contract", create a project
      if (data.stage === 'Under Contract' && opportunity.stage !== 'Under Contract') {
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

        // Create the project
        const project = await base44.entities.Project.create({
          number: projectNumber,
          name: data.name,
          client_id: data.client_id,
          status: 'Planning',
          contract_value: data.estimated_value || 0,
          start_date: data.project_start_date || null,
          description: data.description || '',
          notes: `Converted from opportunity on ${new Date().toLocaleDateString()}\n\n${data.notes || ''}`,
        });

        // Update opportunity with project link
        await base44.entities.Opportunity.update(opportunity.id, {
          ...data,
          project_id: project.id
        });

        // Invalidate and redirect
        await queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        alert(`✅ Project created successfully!\n\nProject Number: ${projectNumber}\n\nRedirecting to project...`);
        
        onSuccess();
        navigate(createPageUrl(`ProjectDetail?id=${project.id}`));
        return project;
      }

      // Normal update
      const updatedOpp = await base44.entities.Opportunity.update(opportunity.id, data);
      console.log('Opportunity updated:', updatedOpp);
      return updatedOpp;
    },
    onSuccess: (result) => {
      console.log('Update successful, result:', result);
      // Only call onSuccess if we didn't create a project (which already called onSuccess)
      if (result && formData.stage !== 'Under Contract') {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error('Update failed:', error);
      alert(`Failed to update opportunity: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    updateMutation.mutate(formData);
  };

  const ownerCompanies = companies.filter(c => c.type === 'Owner');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Opportunity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Opportunity Name <span className="text-red-600">*</span></Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
            />
          </div>

          <div>
            <Label>Client <span className="text-red-600">*</span></Label>
            <Select
              value={formData.client_id || ''}
              onValueChange={(value) => {
                console.log('Client selected:', value);
                setFormData(prev => ({...prev, client_id: value}));
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                {ownerCompanies.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">No clients available</div>
                ) : (
                  ownerCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {ownerCompanies.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">
                No clients found. Create a company with type "Owner" first.
              </p>
            )}
          </div>

          <div>
            <Label>Stage <span className="text-red-600">*</span></Label>
            <Select
              value={formData.stage}
              onValueChange={(value) => setFormData({...formData, stage: value})}
            >
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Qualified">Qualified</SelectItem>
                <SelectItem value="Bidding">Bidding</SelectItem>
                <SelectItem value="Awarded">Awarded</SelectItem>
                <SelectItem value="Under Contract">Under Contract (Creates Project)</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            {formData.stage === 'Under Contract' && opportunity.stage !== 'Under Contract' && (
              <p className="text-xs text-blue-600 mt-1">
                ℹ️ Setting to "Under Contract" will automatically create a new project and remove this from the pipeline
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Estimated Value</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.estimated_value}
                onChange={(e) => setFormData({...formData, estimated_value: parseFloat(e.target.value) || ''})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Probability (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData({...formData, probability: parseFloat(e.target.value) || 0})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bid Due Date</Label>
              <Input
                type="date"
                value={formData.bid_due_date}
                onChange={(e) => setFormData({...formData, bid_due_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Project Start Date</Label>
              <Input
                type="date"
                value={formData.project_start_date}
                onChange={(e) => setFormData({...formData, project_start_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <div>
            <Label>Assigned To</Label>
            <Input
              value={formData.assigned_to}
              onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              placeholder="Email or name"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              rows={3}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}