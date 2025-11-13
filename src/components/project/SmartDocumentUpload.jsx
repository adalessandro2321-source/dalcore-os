
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function SmartDocumentUpload({ projectId, folder, onComplete, onCancel }) {
  const [step, setStep] = React.useState('upload'); // upload, extracting, review, saving
  const [file, setFile] = React.useState(null);
  const [fileUrl, setFileUrl] = React.useState(null);
  const [extractedData, setExtractedData] = React.useState(null);
  const [formData, setFormData] = React.useState({});
  const [error, setError] = React.useState(null);
  const [manualEntry, setManualEntry] = React.useState(false);

  const getJsonSchema = () => {
    if (folder === 'Invoices') {
      return {
        type: "object",
        properties: {
          number: { type: "string", description: "Invoice number" },
          date: { type: "string", description: "Invoice date (YYYY-MM-DD)" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          subtotal: { type: "number", description: "Subtotal amount" },
          tax_amount: { type: "number", description: "Tax amount" },
          total: { type: "number", description: "Total amount" },
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
      };
    } else if (folder === 'Bills') {
      return {
        type: "object",
        properties: {
          number: { type: "string", description: "Bill number" },
          date: { type: "string", description: "Bill date (YYYY-MM-DD)" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          amount: { type: "number", description: "Total amount" },
          vendor_name: { type: "string", description: "Vendor/supplier name" },
          category: { type: "string", description: "Bill category" }
        }
      };
    } else if (folder === 'Change Orders') {
      return {
        type: "object",
        properties: {
          number: { type: "string", description: "Change order number" },
          reason: { type: "string", description: "Reason for change" },
          description: { type: "string", description: "Detailed description" },
          cost_impact: { type: "number", description: "Cost impact amount" },
          schedule_impact_days: { type: "number", description: "Schedule impact in days" }
        }
      };
    }
    return {}; // Return an empty object if folder type is not recognized
  };

  const getDefaultFormData = () => {
    if (folder === 'Invoices') {
      return {
        number: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        subtotal: 0,
        tax_amount: 0,
        total: 0,
        line_items: []
      };
    } else if (folder === 'Bills') {
      return {
        number: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: 0,
        vendor_name: '',
        category: 'Materials'
      };
    } else if (folder === 'Change Orders') {
      return {
        number: '',
        reason: '',
        description: '',
        cost_impact: 0,
        schedule_impact_days: 0
      };
    }
    return {};
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller file or enter data manually.`);
      setFile(selectedFile);
      setManualEntry(true);
      setFormData(getDefaultFormData());
      setStep('review');
      return;
    }

    // Check file type
    if (!selectedFile.type.includes('pdf')) {
      setError('Only PDF files are supported for smart extraction. You can still upload the file and enter data manually.');
      setFile(selectedFile);
      setManualEntry(true);
      setFormData(getDefaultFormData());
      setStep('review');
      return;
    }

    setFile(selectedFile);
    setStep('extracting');
    setError(null);

    try {
      // Upload file first
      const uploadResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      // Validate upload result
      if (!uploadResult || !uploadResult.file_url || typeof uploadResult.file_url !== 'string') {
        throw new Error('Invalid upload response - no file URL received');
      }
      
      setFileUrl(uploadResult.file_url);

      // Try to extract data using AI
      const schema = getJsonSchema();
      if (schema && Object.keys(schema).length > 0) { // Only attempt extraction if a schema is actually defined
        try {
          const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: uploadResult.file_url,
            json_schema: schema
          });

          if (result.status === 'success' && result.output) {
            setExtractedData(result.output);
            setFormData(result.output);
            setStep('review');
          } else {
            throw new Error(result.details || 'Failed to extract data');
          }
        } catch (extractError) {
          console.error('Extraction error:', extractError);
          
          let errorMessage = 'Could not extract data automatically. Please enter manually.';
          
          if (extractError.message?.includes('10MB') || extractError.message?.includes('file size')) {
            errorMessage = `File is too large for automatic extraction (max ${MAX_FILE_SIZE_MB}MB). Please enter data manually.`;
          } else if (extractError.response?.status === 429 || extractError.message?.includes('429')) {
            errorMessage = 'Rate limit reached. Please use manual entry or try again in a few minutes.';
          } else if (extractError.message?.includes('timeout') || extractError.name === 'AbortError') {
            errorMessage = 'Extraction timed out. The document might be complex or the service busy. Please enter data manually.';
          } else if (extractError.message?.includes('Unsupported file type') || extractError.message?.includes('not a PDF')) {
            errorMessage = 'The file is not a supported PDF for automatic extraction. Please enter data manually.';
          } else if (extractError.message?.includes('No data found')) {
            errorMessage = 'No recognizable data found in the document for automatic extraction. Please enter data manually.';
          }
          
          setError(errorMessage);
          setManualEntry(true);
          setFormData(getDefaultFormData());
          setStep('review');
        }
      } else {
        // No schema, so direct to manual entry
        setError('No extraction schema defined for this document type. Please enter data manually.');
        setManualEntry(true);
        setFormData(getDefaultFormData());
        setStep('review');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload file. Please try again.');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setStep('saving');
    setError(null);

    try {
      // Validate that we have a valid file URL
      if (!fileUrl || typeof fileUrl !== 'string') {
        throw new Error('No valid file URL available for document creation. Please re-upload the file or cancel.');
      }

      let entityId;

      if (folder === 'Invoices') {
        const invoice = await base44.entities.Invoice.create({
          ...formData,
          project_id: projectId,
          status: 'Draft',
          attachments: [fileUrl]
        });
        entityId = invoice.id;
        
        // Create document entry
        await base44.entities.Document.create({
          name: `Invoice ${formData.number || entityId}`,
          project_id: projectId,
          folder: 'Invoices',
          type: 'Invoice',
          file_url: fileUrl,
          linked_entity_type: 'Invoice',
          linked_entity_id: entityId,
          description: `Invoice - Total: $${formData.total ? formData.total.toFixed(2) : '0.00'}`
        });
      } else if (folder === 'Bills') {
        const bill = await base44.entities.Bill.create({
          ...formData,
          project_id: projectId,
          status: 'Draft',
          attachments: [fileUrl]
        });
        entityId = bill.id;
        
        // Create document entry
        await base44.entities.Document.create({
          name: `Bill ${formData.number || entityId}`,
          project_id: projectId,
          folder: 'Bills',
          type: 'Bill',
          file_url: fileUrl,
          linked_entity_type: 'Bill',
          linked_entity_id: entityId,
          description: `Bill - Amount: $${formData.amount ? formData.amount.toFixed(2) : '0.00'}`
        });
      } else if (folder === 'Change Orders') {
        const changeOrder = await base44.entities.ChangeOrder.create({
          ...formData,
          project_id: projectId,
          status: 'Draft',
          attachments: [fileUrl]
        });
        entityId = changeOrder.id;
        
        // Create document entry
        await base44.entities.Document.create({
          name: `Change Order ${formData.number || entityId}`,
          project_id: projectId,
          folder: 'Change Orders',
          type: 'Change Order',
          file_url: fileUrl,
          linked_entity_type: 'ChangeOrder',
          linked_entity_id: entityId,
          description: `Change Order - Cost Impact: $${formData.cost_impact ? formData.cost_impact.toFixed(2) : '0.00'}`
        });
      }

      // Recalculate project budget
      // This assumes base44.entities.Project has a recalculateBudget method
      if (base44.entities.Project && typeof base44.entities.Project.recalculateBudget === 'function') {
        await base44.entities.Project.recalculateBudget({ project_id: projectId });
      } else {
        console.warn('base44.entities.Project.recalculateBudget is not available. Project budget might not be updated.');
      }

      onComplete();
    } catch (error) {
      console.error('Save error:', error);
      setError(error.message || 'Failed to save. Please try again.');
      setStep('review');
    }
  };

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
    enabled: step === 'review'
  });

  if (step === 'upload') {
    return (
      <Card className="bg-white border-gray-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2A6B5A]" />
            Upload {folder} Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-sm text-blue-900 font-medium">Smart Upload</p>
            <p className="text-sm text-blue-700">
              Upload a PDF (max {MAX_FILE_SIZE_MB}MB) and we'll automatically extract key information. You can review and edit before saving.
            </p>
            <p className="text-xs text-blue-600">
              💡 Tip: For files larger than {MAX_FILE_SIZE_MB}MB, you'll need to enter data manually.
            </p>
          </div>
          <div>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="bg-white border-gray-300 text-gray-900"
            />
            <p className="text-xs text-gray-600 mt-1">Maximum file size: {MAX_FILE_SIZE_MB}MB</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'extracting') {
    return (
      <Card className="bg-white border-gray-300">
        <CardContent className="p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-[#2A6B5A] animate-spin" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">Extracting data from document...</p>
              <p className="text-sm text-gray-600 mt-1">This may take a few seconds</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'review') {
    return (
      <Card className="bg-white border-gray-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {manualEntry ? (
              <>
                <FileText className="w-5 h-5 text-[#2A6B5A]" />
                Manual Entry
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-[#2A6B5A]" />
                Review Extracted Data
              </>
            )}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {manualEntry 
              ? 'Please enter the document information manually.'
              : 'Please review and edit the extracted information before saving.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Automatic Extraction Failed</p>
                <p className="text-sm text-yellow-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {folder === 'Invoices' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input
                    required
                    value={formData.number || ''}
                    onChange={(e) => setFormData({...formData, number: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Client</Label>
                  <Select
                    value={formData.client_id || ''}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={formData.date || ''}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Subtotal</Label>
                  <Input
                    type="number"
                    value={formData.subtotal || ''}
                    onChange={(e) => {
                      const subtotal = parseFloat(e.target.value) || 0;
                      const tax = formData.tax_amount || 0;
                      setFormData({...formData, subtotal, total: subtotal + tax});
                    }}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Tax</Label>
                  <Input
                    type="number"
                    value={formData.tax_amount || ''}
                    onChange={(e) => {
                      const tax = parseFloat(e.target.value) || 0;
                      const subtotal = formData.subtotal || 0;
                      setFormData({...formData, tax_amount: tax, total: subtotal + tax});
                    }}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input
                    type="number"
                    required
                    value={formData.total || ''}
                    onChange={(e) => setFormData({...formData, total: parseFloat(e.target.value) || 0})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            </>
          )}

          {folder === 'Bills' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bill Number</Label>
                  <Input
                    required
                    value={formData.number || ''}
                    onChange={(e) => setFormData({...formData, number: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Select
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
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={formData.date || ''}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    required
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.category || 'Materials'}
                    onValueChange={(value) => setFormData({...formData, category: value})}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
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
              </div>
            </>
          )}

          {folder === 'Change Orders' && (
            <>
              <div>
                <Label>Change Order Number</Label>
                <Input
                  required
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  required
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
                    value={formData.cost_impact || ''}
                    onChange={(e) => setFormData({...formData, cost_impact: parseFloat(e.target.value) || 0})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <Label>Schedule Impact (days)</Label>
                  <Input
                    type="number"
                    value={formData.schedule_impact_days || ''}
                    onChange={(e) => setFormData({...formData, schedule_impact_days: parseInt(e.target.value) || 0})}
                    className="bg-white border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              Save & Create {folder === 'Invoices' ? 'Invoice' : folder === 'Bills' ? 'Bill' : 'Change Order'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'saving') {
    return (
      <Card className="bg-white border-gray-300">
        <CardContent className="p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-[#2A6B5A] animate-spin" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">Saving...</p>
              <p className="text-sm text-gray-600 mt-1">Creating records and updating CTC</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
