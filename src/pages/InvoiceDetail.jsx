
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "../components/shared/StatusBadge";
import { ArrowLeft, Send, DollarSign, Ban, Trash2, Edit, CheckCircle, Loader2, Upload } from "lucide-react";
import { format } from "date-fns";
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import { formatDate, formatDateTime, formatCurrency, dateInputToISO, isoToDateInput } from "../components/shared/DateFormatter";
import DocumentViewer from "../components/shared/DocumentViewer";

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editData, setEditData] = React.useState({});
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [paymentData, setPaymentData] = React.useState({
    amount: 0,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'Check'
  });

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');
  const returnTo = urlParams.get('returnTo');
  const returnProjectId = urlParams.get('projectId');
  const queryClient = useQueryClient();

  const { data: invoice } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const invoices = await base44.entities.Invoice.list();
      return invoices.find(i => i.id === invoiceId);
    },
    enabled: !!invoiceId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', invoice?.project_id],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === invoice?.project_id);
    },
    enabled: !!invoice?.project_id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', invoice?.client_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === invoice?.client_id);
    },
    enabled: !!invoice?.client_id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: async () => {
      const allPayments = await base44.entities.Payment.list('-payment_date');
      return allPayments.filter(p => p.applies_to_id === invoiceId && p.applies_to_type === 'Invoice');
    },
    enabled: !!invoiceId,
  });

  // New queries for edit modal dropdowns
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Initialize edit data when invoice loads
  React.useEffect(() => {
    if (invoice) {
      setEditData({
        number: invoice.number || '',
        project_id: invoice.project_id || '',
        client_id: invoice.client_id || '',
        period_start: isoToDateInput(invoice.period_start),
        period_end: isoToDateInput(invoice.period_end),
        subtotal: invoice.subtotal || 0,
        tax_amount: invoice.tax_amount || 0,
        retention_amount: invoice.retention_amount || 0,
        total: invoice.total || 0,
        due_date: isoToDateInput(invoice.due_date),
        notes: invoice.notes || '',
        line_items: invoice.line_items || [],
        attachments: invoice.attachments || []
      });
    }
  }, [invoice]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditData((prevEditData) => ({
        ...prevEditData,
        attachments: [...(prevEditData.attachments || []), file_url]
      }));
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      // Clear the file input after upload attempt
      e.target.value = null;
    }
  };

  const handleRemoveAttachment = (index) => {
    setEditData((prevEditData) => ({
      ...prevEditData,
      attachments: prevEditData.attachments.filter((_, i) => i !== index)
    }));
  };

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      // Temporarily store the old project ID if it changes
      const oldProjectId = invoice.project_id;
      await base44.entities.Invoice.update(invoiceId, {
        ...data,
        period_start: dateInputToISO(data.period_start),
        period_end: dateInputToISO(data.period_end),
        due_date: dateInputToISO(data.due_date),
      });

      // Update linked document if it exists
      const linkedDocs = await base44.entities.Document.filter({
        linked_entity_type: 'Invoice',
        linked_entity_id: invoiceId
      });
      
      if (linkedDocs && linkedDocs[0]) {
        await base44.entities.Document.update(linkedDocs[0].id, {
          name: `Invoice ${data.number || invoiceId}`,
          description: `Invoice - ${formatCurrency(data.total || 0)}`
        });
      }
      
      // Recalculate for the new project_id
      await recalculateProjectBudget(data.project_id, queryClient);
      // If project_id changed, recalculate for the old project_id too
      if (oldProjectId && oldProjectId !== data.project_id) {
        await recalculateProjectBudget(oldProjectId, queryClient);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); 
      queryClient.invalidateQueries({ queryKey: ['payments'] }); 
      // Invalidate specific project budget query for both old and new project IDs
      if (invoice?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['projectBudget', invoice.project_id] });
        queryClient.invalidateQueries({ queryKey: ['documents', invoice.project_id] });
      }
      if (variables.project_id) { // Invalidate for the new project_id
        queryClient.invalidateQueries({ queryKey: ['projectBudget', variables.project_id] });
        queryClient.invalidateQueries({ queryKey: ['documents', variables.project_id] });
      }
      setShowEditModal(false);
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Invoice.update(invoiceId, {
        status: 'Sent',
        sent_at: new Date().toISOString(),
        balance_open: invoice.total
      });

      // Recalculate project budget
      await recalculateProjectBudget(invoice.project_id, queryClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', invoice.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); 
    },
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Invoice.update(invoiceId, {
        status: 'Void'
      });

      // Recalculate project budget
      await recalculateProjectBudget(invoice.project_id, queryClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', invoice.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); 
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const oldProjectId = invoice?.project_id; // Capture project_id before deletion
      await base44.entities.Invoice.delete(invoiceId);

      // After deletion, recalculate the budget for the affected project
      if (oldProjectId) {
        await recalculateProjectBudget(oldProjectId, queryClient);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget'] }); // Invalidate all project budgets generally
      queryClient.invalidateQueries({ queryKey: ['projects'] }); 
      queryClient.invalidateQueries({ queryKey: ['payments'] }); 
      navigate(createPageUrl('BillsInvoices'));
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data) => {
      // Create the payment record
      const payment = await base44.entities.Payment.create({
        project_id: invoice.project_id,
        type: 'Incoming',
        amount: parseFloat(data.amount),
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        reference_number: data.reference_number,
        applies_to_type: 'Invoice',
        applies_to_id: invoiceId,
        applied_amount: parseFloat(data.amount),
        notes: data.notes
      });

      // Calculate the new balance and status
      const totalPaid = payments.reduce((sum, p) => sum + (p.applied_amount || 0), 0) + parseFloat(data.amount);
      const newBalance = (invoice.total || 0) - totalPaid;
      const newStatus = newBalance <= 0.01 ? 'Paid' : 'Partial'; // Use small epsilon for floating point comparison

      // Update the invoice
      await base44.entities.Invoice.update(invoiceId, {
        balance_open: Math.max(0, newBalance),
        status: newStatus,
        ...(newStatus === 'Paid' && { paid_at: new Date().toISOString() })
      });

      // Recalculate project budget
      await recalculateProjectBudget(invoice.project_id, queryClient);

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', invoice.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowPaymentModal(false);
      setPaymentData({
        amount: 0,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: 'Check',
        reference_number: '',
        notes: ''
      });
    },
  });

  const handleRecordPayment = (e) => {
    e.preventDefault();
    recordPaymentMutation.mutate(paymentData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(editData);
  };

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading invoice...</p>
      </div>
    );
  }

  const handleBack = () => {
    if (returnTo === 'project' && returnProjectId) {
      navigate(createPageUrl(`ProjectDetail?id=${returnProjectId}`));
    } else {
      navigate(createPageUrl('BillsInvoices'));
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.applied_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-white border-gray-300"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invoice {invoice.number}</h2>
            <p className="text-gray-600 mt-1">{project?.name || 'Unknown Project'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="border-gray-300 text-gray-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Invoice
          </Button>
          {invoice.status === 'Draft' && (
            <Button
              onClick={() => markSentMutation.mutate()}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
              disabled={markSentMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Mark as Sent
            </Button>
          )}
          {['Sent', 'Partial'].includes(invoice.status) && (
            <Button
              onClick={() => {
                setPaymentData({
                  amount: invoice.balance_open || 0,
                  payment_date: format(new Date(), 'yyyy-MM-dd'),
                  payment_method: 'Check',
                  reference_number: '',
                  notes: ''
                });
                setShowPaymentModal(true);
              }}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
          {invoice.status !== 'Void' && invoice.status !== 'Paid' && (
            <Button
              onClick={() => voidMutation.mutate()}
              variant="outline"
              className="border-gray-300 text-gray-700"
              disabled={voidMutation.isPending}
            >
              <Ban className="w-4 h-4 mr-2" />
              Void
            </Button>
          )}
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
            <p className="text-xs text-gray-600 mt-1">
              Due: {formatDate(invoice.due_date)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
            <p className="text-2xl font-bold text-[#1B4D3E]">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-600 mt-1">
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Balance Open</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(invoice.balance_open)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <StatusBadge status={invoice.status} />
            {invoice.sent_at && (
              <p className="text-xs text-gray-600 mt-2">
                Sent: {formatDate(invoice.sent_at)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details */}
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="font-medium text-gray-900">{client?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Project</p>
              <p className="font-medium text-gray-900">{project?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Billing Period</p>
              <p className="font-medium text-gray-900">
                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-medium text-gray-900">{formatDate(invoice.due_date)}</p>
            </div>
          </div>

          {invoice.notes && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Notes</p>
              <p className="text-sm text-gray-900">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <Button
              onClick={() => {
                setPaymentData({
                  amount: invoice.balance_open || 0,
                  payment_date: format(new Date(), 'yyyy-MM-dd'),
                  payment_method: 'Check',
                  reference_number: '',
                  notes: ''
                });
                setShowPaymentModal(true);
              }}
              disabled={invoice.balance_open <= 0}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              No payments recorded yet
            </div>
          ) : (
            <div className="divide-y divide-gray-300">
              {payments.map((payment) => (
                <div key={payment.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{formatCurrency(payment.applied_amount)}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(payment.payment_date)} • {payment.payment_method}
                      {payment.reference_number && ` • ${payment.reference_number}`}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#1B4D3E]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      {invoice.line_items && invoice.line_items.length > 0 && (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-200 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Rate</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {invoice.line_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#EBEAE8]">
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(item.rate || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachments for viewing */}
      {(invoice.attachments && invoice.attachments.length > 0) && (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {invoice.attachments.map((url, index) => (
              <DocumentViewer
                key={index}
                fileUrl={url}
                fileName={`Invoice ${invoice.number} - Attachment ${index + 1}`}
                showDelete={false}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading">Edit Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={editData.number || ''}
                  onChange={(e) => setEditData({...editData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div>
              <Label>Project <span className="text-red-600">*</span></Label>
              <Select
                value={editData.project_id || ''}
                onValueChange={(value) => setEditData({...editData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name} ({proj.number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Client <span className="text-red-600">*</span></Label>
              <Select
                value={editData.client_id || ''}
                onValueChange={(value) => setEditData({...editData, client_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select a client" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={editData.period_start || ''}
                  onChange={(e) => setEditData({...editData, period_start: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={editData.period_end || ''}
                  onChange={(e) => setEditData({...editData, period_end: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subtotal <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={editData.subtotal || ''}
                  onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0;
                    const total = subtotal + (editData.tax_amount || 0) - (editData.retention_amount || 0);
                    setEditData({...editData, subtotal, total});
                  }}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Tax Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.tax_amount || ''}
                  onChange={(e) => {
                    const tax_amount = parseFloat(e.target.value) || 0;
                    const total = (editData.subtotal || 0) + tax_amount - (editData.retention_amount || 0);
                    setEditData({...editData, tax_amount, total});
                  }}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Retention Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.retention_amount || ''}
                  onChange={(e) => {
                    const retention_amount = parseFloat(e.target.value) || 0;
                    const total = (editData.subtotal || 0) + (editData.tax_amount || 0) - retention_amount;
                    setEditData({...editData, retention_amount, total});
                  }}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Total Due</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.total || ''}
                  readOnly
                  className="bg-gray-100 border-gray-300 text-gray-900"
                />
              </div>
            </div>

            {/* Attachments Section */}
            <Card className="bg-white border-[#C9C8AF]">
              <CardHeader>
                <CardTitle className="text-lg heading">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editData.attachments && editData.attachments.length > 0 ? (
                  editData.attachments.map((url, index) => (
                    <DocumentViewer
                      key={index}
                      fileUrl={url}
                      fileName={`Attachment ${index + 1}`}
                      showDelete={true}
                      onDelete={() => handleRemoveAttachment(index)}
                    />
                  ))
                ) : (
                  <p className="text-sm" style={{ color: '#5A7765' }}>No attachments yet</p>
                )}

                <div>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="invoice-file-upload"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />
                  <label htmlFor="invoice-file-upload">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-[#C9C8AF] rounded-md transition-colors cursor-pointer ${
                        uploadingFile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E8E7DD]'
                      }`}
                      style={{ color: '#5A7765' }}
                    >
                      {uploadingFile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="text-sm">Add Attachment</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editData.notes || ''}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                className="bg-white border-[#C9C8AF] text-[#181E18]"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="border-[#C9C8AF]"
                style={{ color: '#5A7765' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-white"
                style={{ backgroundColor: '#0E351F' }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <Label>Payment Amount <span className="text-red-600">*</span></Label>
              <Input
                type="number"
                step="0.01"
                required
                value={paymentData.amount || ''}
                onChange={(e) => setPaymentData({...paymentData, amount: parseFloat(e.target.value)})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-600 mt-1">
                Balance due: {formatCurrency(invoice.balance_open || 0)}
              </p>
            </div>

            <div>
              <Label>Payment Date <span className="text-red-600">*</span></Label>
              <Input
                type="date"
                required
                value={paymentData.payment_date || ''}
                onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select
                value={paymentData.payment_method || 'Check'}
                onValueChange={(value) => setPaymentData({...paymentData, payment_method: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Wire">Wire Transfer</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Number</Label>
              <Input
                value={paymentData.reference_number || ''}
                onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Check #, Transaction ID, etc."
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={paymentData.notes || ''}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete invoice <span className="font-semibold text-gray-900">{invoice.number}</span>?
            </p>
            <p className="text-sm text-red-600">
              This will also delete all associated payments. This action cannot be undone.
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
                onClick={() => deleteMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
