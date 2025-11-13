
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, CheckCircle, Clock, DollarSign, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatCurrency, dateInputToISO, isoToDateInput } from "../shared/DateFormatter";
import { format } from "date-fns";
import StatusBadge from "../shared/StatusBadge";

export default function PerformanceObligationsTab() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingObligation, setEditingObligation] = React.useState(null);
  const [selectedProject, setSelectedProject] = React.useState('all');
  const [isRecalculating, setIsRecalculating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    percentage_of_contract: 0,
    status: 'Not Started'
  });

  const queryClient = useQueryClient();

  const { data: obligations = [] } = useQuery({
    queryKey: ['performanceObligations'],
    queryFn: () => base44.entities.PerformanceObligation.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders'],
    queryFn: () => base44.entities.ChangeOrder.list(),
  });

  // Calculate revised contract value for a project (original + approved COs)
  const getRevisedContractValue = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 0;
    
    const approvedCOs = changeOrders.filter(co => 
      co.project_id === projectId && co.status === 'Approved'
    );
    const approvedCOValue = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
    
    return (project.contract_value || 0) + approvedCOValue;
  };

  // Check if any obligations need recalculation
  const needsRecalculation = React.useMemo(() => {
    return obligations.some(obl => {
      const revisedValue = getRevisedContractValue(obl.project_id);
      const expectedAllocatedValue = (revisedValue * obl.percentage_of_contract) / 100;
      // Check if allocated value differs by more than $0.01 to account for float precision
      return Math.abs((obl.allocated_value || 0) - expectedAllocatedValue) > 0.01;
    });
  }, [obligations, projects, changeOrders]);

  const recalculateAllAllocatedValues = async () => {
    if (!confirm('Recalculate all performance obligation allocated values based on current contract values (including approved change orders)? This cannot be undone.')) {
      return;
    }

    setIsRecalculating(true);
    try {
      const updates = [];
      const updatedProjectIds = new Set();
      
      for (const obl of obligations) {
        const revisedValue = getRevisedContractValue(obl.project_id);
        const newAllocatedValue = (revisedValue * obl.percentage_of_contract) / 100;
        
        // Only update if value has changed significantly
        if (Math.abs((obl.allocated_value || 0) - newAllocatedValue) > 0.01) {
          updates.push(
            base44.entities.PerformanceObligation.update(obl.id, {
              allocated_value: newAllocatedValue // Only update the allocated_value
            })
          );
          updatedProjectIds.add(obl.project_id);
        }
      }

      await Promise.all(updates);
      
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      updatedProjectIds.forEach(projectId => {
        queryClient.invalidateQueries({ queryKey: ['performanceObligations', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] }); // Invalidate project budgets as they depend on these values
      
      if (updates.length > 0) {
        alert(`Successfully recalculated ${updates.length} performance obligations!`);
      } else {
        alert('All performance obligations were already up to date. No recalculations needed.');
      }
    } catch (error) {
      console.error('Error recalculating allocated values:', error);
      alert('Error recalculating allocated values. Please try again.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => {
      const revisedContractValue = getRevisedContractValue(data.project_id);
      const allocatedValue = (revisedContractValue * data.percentage_of_contract) / 100;
      
      return base44.entities.PerformanceObligation.create({
        ...data,
        percentage_of_contract: parseFloat(data.percentage_of_contract),
        allocated_value: allocatedValue,
        estimated_completion_date: dateInputToISO(data.estimated_completion_date),
        completion_date: dateInputToISO(data.completion_date)
      });
    },
    onSuccess: (newObligation) => {
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      queryClient.invalidateQueries({ queryKey: ['performanceObligations', newObligation.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', newObligation.project_id] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const revisedContractValue = getRevisedContractValue(data.project_id);
      const allocatedValue = (revisedContractValue * data.percentage_of_contract) / 100;
      
      return base44.entities.PerformanceObligation.update(id, {
        ...data,
        percentage_of_contract: parseFloat(data.percentage_of_contract),
        allocated_value: allocatedValue,
        estimated_completion_date: dateInputToISO(data.estimated_completion_date),
        completion_date: dateInputToISO(data.completion_date)
      });
    },
    onSuccess: (updatedObligation) => {
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      queryClient.invalidateQueries({ queryKey: ['performanceObligations', updatedObligation.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', updatedObligation.project_id] });
      setShowAddModal(false);
      setEditingObligation(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PerformanceObligation.delete(id),
    onSuccess: (_, deletedId) => {
      // Find the deleted obligation's project_id from the cache before invalidating
      const deletedObligation = obligations.find(o => o.id === deletedId);
      
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      if (deletedObligation?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['performanceObligations', deletedObligation.project_id] });
        queryClient.invalidateQueries({ queryKey: ['projectBudget', deletedObligation.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      percentage_of_contract: 0,
      status: 'Not Started',
      project_id: selectedProject === 'all' ? '' : selectedProject, // Pre-select project if one is filtered
      estimated_completion_date: '',
      completion_date: '',
      notes: ''
    });
  };

  const handleEdit = (obligation) => {
    setEditingObligation(obligation);
    setFormData({
      project_id: obligation.project_id,
      name: obligation.name,
      description: obligation.description || '',
      percentage_of_contract: obligation.percentage_of_contract,
      status: obligation.status,
      estimated_completion_date: isoToDateInput(obligation.estimated_completion_date),
      completion_date: isoToDateInput(obligation.completion_date),
      notes: obligation.notes || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this performance obligation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingObligation) {
      updateMutation.mutate({ id: editingObligation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredObligations = selectedProject === 'all' 
    ? obligations 
    : obligations.filter(o => o.project_id === selectedProject);

  const obligationsByProject = filteredObligations.reduce((acc, o) => {
    if (!acc[o.project_id]) {
      acc[o.project_id] = [];
    }
    acc[o.project_id].push(o);
    return acc;
  }, {});

  const totalAllocated = filteredObligations.reduce((sum, o) => sum + (o.allocated_value || 0), 0);
  
  // Revenue Recognized = Completed obligations only
  const completedValue = filteredObligations
    .filter(o => o.status === 'Completed')
    .reduce((sum, o) => sum + (o.allocated_value || 0), 0);
  
  // Pending Recognition = Not Started + In Progress obligations
  const pendingValue = filteredObligations
    .filter(o => ['Not Started', 'In Progress'].includes(o.status))
    .reduce((sum, o) => sum + (o.allocated_value || 0), 0);
    
  const completedCount = filteredObligations.filter(o => o.status === 'Completed').length;
  const pendingCount = filteredObligations.filter(o => ['Not Started', 'In Progress'].includes(o.status)).length;

  return (
    <div className="space-y-6">
      {/* Recalculation Alert */}
      {needsRecalculation && (
        <Card className="bg-blue-50 border-blue-300">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-blue-900 mb-1">
                  💡 Allocated Values Need Update
                </p>
                <p className="text-sm text-blue-800">
                  Some performance obligations have allocated values that don't match the current contract values (including approved change orders). Recalculate to update them.
                </p>
              </div>
              <Button
                onClick={recalculateAllAllocatedValues}
                disabled={isRecalculating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalculate All'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64 bg-white border-gray-300">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setEditingObligation(null);
            setShowAddModal(true);
          }}
          className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Obligation
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Allocated Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAllocated)}</p>
                <p className="text-xs text-gray-600 mt-1">{filteredObligations.length} total obligations</p>
              </div>
              <DollarSign className="w-8 h-8 text-[#0E351F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Revenue Recognized</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(completedValue)}</p>
                <p className="text-xs text-gray-600 mt-1">{completedCount} completed</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Recognition</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(pendingValue)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {pendingCount} obligations pending
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.entries(obligationsByProject).map(([projectId, projectObligations]) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return null;

        const revisedContractValue = getRevisedContractValue(projectId);
        const approvedCOs = changeOrders.filter(co => 
          co.project_id === projectId && co.status === 'Approved'
        );
        const approvedCOValue = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
        
        const totalPercentage = projectObligations.reduce((sum, o) => sum + (o.percentage_of_contract || 0), 0);
        const projectTotal = projectObligations.reduce((sum, o) => sum + (o.allocated_value || 0), 0);
        
        // Project-level metrics
        const projectCompleted = projectObligations
          .filter(o => o.status === 'Completed')
          .reduce((sum, o) => sum + (o.allocated_value || 0), 0);
        
        const projectPending = projectObligations
          .filter(o => ['Not Started', 'In Progress'].includes(o.status))
          .reduce((sum, o) => sum + (o.allocated_value || 0), 0);

        return (
          <Card key={projectId} className="bg-white border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Original Contract: {formatCurrency(project.contract_value || 0)}
                    {approvedCOValue !== 0 && (
                      <span className="text-blue-600"> + {formatCurrency(approvedCOValue)} COs</span>
                    )}
                    <span className="font-semibold text-gray-900"> = {formatCurrency(revisedContractValue)} Revised</span>
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-sm text-gray-600">
                      Allocated: {totalPercentage.toFixed(1)}% ({formatCurrency(projectTotal)})
                    </p>
                    <p className="text-sm text-green-600">
                      Recognized: {formatCurrency(projectCompleted)}
                    </p>
                    <p className="text-sm text-orange-600">
                      Pending: {formatCurrency(projectPending)}
                    </p>
                  </div>
                </div>
                {totalPercentage > 100 && (
                  <span className="text-sm text-red-600 font-medium">
                    ⚠️ Over-allocated by {(totalPercentage - 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F4F3] border-b border-gray-300">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Obligation</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">% of Contract</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Allocated Value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Estimated Complete</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actual Complete</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projectObligations.map((obligation) => {
                      const isPending = ['Not Started', 'In Progress'].includes(obligation.status);
                      const isCompleted = obligation.status === 'Completed';
                      
                      return (
                        <tr key={obligation.id} className={`hover:bg-gray-50 ${isPending ? 'bg-orange-50' : isCompleted ? 'bg-green-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{obligation.name}</p>
                            {obligation.description && (
                              <p className="text-xs text-gray-600">{obligation.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900">
                            {obligation.percentage_of_contract.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatCurrency(obligation.allocated_value)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={obligation.status} />
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900">
                            {obligation.estimated_completion_date ? formatDate(obligation.estimated_completion_date) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-900">
                            {obligation.completion_date ? formatDate(obligation.completion_date) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(obligation)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(obligation.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredObligations.length === 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center text-gray-500">
            <p>No performance obligations yet. Click "Add Obligation" to create one.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingObligation ? 'Edit' : 'Add'} Performance Obligation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Project <span className="text-red-600">*</span></Label>
              <Select
                required
                value={formData.project_id || ''}
                onValueChange={(value) => setFormData({...formData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-[#C9C8AF]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#C9C8AF]">
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Obligation Name <span className="text-red-600">*</span></Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                placeholder="e.g., Foundation Work, Framing, MEP Installation"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Percentage of Contract <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={formData.percentage_of_contract}
                  onChange={(e) => setFormData({...formData, percentage_of_contract: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                  placeholder="25.0"
                />
                <p className="text-xs text-gray-600 mt-1">
                  {formData.project_id && formData.percentage_of_contract ? (
                    <>Allocated value: {formatCurrency((getRevisedContractValue(formData.project_id)) * formData.percentage_of_contract / 100)}</>
                  ) : 'Select project to see allocated value'}
                </p>
              </div>
              <div>
                <Label>Status <span className="text-red-600">*</span></Label>
                <Select
                  required
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#C9C8AF]">
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estimated Completion Date</Label>
                <Input
                  type="date"
                  value={formData.estimated_completion_date || ''}
                  onChange={(e) => setFormData({...formData, estimated_completion_date: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                />
              </div>
              <div>
                <Label>Actual Completion Date</Label>
                <Input
                  type="date"
                  value={formData.completion_date || ''}
                  onChange={(e) => setFormData({...formData, completion_date: e.target.value})}
                  className="bg-white border-[#C9C8AF]"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-[#C9C8AF]"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingObligation(null);
                  resetForm();
                }}
                className="border-[#C9C8AF]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingObligation ? 'Update' : 'Create'} Obligation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
