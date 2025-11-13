
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
import { ArrowLeft, CheckCircle, DollarSign, Ban, Trash2, Edit, Loader2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

// Import the centralized budget recalculation function
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import { formatDate, formatDateTime, formatCurrency, dateInputToISO, isoToDateInput } from "../components/shared/DateFormatter";
import DocumentViewer from "../components/shared/DocumentViewer";

export default function BillDetail() {
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
  const billId = urlParams.get('id');
  const returnTo = urlParams.get('returnTo');
  const returnProjectId = urlParams.get('projectId');
  const queryClient = useQueryClient();

  const { data: bill } = useQuery({
    queryKey: ['bill', billId],
    queryFn: async () => {
      const bills = await base44.entities.Bill.list();
      return bills.find(b => b.id === billId);
    },
    enabled: !!billId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', bill?.project_id],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      return projects.find(p => p.id === bill?.project_id);
    },
    enabled: !!bill?.project_id,
  });

  const { data: vendor } = useQuery({
    queryKey: ['vendor', bill?.vendor_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies.find(c => c.id === bill?.vendor_id);
    },
    enabled: !!bill?.vendor_id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', billId],
    queryFn: async () => {
      const allPayments = await base44.entities.Payment.list('-payment_date');
      return allPayments.filter(p => p.applies_to_id === billId && p.applies_to_type === 'Bill');
    },
    enabled: !!billId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Initialize edit data when bill loads
  React.useEffect(() => {
    if (bill) {
      setEditData({
        number: bill.number || '',
        project_id: bill.project_id || '',
        vendor_id: bill.vendor_id || '',
        amount: bill.amount || 0,
        due_date: isoToDateInput(bill.due_date),
        category: bill.category || '',
        notes: bill.notes || '',
        attachments: bill.attachments || []
      });
    }
  }, [bill]);

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
      alert('Failed to upload file. Please try again.'); // Added alert for error
    } finally {
      setUploadingFile(false);
      e.target.value = null; // Clear the input so same file can be uploaded again
    }
  };

  const handleRemoveAttachment = (index) => {
    setEditData((prevEditData) => ({
      ...prevEditData,
      attachments: prevEditData.attachments.filter((_, i) => i !== index)
    }));
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Bill.update(billId, {
        status: 'Approved',
        approved_at: new Date().toISOString(),
        balance_open: bill.amount
      });
      
      // Recalculate project budget after approval using the centralized function
      if (bill?.project_id) { // Added null check for safety
        await recalculateProjectBudget(bill.project_id, queryClient); // Pass queryClient
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); // Added for comprehensive dashboard refresh
      queryClient.invalidateQueries({ queryKey: ['payments'] }); // Added for comprehensive dashboard refresh
      if (bill?.project_id) { // Invalidate specific project budget
        queryClient.invalidateQueries({ queryKey: ['projectBudget', bill.project_id] });
      }
    },
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Bill.update(billId, {
        status: 'Void'
      });
      
      // Recalculate project budget after voiding using the centralized function
      if (bill?.project_id) { // Added null check for safety
        await recalculateProjectBudget(bill.project_id, queryClient); // Pass queryClient
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); // Added for comprehensive dashboard refresh
      queryClient.invalidateQueries({ queryKey: ['payments'] }); // Added for comprehensive dashboard refresh
      if (bill?.project_id) { // Invalidate specific project budget
        queryClient.invalidateQueries({ queryKey: ['projectBudget', bill.project_id] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const oldProjectId = bill?.project_id; // Capture project_id before deletion
      await base44.entities.Bill.delete(billId);
      // Recalculate project budget after bill deletion using the centralized function
      if (oldProjectId) {
        await recalculateProjectBudget(oldProjectId, queryClient); // Pass queryClient
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); // Added for comprehensive dashboard refresh
      queryClient.invalidateQueries({ queryKey: ['payments'] }); // Added for comprehensive dashboard refresh
      // The specific project budget invalidation is handled by the recalculateProjectBudget function's effect on the entity.
      // We don't have the projectId readily available here after deletion for a specific query invalidate.
      // The general projectBudgets invalidation should suffice.
      navigate(createPageUrl('BillsInvoices'));
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data) => {
      // Create the payment record
      const payment = await base44.entities.Payment.create({
        project_id: bill.project_id,
        type: 'Outgoing',
        amount: parseFloat(data.amount),
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        reference_number: data.reference_number,
        applies_to_type: 'Bill',
        applies_to_id: billId,
        applied_amount: parseFloat(data.amount),
        notes: data.notes
      });

      // Calculate the new balance and status
      const totalPaid = payments.reduce((sum, p) => sum + (p.applied_amount || 0), 0) + parseFloat(data.amount);
      const newBalance = (bill.amount || 0) - totalPaid;
      const newStatus = newBalance <= 0.01 ? 'Paid' : 'Partial'; // Use small epsilon for floating point

      // Update the bill
      await base44.entities.Bill.update(billId, {
        balance_open: Math.max(0, newBalance),
        status: newStatus,
        ...(newStatus === 'Paid' && { paid_at: new Date().toISOString() })
      });

      // Recalculate project budget after payment using the centralized function
      if (bill?.project_id) {
        await recalculateProjectBudget(bill.project_id, queryClient);
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['payments', billId] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); // Added for comprehensive dashboard refresh
      if (bill?.project_id) { // Invalidate specific project budget
        queryClient.invalidateQueries({ queryKey: ['projectBudget', bill.project_id] });
      }
      setShowPaymentModal(false);
      setPaymentData({
        amount: 0,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: 'Check'
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const oldProjectId = bill.project_id; // Using bill from component state as per outline
      
      // Update the bill with new data, ensuring due_date is ISO string
      await base44.entities.Bill.update(billId, {
        ...data,
        due_date: dateInputToISO(data.due_date),
        amount: parseFloat(data.amount)
      });
      
      // Update linked document if it exists
      const linkedDocs = await base44.entities.Document.filter({
        linked_entity_type: 'Bill',
        linked_entity_id: billId
      });
      
      if (linkedDocs && linkedDocs[0]) {
        await base44.entities.Document.update(linkedDocs[0].id, {
          name: `Bill ${data.number || billId}`,
          description: `Bill - ${formatCurrency(data.amount || 0)}`
        });
      }

      // Recalculate project budget for the current/new project
      await recalculateProjectBudget(data.project_id, queryClient); // Pass queryClient
      
      // If project_id changed, recalculate for the old project as well
      if (oldProjectId && oldProjectId !== data.project_id) {
        await recalculateProjectBudget(oldProjectId, queryClient); // Pass queryClient
      }
    },
    onSuccess: (_, variables) => { // variables here is the 'data' passed to mutationFn
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] }); // Invalidate general documents
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] }); // Added for comprehensive dashboard refresh
      queryClient.invalidateQueries({ queryKey: ['payments'] }); // Added for comprehensive dashboard refresh
      
      // Invalidate old project budget and documents if project_id changed (using 'bill' state which reflects pre-update)
      if (bill?.project_id && bill.project_id !== variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ['projectBudget', bill.project_id] });
        queryClient.invalidateQueries({ queryKey: ['documents', bill.project_id] }); // Invalidate documents for old project
      }
      // Invalidate new project budget and documents (or current if not changed)
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ['projectBudget', variables.project_id] });
        queryClient.invalidateQueries({ queryKey: ['documents', variables.project_id] }); // Invalidate documents for new/current project
      }
      setShowEditModal(false);
    },
  });

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(editData);
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    recordPaymentMutation.mutate(paymentData);
  };

  if (!bill) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading bill...</p>
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
            <h2 className="text-2xl font-bold text-gray-900">Bill {bill.number}</h2>
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
            Edit Bill
          </Button>
          {['Draft', 'Pending'].includes(bill.status) && (
            <Button
              onClick={() => approveMutation.mutate()}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Bill
            </Button>
          )}
          {['Approved', 'Partial'].includes(bill.status) && (
            <Button
              onClick={() => {
                setPaymentData({
                  amount: bill.balance_open || 0,
                  payment_date: format(new Date(), 'yyyy-MM-dd'),
                  payment_method: 'Check'
                });
                setShowPaymentModal(true);
              }}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
          {bill.status !== 'Void' && bill.status !== 'Paid' && (
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
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <StatusBadge status={bill.status} />
        </div>
      </div>

      {/* Bill Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(bill.amount)}</p>
            <p className="text-xs text-gray-600 mt-1">
              Due: {formatDate(bill.due_date)}
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
            <p className={`text-2xl font-bold ${(bill.balance_open || 0) > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
              {formatCurrency(bill.balance_open)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <StatusBadge status={bill.status} />
            {bill.approved_at && (
              <p className="text-xs text-gray-600 mt-2">
                Approved: {formatDate(bill.approved_at)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bill Details */}
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <CardTitle>Bill Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Vendor</p>
              <p className="font-medium text-gray-900">{vendor?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Project</p>
              <p className="font-medium text-gray-900">{project?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Category</p>
              <p className="font-medium text-gray-900">{bill.category || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-medium text-gray-900">{formatDate(bill.due_date)}</p>
            </div>
          </div>

          {bill.notes && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Notes</p>
              <p className="text-sm text-gray-900">{bill.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments for viewing */}
      {(bill.attachments && bill.attachments.length > 0) && (
        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle className="heading">Attachments</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {bill.attachments.map((url, index) => (
              <DocumentViewer
                key={index}
                fileUrl={url}
                fileName={`Bill ${bill.number} - Attachment ${index + 1}`}
                showDelete={false}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <Button
              onClick={() => {
                setPaymentData({
                  amount: bill.balance_open || 0,
                  payment_date: format(new Date(), 'yyyy-MM-dd'),
                  payment_method: 'Check'
                });
                setShowPaymentModal(true);
              }}
              disabled={bill.balance_open <= 0 || !['Approved', 'Partial'].includes(bill.status)}
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
                    {payment.notes && (
                      <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                    )}
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#1B4D3E]" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading">Edit Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billNumber">Bill Number</Label>
                <Input
                  id="billNumber"
                  value={editData.number || ''}
                  onChange={(e) => setEditData({...editData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label htmlFor="billAmount">Amount <span className="text-red-600">*</span></Label>
                <Input
                  id="billAmount"
                  type="number"
                  step="0.01"
                  required
                  value={editData.amount || ''}
                  onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value)})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="projectSelect">Project <span className="text-red-600">*</span></Label>
              <Select
                value={editData.project_id || ''}
                onValueChange={(value) => setEditData({...editData, project_id: value})}
              >
                <SelectTrigger id="projectSelect" className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
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
              <Label htmlFor="vendorSelect">Vendor <span className="text-red-600">*</span></Label>
              <Select
                value={editData.vendor_id || ''}
                onValueChange={(value) => setEditData({...editData, vendor_id: value})}
              >
                <SelectTrigger id="vendorSelect" className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {companies.filter(c => ['Subcontractor', 'Supplier'].includes(c.type)).map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categorySelect">Category</Label>
              <Select
                value={editData.category || ''}
                onValueChange={(value) => setEditData({...editData, category: value})}
              >
                <SelectTrigger id="categorySelect" className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Materials">Materials</SelectItem>
                  <SelectItem value="Labor">Labor</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={editData.due_date || ''}
                onChange={(e) => setEditData({...editData, due_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
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
                    id="bill-file-upload"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  />
                  <label htmlFor="bill-file-upload">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-[#C9C8AF] rounded-md transition-colors cursor-pointer ${
                        uploadingFile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E8E7DD)'
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
              <Label htmlFor="billNotes">Notes</Label>
              <Textarea
                id="billNotes"
                value={editData.notes || ''}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                className="bg-white border-gray-300 text-gray-900 mt-2"
                rows={3}
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

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">Payment Amount <span className="text-red-600">*</span></Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                required
                value={paymentData.amount || ''}
                onChange={(e) => setPaymentData({...paymentData, amount: parseFloat(e.target.value)})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-600 mt-1">
                Balance due: {formatCurrency(bill.balance_open)}
              </p>
            </div>

            <div>
              <Label htmlFor="paymentDate">Payment Date <span className="text-red-600">*</span></Label>
              <Input
                id="paymentDate"
                type="date"
                required
                value={paymentData.payment_date || ''}
                onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={paymentData.payment_method || 'Check'}
                onValueChange={(value) => setPaymentData({...paymentData, payment_method: value})}
              >
                <SelectTrigger id="paymentMethod" className="bg-white border-gray-300 text-gray-900">
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
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={paymentData.reference_number || ''}
                onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Check #, Transaction ID, etc."
              />
            </div>

            <div>
              <Label htmlFor="paymentNotes">Notes</Label>
              <Input
                id="paymentNotes"
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
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18]">
          <DialogHeader>
            <DialogTitle>Delete Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete bill <span className="font-semibold text-gray-900">{bill.number}</span>?
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Bill'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
