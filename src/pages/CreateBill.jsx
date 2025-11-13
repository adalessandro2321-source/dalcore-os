
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
import { ArrowLeft, Upload, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import { formatCurrency } from "../components/shared/DateFormatter";
import DocumentViewer from "../components/shared/DocumentViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CreateBill() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [smartUploading, setSmartUploading] = React.useState(false); // New state for smart upload
  const [hasInitialPayment, setHasInitialPayment] = React.useState(false); // New state for initial payment option
  const [initialPaymentPercent, setInitialPaymentPercent] = React.useState(50); // New state for initial payment percentage

  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get('returnTo');
  const returnProjectId = urlParams.get('projectId');

  const [formData, setFormData] = React.useState({
    status: 'Draft',
    amount: 0,
    balance_open: 0,
    due_date: '',
    attachments: []
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

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
      e.target.value = null;
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
            bill_number: { type: "string" },
            vendor_name: { type: "string" },
            total_amount: { type: "number" },
            due_date: { type: "string" },
            category: { type: "string" },
            description: { type: "string" }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const data = result.output;
        
        // Find matching vendor
        let vendorId = formData.vendor_id;
        if (data.vendor_name) {
          const matchingVendor = companies.find(c => 
            ['Subcontractor', 'Supplier'].includes(c.type) && 
            c.name.toLowerCase().includes(data.vendor_name.toLowerCase())
          );
          if (matchingVendor) vendorId = matchingVendor.id;
        }

        // Map category if it matches our enum
        const categories = ["Materials", "Labor", "Equipment", "Subcontractor", "Professional Services", "Other"];
        let category = formData.category;
        if (data.category) {
          const matchedCategory = categories.find(c => 
            c.toLowerCase() === data.category.toLowerCase() || c.toLowerCase().includes(data.category.toLowerCase()) // More robust matching
          );
          if (matchedCategory) category = matchedCategory;
        }

        setFormData((prevFormData) => ({
          ...prevFormData,
          number: data.bill_number || prevFormData.number,
          vendor_id: vendorId || prevFormData.vendor_id,
          amount: data.total_amount || prevFormData.amount,
          balance_open: data.total_amount || prevFormData.amount, // This will be overridden by mutationFn if status is Approved/Partial
          due_date: data.due_date || prevFormData.due_date,
          category: category || prevFormData.category,
          notes: data.description || prevFormData.notes,
          attachments: [...(prevFormData.attachments || []), file_url]
        }));

        alert('Bill data extracted successfully! Please review and adjust as needed.');
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
      e.target.value = null; // Clear the input field
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      attachments: prevFormData.attachments.filter((_, i) => i !== index)
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate initial payment if applicable
      const initialPaymentAmount = hasInitialPayment && data.status === 'Approved' 
        ? (data.amount * initialPaymentPercent / 100) 
        : 0;
      
      const initialBalanceOpen = data.status === 'Approved' 
        ? (data.amount - initialPaymentAmount) 
        : 0;
      
      const initialBillStatus = data.status === 'Approved' && initialPaymentAmount > 0 && initialBalanceOpen > 0
        ? 'Partial'
        : data.status;

      // Create the bill
      const bill = await base44.entities.Bill.create({
        ...data,
        balance_open: initialBalanceOpen,
        status: initialBillStatus,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
      });

      // Create initial payment if applicable
      if (hasInitialPayment && initialPaymentAmount > 0 && data.status === 'Approved') {
        await base44.entities.Payment.create({
          project_id: data.project_id,
          type: 'Outgoing',
          amount: initialPaymentAmount,
          payment_date: new Date().toISOString(), // Payment date is current date
          payment_method: 'Check', // Default method, could be made configurable
          applies_to_type: 'Bill',
          applies_to_id: bill.id,
          applied_amount: initialPaymentAmount,
          notes: `Initial ${initialPaymentPercent}% payment for Bill ${bill.number || bill.id}`
        });
      }

      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          await base44.entities.Document.create({
            name: `Bill ${data.number || bill.id} - Attachment`,
            project_id: data.project_id,
            folder: 'Bills',
            type: 'Bill',
            file_url: attachment,
            linked_entity_type: 'Bill',
            linked_entity_id: bill.id,
            description: `Bill - ${formatCurrency(data.amount || 0)}`
          });
        }
      }

      await recalculateProjectBudget(data.project_id, queryClient);

      return bill;
    },
    onSuccess: (bill) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      queryClient.invalidateQueries({ queryKey: ['projectBudget', bill.project_id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', bill.project_id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] }); // Invalidate payments query

      navigate(createPageUrl(`BillDetail?id=${bill.id}`));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleBack = () => {
    if (returnTo === 'project' && returnProjectId) {
      navigate(createPageUrl(`ProjectDetail?id=${returnProjectId}`));
    } else {
      navigate(createPageUrl('BillsInvoices'));
    }
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
          <h2 className="text-2xl font-bold heading" style={{ color: '#181E18' }}>Create New Bill</h2>
          <p style={{ color: '#5A7765' }} className="mt-1">Record a vendor bill or invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
          <CardHeader className="border-b border-[#C9C8AF]">
            <CardTitle className="heading">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bill Number</Label>
                <Input
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="BILL-001"
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
                  onValueChange={(value) => setFormData({...formData, project_id: value})}
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
                <Label>Vendor <span className="text-red-600">*</span></Label>
                <Select
                  required
                  value={formData.vendor_id || ''}
                  onValueChange={(value) => setFormData({...formData, vendor_id: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select vendor" />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount <span className="text-red-600">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount || ''}
                  onChange={(e) => {
                    const amount = parseFloat(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      amount,
                    });
                  }}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="0.00"
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
            {formData.status === 'Approved' && (
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
                    <Label htmlFor="hasInitialPayment" className="cursor-pointer text-sm font-medium">
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
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value)) {
                                setInitialPaymentPercent(Math.min(100, Math.max(0, value)));
                              } else if (e.target.value === '') {
                                setInitialPaymentPercent(0); // Allow clearing input
                              }
                            }}
                            className="bg-white border-gray-300 text-gray-900"
                          />
                          <span className="text-sm text-gray-600">%</span>
                        </div>
                      </div>
                      <div>
                        <Label>Payment Amount</Label>
                        <Input
                          type="text"
                          value={formatCurrency((formData.amount || 0) * initialPaymentPercent / 100)}
                          readOnly
                          className="bg-gray-100 border-gray-300 text-gray-900"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm text-gray-600 bg-[#E8E7DD] p-3 rounded">
                          <p><strong>Remaining balance:</strong> {formatCurrency((formData.amount || 0) * (100 - initialPaymentPercent) / 100)}</p>
                          <p className="text-xs mt-1">This will be recorded as AP Open in committed costs</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <Label>Category</Label>
              <Select
                value={formData.category || ''}
                onValueChange={(value) => setFormData({...formData, category: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
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
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="smart" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Smart Upload (AI)
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Manual Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="smart" className="space-y-3 mt-4">
                <div className="bg-[#E8E7DD] border border-[#C9C8AF] rounded-lg p-4">
                  <p className="text-sm mb-3" style={{ color: '#5A7765' }}>
                    Upload a bill PDF or image and we'll automatically extract the data for you.
                  </p>
                  <input
                    type="file"
                    onChange={handleSmartUpload}
                    className="hidden"
                    id="smart-bill-upload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={smartUploading}
                  />
                  <label htmlFor="smart-bill-upload">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 border border-[#C9C8AF] rounded-md transition-colors cursor-pointer ${
                        smartUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'
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
                    id="manual-bill-upload"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    disabled={uploadingFile}
                  />
                  <label htmlFor="manual-bill-upload">
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
            {createMutation.isPending ? 'Creating...' : 'Create Bill'}
          </Button>
        </div>
      </form>
    </div>
  );
}
