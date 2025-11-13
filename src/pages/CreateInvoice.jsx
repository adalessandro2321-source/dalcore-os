
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import { formatCurrency } from "../components/shared/DateFormatter"; // Imported formatCurrency
import DocumentViewer from "../components/shared/DocumentViewer"; // Imported DocumentViewer
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CreateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadingFile, setUploadingFile] = React.useState(false); // New state for file upload
  const [smartUploading, setSmartUploading] = React.useState(false); // New state for smart upload
  const [hasInitialPayment, setHasInitialPayment] = React.useState(false);
  const [initialPaymentPercent, setInitialPaymentPercent] = React.useState(50);
  
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get('returnTo');
  const returnProjectId = urlParams.get('projectId');

  const [formData, setFormData] = React.useState({
    status: 'Draft',
    line_items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    subtotal: 0,
    tax_amount: 0,
    retention_amount: 0,
    total: 0,
    balance_open: 0,
    period_start: '',
    period_end: '',
    due_date: '',
    attachments: [] // New field for attachments
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate initial payment if applicable
      const initialPaymentAmount = hasInitialPayment && data.status === 'Sent' 
        ? (data.total * initialPaymentPercent / 100) 
        : 0;
      
      const initialBalanceOpen = data.status === 'Sent' 
        ? (data.total - initialPaymentAmount) 
        : data.total;
      
      const initialStatus = data.status === 'Sent' && initialPaymentAmount > 0 && initialBalanceOpen > 0
        ? 'Partial'
        : data.status;

      const invoice = await base44.entities.Invoice.create({
        ...data,
        status: initialStatus,
        balance_open: initialBalanceOpen,
        period_start: data.period_start ? new Date(data.period_start).toISOString() : null,
        period_end: data.period_end ? new Date(data.period_end).toISOString() : null,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
      });

      // Create initial payment if applicable
      if (hasInitialPayment && initialPaymentAmount > 0 && data.status === 'Sent') {
        await base44.entities.Payment.create({
          project_id: data.project_id,
          type: 'Incoming',
          amount: initialPaymentAmount,
          payment_date: new Date().toISOString(),
          payment_method: 'Check',
          applies_to_type: 'Invoice',
          applies_to_id: invoice.id,
          applied_amount: initialPaymentAmount,
          notes: `Initial ${initialPaymentPercent}% payment`
        });
      }

      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          await base44.entities.Document.create({
            name: `Invoice ${data.number || invoice.id} - Attachment`,
            project_id: data.project_id,
            folder: 'Invoices',
            type: 'Invoice',
            file_url: attachment,
            linked_entity_type: 'Invoice',
            linked_entity_id: invoice.id,
            description: `Invoice - ${formatCurrency(data.total || 0)}`
          });
        }
      }

      await recalculateProjectBudget(data.project_id, queryClient);

      return invoice;
    },
    onSuccess: (invoice) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', invoice.project_id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', invoice.project_id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      
      navigate(createPageUrl(`InvoiceDetail?id=${invoice.id}`));
    },
  });

  const calculateTotals = (items, taxAmount, retentionAmount) => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const total = subtotal + (parseFloat(taxAmount) || 0) - (parseFloat(retentionAmount) || 0);
    return { subtotal, total };
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [...formData.line_items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const removeLineItem = (index) => {
    const newItems = formData.line_items.filter((_, i) => i !== index);
    const { subtotal, total } = calculateTotals(newItems, formData.tax_amount, formData.retention_amount);
    setFormData({
      ...formData,
      line_items: newItems,
      subtotal,
      total,
      balance_open: total
    });
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...formData.line_items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = (newItems[index].quantity || 0) * (newItems[index].rate || 0);
    }
    
    const { subtotal, total } = calculateTotals(newItems, formData.tax_amount, formData.retention_amount);
    setFormData({
      ...formData,
      line_items: newItems,
      subtotal,
      total,
      balance_open: total
    });
  };

  // New file upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData((prevFormData) => ({
        ...prevFormData,
        attachments: [...(prevFormData.attachments || []), file_url]
      }));
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      e.target.value = null; // Clear the input field
    }
  };

  const handleSmartUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSmartUploading(true);
    try {
      // First upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Then extract data from it
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            invoice_number: { type: "string" },
            client_name: { type: "string" },
            total_amount: { type: "number" },
            subtotal: { type: "number" },
            tax_amount: { type: "number" },
            due_date: { type: "string" },
            period_start: { type: "string" },
            period_end: { type: "string" },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  rate: { type: "number" },
                  amount: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const data = result.output;
        
        // Find matching client
        let clientId = formData.client_id;
        if (data.client_name) {
          const matchingClient = companies.find(c => 
            c.type === 'Owner' && c.name.toLowerCase().includes(data.client_name.toLowerCase())
          );
          if (matchingClient) clientId = matchingClient.id;
        }

        // Calculate totals from line items if provided
        let lineItems = formData.line_items;
        let subtotal = data.subtotal || 0;
        let total = data.total_amount || 0;
        let taxAmount = data.tax_amount || 0;


        if (data.line_items && data.line_items.length > 0) {
          lineItems = data.line_items.map(item => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            amount: item.amount || ((item.quantity || 0) * (item.rate || 0))
          }));
          subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
          total = subtotal + taxAmount; // Recalculate total if line items are present
        } else if (data.total_amount && !data.subtotal) {
            // If total is provided but subtotal isn't, and no line items, assume subtotal is total - tax
            subtotal = data.total_amount - taxAmount;
            total = data.total_amount;
        }

        setFormData((prevFormData) => {
            const updatedFormData = {
                ...prevFormData,
                number: data.invoice_number || prevFormData.number,
                client_id: clientId || prevFormData.client_id,
                subtotal: subtotal,
                tax_amount: taxAmount,
                total: total,
                balance_open: total,
                due_date: data.due_date || prevFormData.due_date,
                period_start: data.period_start || prevFormData.period_start,
                period_end: data.period_end || prevFormData.period_end,
                attachments: [...(prevFormData.attachments || []), file_url]
            };

            // Only update line_items if new ones were extracted, otherwise keep existing
            if (data.line_items && data.line_items.length > 0) {
                updatedFormData.line_items = lineItems;
            } else if (updatedFormData.line_items.length === 1 && updatedFormData.line_items[0].description === '') {
                // If there was only one empty line item, remove it if data was extracted for total/subtotal but not line items
                updatedFormData.line_items = [];
            }
            return updatedFormData;
        });

        alert('Invoice data extracted successfully! Please review and adjust as needed.');
      } else {
        // If extraction fails, just add as attachment
        setFormData((prevFormData) => ({
          ...prevFormData,
          attachments: [...(prevFormData.attachments || []), file_url]
        }));
        alert('Could not extract data from document, but file was uploaded as attachment.');
      }
    } catch (error) {
      console.error('Smart upload error:', error);
      alert('Failed to process document. Please try manual entry.');
    } finally {
      setSmartUploading(false);
      e.target.value = null;
    }
  };

  // New attachment removal handler
  const handleRemoveAttachment = (index) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      attachments: prevFormData.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleBack = () => {
    if (returnTo === 'project' && returnProjectId) {
      navigate(createPageUrl(`ProjectDetail?id=${returnProjectId}`));
    } else {
      navigate(createPageUrl('BillsInvoices'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          className="bg-white border-[#C9C8AF]"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold heading" style={{ color: '#181E18' }}>Create New Invoice</h2>
          <p style={{ color: '#5A7765' }} className="mt-1">Bill your client for work completed</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="INV-001"
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
                    <SelectItem value="Sent">Sent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Project <span className="text-red-600">*</span></Label>
                <Select
                  required
                  value={formData.project_id || ''}
                  onValueChange={(value) => {
                    const project = projects.find(p => p.id === value);
                    setFormData({
                      ...formData,
                      project_id: value,
                      client_id: project?.client_id || ''
                    });
                  }}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client <span className="text-red-600">*</span></Label>
                <Select
                  required
                  value={formData.client_id || ''}
                  onValueChange={(value) => setFormData({...formData, client_id: value})}
                  disabled={!formData.project_id}
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={formData.period_start || ''}
                  onChange={(e) => setFormData({...formData, period_start: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={formData.period_end || ''}
                  onChange={(e) => setFormData({...formData, period_end: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            {/* Initial Partial Payment Option */}
            {formData.status === 'Sent' && formData.total > 0 && (
              <Card className="bg-white border-[#C9C8AF]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasInitialPayment"
                      checked={hasInitialPayment}
                      onChange={(e) => setHasInitialPayment(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Label htmlFor="hasInitialPayment" className="cursor-pointer">
                      Record initial partial payment
                    </Label>
                  </div>
                  
                  {hasInitialPayment && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <Label>Payment Percentage</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={initialPaymentPercent}
                            onChange={(e) => setInitialPaymentPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="bg-white border-gray-300 text-gray-900"
                          />
                          <span className="text-sm text-gray-600">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Payment Amount</Label>
                        <Input
                          type="text"
                          value={formatCurrency((formData.total || 0) * initialPaymentPercent / 100)}
                          readOnly
                          className="bg-gray-100 border-gray-300 text-gray-900"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-gray-600 bg-[#E8E7DD] p-3 rounded">
                          <p><strong>Remaining balance:</strong> {formatCurrency((formData.total || 0) * (100 - initialPaymentPercent) / 100)}</p>
                          <p className="text-xs mt-1">This will be recorded as AR Open</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="border-gray-300 text-gray-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {formData.line_items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <Label className="text-sm">Description</Label>
                  <Input
                    value={item.description || ''}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="Work description"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">Quantity</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantity || ''}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.rate || ''}
                    onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">Amount</Label>
                  <Input
                    type="number"
                    value={item.amount || 0}
                    readOnly
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="border-t border-gray-300 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(formData.subtotal)}</span>
              </div>
              
              <div className="flex justify-between items-center gap-4">
                <Label className="text-gray-600">Tax:</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_amount || ''}
                  onChange={(e) => {
                    const taxAmount = parseFloat(e.target.value) || 0;
                    const { subtotal, total } = calculateTotals(formData.line_items, taxAmount, formData.retention_amount);
                    setFormData({
                      ...formData,
                      tax_amount: taxAmount,
                      subtotal,
                      total,
                      balance_open: total
                    });
                  }}
                  className="bg-white border-gray-300 text-gray-900 w-32"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <Label className="text-gray-600">Retention:</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retention_amount || ''}
                  onChange={(e) => {
                    const retentionAmount = parseFloat(e.target.value) || 0;
                    const { subtotal, total } = calculateTotals(formData.line_items, formData.tax_amount, retentionAmount);
                    setFormData({
                      ...formData,
                      retention_amount: retentionAmount,
                      subtotal,
                      total,
                      balance_open: total
                    });
                  }}
                  className="bg-white border-gray-300 text-gray-900 w-32"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(formData.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments Card with Smart/Manual Upload */}
        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle className="heading">Attachments & Document Upload</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Upload Methods Tabs */}
            <Tabs defaultValue="smart" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#E8E7DD]">
                <TabsTrigger value="smart" className="flex items-center gap-2" style={{ color: '#5A7765' }}>
                  <Sparkles className="w-4 h-4" />
                  Smart Upload (AI)
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2" style={{ color: '#5A7765' }}>
                  <Upload className="w-4 h-4" />
                  Manual Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="smart" className="space-y-3 mt-4">
                <div className="bg-[#E8E7DD] border border-[#C9C8AF] rounded-lg p-4">
                  <p className="text-sm mb-3" style={{ color: '#5A7765' }}>
                    Upload an invoice PDF or image and we'll automatically extract the data for you.
                  </p>
                  <input
                    type="file"
                    onChange={handleSmartUpload}
                    className="hidden"
                    id="smart-invoice-upload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={smartUploading}
                  />
                  <label htmlFor="smart-invoice-upload">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-[#C9C8AF] rounded-md transition-colors cursor-pointer ${
                        smartUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#14503C]'
                      }`}
                      style={{ backgroundColor: smartUploading ? '#E8E7DD' : '#0E351F', color: 'white' }}
                    >
                      {smartUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Processing Document...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span className="text-sm">Upload & Extract Data</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-4">
                <div className="bg-[#E8E7DD] border border-[#C9C8AF] rounded-lg p-4">
                  <p className="text-sm mb-3" style={{ color: '#5A7765' }}>
                    Upload files manually for larger documents or when AI extraction isn't needed.
                  </p>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="manual-invoice-upload"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    disabled={uploadingFile}
                  />
                  <label htmlFor="manual-invoice-upload">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-[#C9C8AF] rounded-md transition-colors cursor-pointer ${
                        uploadingFile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'
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
              </TabsContent>
            </Tabs>

            {/* Uploaded Files List */}
            {formData.attachments && formData.attachments.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label className="text-sm font-medium" style={{ color: '#181E18' }}>Uploaded Files</Label>
                {formData.attachments.map((url, index) => (
                  <DocumentViewer
                    key={index}
                    fileUrl={url}
                    fileName={`Attachment ${index + 1}`}
                    showDelete={true}
                    onDelete={() => handleRemoveAttachment(index)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardContent className="p-6">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-white border-[#C9C8AF] text-[#181E18] mt-2"
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="border-[#C9C8AF]"
            style={{ color: '#5A7765' }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="text-white"
            style={{ backgroundColor: '#0E351F' }}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
