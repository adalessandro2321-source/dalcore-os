import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatusBadge from "../shared/StatusBadge";
import { formatDate, formatCurrency } from "../shared/DateFormatter";

export default function ChangeOrdersTab({ projectId, project }) {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    reason: '',
    description: '',
    line_items: [],
    schedule_impact_days: 0,
    requested_by: '',
    notes: ''
  });
  const queryClient = useQueryClient();

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: async () => {
      const all = await base44.entities.ChangeOrder.list();
      return all.filter(co => co.project_id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: estimate } = useQuery({
    queryKey: ['estimate', project?.estimate_id],
    queryFn: async () => {
      if (!project?.estimate_id) return null;
      const estimates = await base44.entities.Estimate.list();
      return estimates.find(e => e.id === project.estimate_id);
    },
    enabled: !!project?.estimate_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const subtotal = data.line_items?.reduce((sum, item) => {
        const total = item.total || 0;
        return sum + (item.type === 'Credit' ? -total : total);
      }, 0) || 0;

      const changeOrder = await base44.entities.ChangeOrder.create({
        ...data,
        project_id: projectId,
        estimate_id: project?.estimate_id,
        subtotal,
        cost_impact: subtotal,
        status: 'Draft'
      });

      // Create a linked performance obligation for this change order
      await base44.entities.PerformanceObligation.create({
        project_id: projectId,
        name: `Change Order: ${data.reason}`,
        description: data.description || '',
        allocated_value: subtotal,
        percentage_of_contract: 0,
        status: 'Not Started',
        notes: `Linked to Change Order #${changeOrder.id?.slice(-6)}. ${data.notes || ''}`.trim()
      });

      return changeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      setShowCreateModal(false);
      resetForm();
      toast.success('Change order created successfully');
    },
    onError: (error) => {
      console.error('Failed to create change order:', error);
      toast.error('Failed to create change order: ' + (error?.message || 'Unknown error'));
    },
  });

  const resetForm = () => {
    setFormData({
      reason: '',
      description: '',
      line_items: [],
      schedule_impact_days: 0,
      requested_by: '',
      notes: ''
    });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        {
          type: 'Addition',
          description: '',
          quantity: 1,
          unit_cost: 0,
          material_cost: 0,
          labor_hours: 0,
          total: 0,
          notes: ''
        }
      ]
    });
  };

  const removeLineItem = (index) => {
    const newLineItems = formData.line_items.filter((_, i) => i !== index);
    setFormData({ ...formData, line_items: newLineItems });
  };

  const updateLineItem = (index, field, value) => {
    const newLineItems = [...formData.line_items];
    newLineItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_cost' || field === 'material_cost' || field === 'labor_hours') {
      const item = newLineItems[index];
      const laborRate = estimate?.labor_rate || 0;
      newLineItems[index].total = 
        (item.material_cost || 0) + 
        ((item.labor_hours || 0) * laborRate) + 
        ((item.quantity || 0) * (item.unit_cost || 0));
    }
    
    setFormData({ ...formData, line_items: newLineItems });
  };

  const calculateSubtotal = () => {
    return formData.line_items?.reduce((sum, item) => {
      const total = item.total || 0;
      return sum + (item.type === 'Credit' ? -total : total);
    }, 0) || 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
  const approvedCOValue = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
  const originalValue = project?.contract_value || 0;
  const revisedValue = originalValue + approvedCOValue;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Original Contract</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(originalValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Approved Change Orders</p>
            <p className={`text-2xl font-bold ${approvedCOValue >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
              {approvedCOValue >= 0 ? '+' : ''}{formatCurrency(approvedCOValue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{approvedCOs.length} approved</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Revised Contract Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(revisedValue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <div className="flex items-center justify-between">
            <CardTitle>Change Orders</CardTitle>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Change Order
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {changeOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Change Orders Yet</p>
              <p className="text-sm">Create change orders to track additions or credits to the project scope.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F4F3] border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">CO#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Reason</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Cost Impact</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Created</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {changeOrders.map((co) => (
                    <tr key={co.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">{co.number || `#${co.id.slice(-6)}`}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{co.reason}</p>
                        {co.description && (
                          <p className="text-xs text-gray-600 mt-1">{co.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${(co.cost_impact || 0) >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                          {(co.cost_impact || 0) >= 0 ? '+' : ''}{formatCurrency(co.cost_impact || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={co.status} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {formatDate(co.created_date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link to={createPageUrl(`ChangeOrderDetail?id=${co.id}`)}>
                          <Button size="sm" variant="outline" className="border-gray-300">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Change Order Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading">Add Change Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Reason <span className="text-red-600">*</span></Label>
              <Input
                required
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="bg-white border-gray-300"
                placeholder="e.g., Client requested additional work, Material cost savings"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300"
                rows={2}
                placeholder="Additional details about this change order"
              />
            </div>

            <div className="border-t pt-4 space-y-4" style={{ borderColor: '#C9C8AF' }}>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Line Items</h3>
                <Button
                  type="button"
                  onClick={addLineItem}
                  size="sm"
                  variant="outline"
                  className="border-gray-300"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {formData.line_items.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No line items yet. Add additions (cost increases) or credits (refunds/cost decreases).
                </p>
              )}

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {formData.line_items.map((item, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={item.type}
                            onValueChange={(value) => updateLineItem(idx, 'type', value)}
                          >
                            <SelectTrigger className="bg-white h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Addition">Addition (+)</SelectItem>
                              <SelectItem value="Credit">Credit (-)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        className="bg-white h-9 text-sm"
                        placeholder="e.g., Additional framing, Material credit"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="bg-white h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_cost || ''}
                          onChange={(e) => updateLineItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="bg-white h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Material Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.material_cost || ''}
                          onChange={(e) => updateLineItem(idx, 'material_cost', parseFloat(e.target.value) || 0)}
                          className="bg-white h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Labor Hours</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={item.labor_hours || ''}
                          onChange={(e) => updateLineItem(idx, 'labor_hours', parseFloat(e.target.value) || 0)}
                          className="bg-white h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Notes (Optional)</Label>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateLineItem(idx, 'notes', e.target.value)}
                          className="bg-white h-9 text-sm"
                          placeholder="Additional details"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="flex-1 text-right">
                          <Label className="text-xs text-gray-600">Total</Label>
                          <p className={`text-lg font-bold ${item.type === 'Credit' ? 'text-green-700' : 'text-gray-900'}`}>
                            {item.type === 'Credit' ? '-' : ''}{formatCurrency(item.total || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {formData.line_items.length > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">Total Cost Impact:</span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(calculateSubtotal())}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Schedule Impact (Days)</Label>
                <Input
                  type="number"
                  value={formData.schedule_impact_days || ''}
                  onChange={(e) => setFormData({...formData, schedule_impact_days: parseInt(e.target.value) || 0})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Requested By</Label>
                <Input
                  value={formData.requested_by}
                  onChange={(e) => setFormData({...formData, requested_by: e.target.value})}
                  className="bg-white border-gray-300"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
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
                  resetForm();
                }}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Change Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}