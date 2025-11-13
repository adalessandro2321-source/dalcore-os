
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Trash2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import DocumentViewer from "../components/shared/DocumentViewer";

export default function ChangeOrderDetail() {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [formData, setFormData] = React.useState({});
  const urlParams = new URLSearchParams(window.location.search);
  const changeOrderId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: changeOrder } = useQuery({
    queryKey: ['changeOrder', changeOrderId],
    queryFn: async () => {
      const cos = await base44.entities.ChangeOrder.list();
      return cos.find(co => co.id === changeOrderId);
    },
    enabled: !!changeOrderId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', changeOrder?.project_id],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === changeOrder?.project_id);
    },
    enabled: !!changeOrder?.project_id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', changeOrder?.project_id, changeOrderId],
    queryFn: async () => {
      const docs = await base44.entities.Document.filter({ 
        project_id: changeOrder.project_id,
        linked_entity_type: 'ChangeOrder',
        linked_entity_id: changeOrderId
      });
      return docs;
    },
    enabled: !!changeOrder?.project_id && !!changeOrderId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const previousStatus = changeOrder.status;
      const updatedCO = await base44.entities.ChangeOrder.update(changeOrderId, data);
      
      // If status changed to/from Approved, recalculate budget
      if ((data.status === 'Approved' && previousStatus !== 'Approved') || 
          (data.status !== 'Approved' && previousStatus === 'Approved')) {
        await recalculateProjectBudget(changeOrder.project_id, queryClient);
      }
      
      return updatedCO;
    },
    onSuccess: () => {
      // Invalidate ALL queries to ensure everything updates
      queryClient.invalidateQueries({ queryKey: ['changeOrder', changeOrderId] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', changeOrder.project_id] });
      
      setShowEditModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // If the change order was approved, recalculate budget after deletion
      const wasApproved = changeOrder.status === 'Approved';
      await base44.entities.ChangeOrder.delete(changeOrderId);
      
      if (wasApproved) {
        await recalculateProjectBudget(changeOrder.project_id, queryClient);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      
      navigate(createPageUrl('ChangeOrders'));
    },
  });

  React.useEffect(() => {
    if (changeOrder) {
      setFormData({
        number: changeOrder.number || '',
        reason: changeOrder.reason || '',
        description: changeOrder.description || '',
        cost_impact: changeOrder.cost_impact || 0,
        schedule_impact_days: changeOrder.schedule_impact_days || 0,
        status: changeOrder.status || 'Draft',
        requested_by: changeOrder.requested_by || '',
        notes: changeOrder.notes || ''
      });
    }
  }, [changeOrder]);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!changeOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("ChangeOrders")}>
            <Button variant="outline" size="icon" className="bg-white border-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Change Order {changeOrder.number || `#${changeOrder.id?.slice(0, 8)}`}
            </h2>
            <p className="text-gray-600 mt-1">{project?.name || 'Loading project...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <StatusBadge status={changeOrder.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Change Order Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Reason</p>
                <p className="font-medium text-gray-900">{changeOrder.reason || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Requested By</p>
                <p className="font-medium text-gray-900">{changeOrder.requested_by || '-'}</p>
              </div>
            </div>

            {changeOrder.description && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900">{changeOrder.description}</p>
              </div>
            )}

            {changeOrder.notes && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-gray-900">{changeOrder.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-300">
              <div>
                <p className="text-sm text-gray-600">Cost Impact</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(changeOrder.cost_impact || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Schedule Impact</p>
                <p className="text-2xl font-bold text-gray-900">
                  {changeOrder.schedule_impact_days || 0} days
                </p>
              </div>
            </div>

            {changeOrder.approved_date && (
              <div className="pt-4 border-t border-gray-300">
                <p className="text-sm text-gray-600">Approved Date</p>
                <p className="font-medium text-gray-900">{formatDate(changeOrder.approved_date)}</p>
                {changeOrder.approved_by && (
                  <p className="text-sm text-gray-600 mt-1">By: {changeOrder.approved_by}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Project Impact</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Project</p>
              <Link 
                to={createPageUrl(`ProjectDetail?id=${project?.id}`)}
                className="font-medium text-[#1B4D3E] hover:underline"
              >
                {project?.name || '-'}
              </Link>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-1">Created</p>
              <p className="font-medium text-gray-900">{formatDate(changeOrder.created_date)}</p>
            </div>

            {changeOrder.status === 'Approved' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  ✓ This change order has been approved and is included in the revised contract value
                </p>
              </div>
            )}

            {changeOrder.status === 'Pending' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  ⏳ Pending approval
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {documents.length > 0 && (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-2">
            {documents.map((doc) => (
              <DocumentViewer
                key={doc.id}
                fileUrl={doc.file_url}
                fileName={doc.name}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Change Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Change Order Number</Label>
                <Input
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
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
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem> {/* Added 'Completed' status */}
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Reason</Label>
              <Input
                value={formData.reason || ''}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cost Impact</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_impact || ''}
                  onChange={(e) => setFormData({...formData, cost_impact: parseFloat(e.target.value) || 0})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Schedule Impact (Days)</Label>
                <Input
                  type="number"
                  value={formData.schedule_impact_days || ''}
                  onChange={(e) => setFormData({...formData, schedule_impact_days: parseInt(e.target.value) || 0})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div>
              <Label>Requested By</Label>
              <Input
                value={formData.requested_by || ''}
                onChange={(e) => setFormData({...formData, requested_by: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="border-gray-300 text-gray-700"
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

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Change Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete this change order? This action cannot be undone.
            </p>
            {changeOrder.status === 'Approved' && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                Warning: This is an approved change order. Deleting it will update the project's revised contract value.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Change Order'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
