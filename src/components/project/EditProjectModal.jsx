import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EditProjectModal({ project, onClose, onSuccess }) {
  const [formData, setFormData] = React.useState({
    number: project.number || '',
    name: project.name || '',
    client_id: project.client_id || '',
    status: project.status || 'Planning',
    contract_value: project.contract_value || '',
    address: project.address || '',
    city: project.city || '',
    state: project.state || '',
    zip: project.zip || '',
    start_date: project.start_date || '',
    target_completion_date: project.target_completion_date || '',
    description: project.description || '',
    percent_complete: project.percent_complete || 0,
    project_manager: project.project_manager || '',
    superintendent: project.superintendent || '',
    estimate_id: project.estimate_id || '',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['allEstimates'],
    queryFn: () => base44.entities.Estimate.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Project Number</Label>
              <Input
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="P-2024-001"
              />
            </div>
            <div>
              <Label>Project Name</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Downtown Office Tower"
              />
            </div>
          </div>

          <div>
            <Label>Client</Label>
            <Select
              value={formData.client_id}
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
            <Label>Linked Estimate (Baseline)</Label>
            <Select
              value={formData.estimate_id || 'none'}
              onValueChange={(value) => setFormData({...formData, estimate_id: value === 'none' ? '' : value})}
            >
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select estimate" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="none">No estimate linked</SelectItem>
                {estimates.map((est) => (
                  <SelectItem key={est.id} value={est.id}>
                    {est.name} - ${(est.estimated_selling_price || 0).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Link an estimate to use as the cost baseline for budget tracking
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contract Value</Label>
              <Input
                type="number"
                value={formData.contract_value}
                onChange={(e) => setFormData({...formData, contract_value: parseFloat(e.target.value)})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="5000000"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
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
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>ZIP</Label>
              <Input
                value={formData.zip}
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
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Target Completion</Label>
              <Input
                type="date"
                value={formData.target_completion_date}
                onChange={(e) => setFormData({...formData, target_completion_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>% Complete</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.percent_complete}
                onChange={(e) => setFormData({...formData, percent_complete: parseFloat(e.target.value)})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Project Manager</Label>
              <Input
                value={formData.project_manager}
                onChange={(e) => setFormData({...formData, project_manager: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Email or name"
              />
            </div>
          </div>

          <div>
            <Label>Superintendent</Label>
            <Input
              value={formData.superintendent}
              onChange={(e) => setFormData({...formData, superintendent: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
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