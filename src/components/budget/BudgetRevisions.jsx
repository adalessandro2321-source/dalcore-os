import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock,
  FileText,
  History,
  Loader2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";

export default function BudgetRevisions({ projectId, lineItems = [], currentTotal }) {
  const [showNewRevision, setShowNewRevision] = React.useState(false);
  const [expandedRevision, setExpandedRevision] = React.useState(null);
  const [pendingChanges, setPendingChanges] = React.useState([]);
  const [revisionReason, setRevisionReason] = React.useState("");
  const [revisionDescription, setRevisionDescription] = React.useState("");
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: revisions = [], isLoading } = useQuery({
    queryKey: ['budgetRevisions', projectId],
    queryFn: () => base44.entities.BudgetRevision.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const createRevisionMutation = useMutation({
    mutationFn: async (data) => {
      // Get next revision number
      const nextNum = revisions.length + 1;
      
      return base44.entities.BudgetRevision.create({
        ...data,
        project_id: projectId,
        revision_number: nextNum,
        requested_by: user?.email,
        status: 'Pending Approval'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetRevisions', projectId] });
      resetForm();
    },
  });

  const updateRevisionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BudgetRevision.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetRevisions', projectId] });
    },
  });

  const applyRevisionMutation = useMutation({
    mutationFn: async (revision) => {
      // Apply line item changes
      for (const change of revision.line_item_changes || []) {
        if (change.line_item_id) {
          await base44.entities.BudgetLineItem.update(change.line_item_id, {
            revised_amount: change.new_amount
          });
        }
      }
      
      // Mark revision as approved
      await base44.entities.BudgetRevision.update(revision.id, {
        status: 'Approved',
        approved_by: user?.email,
        approved_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetRevisions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', projectId] });
    },
  });

  const resetForm = () => {
    setPendingChanges([]);
    setRevisionReason("");
    setRevisionDescription("");
    setShowNewRevision(false);
  };

  const addPendingChange = (lineItem, newAmount) => {
    const existing = pendingChanges.find(c => c.line_item_id === lineItem.id);
    if (existing) {
      setPendingChanges(pendingChanges.map(c => 
        c.line_item_id === lineItem.id 
          ? { ...c, new_amount: newAmount, change_amount: newAmount - (lineItem.revised_amount || lineItem.budgeted_amount || 0) }
          : c
      ));
    } else {
      setPendingChanges([...pendingChanges, {
        line_item_id: lineItem.id,
        category: lineItem.category,
        description: lineItem.description,
        previous_amount: lineItem.revised_amount || lineItem.budgeted_amount || 0,
        new_amount: newAmount,
        change_amount: newAmount - (lineItem.revised_amount || lineItem.budgeted_amount || 0)
      }]);
    }
  };

  const removePendingChange = (lineItemId) => {
    setPendingChanges(pendingChanges.filter(c => c.line_item_id !== lineItemId));
  };

  const submitRevision = () => {
    const previousTotal = lineItems.reduce((sum, i) => sum + (i.revised_amount || i.budgeted_amount || 0), 0);
    const changeTotal = pendingChanges.reduce((sum, c) => sum + c.change_amount, 0);
    const newTotal = previousTotal + changeTotal;

    createRevisionMutation.mutate({
      reason: revisionReason,
      description: revisionDescription,
      previous_total: previousTotal,
      new_total: newTotal,
      change_amount: changeTotal,
      line_item_changes: pendingChanges
    });
  };

  const handleApprove = (revision) => {
    applyRevisionMutation.mutate(revision);
  };

  const handleReject = (revision, reason) => {
    updateRevisionMutation.mutate({
      id: revision.id,
      data: {
        status: 'Rejected',
        rejection_reason: reason || 'Rejected by approver'
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'Pending Approval':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const sortedRevisions = [...revisions].sort((a, b) => (b.revision_number || 0) - (a.revision_number || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Budget Revisions</h3>
        </div>
        <Button
          onClick={() => setShowNewRevision(true)}
          className="bg-[#0E351F] hover:bg-[#14503C] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Revision
        </Button>
      </div>

      {/* Revisions List */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : sortedRevisions.length === 0 ? (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No budget revisions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedRevisions.map((revision) => (
            <Card key={revision.id} className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedRevision(expandedRevision === revision.id ? null : revision.id)}
                >
                  <div className="flex items-center gap-4">
                    {expandedRevision === revision.id ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        Revision #{revision.revision_number}: {revision.reason}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(revision.created_date)} by {revision.requested_by}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-semibold ${revision.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {revision.change_amount >= 0 ? '+' : ''}{formatCurrency(revision.change_amount || 0)}
                      </p>
                      <p className="text-xs text-gray-500">
                        New Total: {formatCurrency(revision.new_total || 0)}
                      </p>
                    </div>
                    {getStatusBadge(revision.status)}
                  </div>
                </div>

                {expandedRevision === revision.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {revision.description && (
                      <p className="text-sm text-gray-700 mb-4">{revision.description}</p>
                    )}
                    
                    {revision.line_item_changes?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Line Item Changes:</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {revision.line_item_changes.map((change, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {change.category}: {change.description}
                              </span>
                              <span className={change.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(change.previous_amount)} → {formatCurrency(change.new_amount)}
                                ({change.change_amount >= 0 ? '+' : ''}{formatCurrency(change.change_amount)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {revision.status === 'Pending Approval' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove(revision)}
                          disabled={applyRevisionMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve & Apply
                        </Button>
                        <Button
                          onClick={() => handleReject(revision)}
                          variant="outline"
                          className="border-red-300 text-red-600"
                          size="sm"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {revision.status === 'Approved' && revision.approved_by && (
                      <p className="text-xs text-green-600">
                        Approved by {revision.approved_by} on {formatDate(revision.approved_date)}
                      </p>
                    )}

                    {revision.status === 'Rejected' && revision.rejection_reason && (
                      <p className="text-xs text-red-600">
                        Rejected: {revision.rejection_reason}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Revision Modal */}
      <Dialog open={showNewRevision} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Budget Revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Revision *</Label>
              <Input
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g., Scope change, Material cost increase, etc."
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={revisionDescription}
                onChange={(e) => setRevisionDescription(e.target.value)}
                placeholder="Detailed explanation of the budget changes..."
                rows={2}
              />
            </div>

            <div>
              <Label className="mb-2 block">Select Line Items to Revise</Label>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {lineItems.length === 0 ? (
                  <p className="p-4 text-center text-gray-500 text-sm">
                    No line items available. Add budget line items first.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Current</th>
                        <th className="text-right p-2">New Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => {
                        const pending = pendingChanges.find(c => c.line_item_id === item.id);
                        return (
                          <tr key={item.id} className="border-t border-gray-100">
                            <td className="p-2 text-gray-600">{item.category}</td>
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">
                              {formatCurrency(item.revised_amount || item.budgeted_amount || 0)}
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="w-28 text-right ml-auto"
                                placeholder="New amount"
                                value={pending?.new_amount ?? ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    addPendingChange(item, val);
                                  } else if (e.target.value === '') {
                                    removePendingChange(item.id);
                                  }
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {pendingChanges.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="font-medium text-blue-900 mb-2">Revision Summary</p>
                  <div className="space-y-1 text-sm">
                    {pendingChanges.map((change, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{change.description}</span>
                        <span className={change.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {change.change_amount >= 0 ? '+' : ''}{formatCurrency(change.change_amount)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-blue-200 font-semibold flex justify-between">
                      <span>Total Change</span>
                      <span className={pendingChanges.reduce((s, c) => s + c.change_amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {pendingChanges.reduce((s, c) => s + c.change_amount, 0) >= 0 ? '+' : ''}
                        {formatCurrency(pendingChanges.reduce((s, c) => s + c.change_amount, 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button 
              onClick={submitRevision}
              disabled={!revisionReason || pendingChanges.length === 0 || createRevisionMutation.isPending}
              className="bg-[#0E351F] hover:bg-[#14503C] text-white"
            >
              {createRevisionMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}