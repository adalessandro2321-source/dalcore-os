import React from "react";
import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { formatCurrency } from "../shared/DateFormatter";

export default function SmartQuoteUpload({ 
  opportunityId, 
  estimateId,
  onQuoteExtracted, 
  onCancel 
}) {
  const [uploading, setUploading] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [fileUrl, setFileUrl] = React.useState(null);
  const [fileName, setFileName] = React.useState(null);
  const [quoteType, setQuoteType] = React.useState('subcontractor');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setExtractedData(null);

    try {
      // Upload file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      setFileName(file.name);

      // Extract data based on quote type
      const schema = quoteType === 'subcontractor' ? {
        type: "object",
        properties: {
          vendor_name: { type: "string" },
          trade_type: { type: "string" },
          quote_number: { type: "string" },
          total_amount: { type: "number" },
          labor_hours: { type: "number" },
          description: { type: "string" },
          notes: { type: "string" }
        }
      } : {
        type: "object",
        properties: {
          vendor_name: { type: "string" },
          quote_number: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_cost: { type: "number" },
                total: { type: "number" }
              }
            }
          },
          subtotal: { type: "number" },
          tax: { type: "number" },
          total: { type: "number" }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      if (result.status === 'success' && result.output) {
        setExtractedData(result.output);
      } else {
        setError(result.details || 'Could not extract data from the quote. Please check the file format.');
      }
    } catch (err) {
      console.error('Smart upload error:', err);
      setError('Failed to process the quote. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedData || !fileUrl) return;

    // Save document to Quotes folder
    const documentData = {
      name: fileName || `Quote - ${extractedData.vendor_name || 'Unknown'}`,
      folder: 'Quotes',
      type: 'Other',
      file_url: fileUrl,
      description: extractedData.quote_number 
        ? `Quote ${extractedData.quote_number} - ${formatCurrency(extractedData.total_amount || extractedData.total || 0)}`
        : `Quote - ${formatCurrency(extractedData.total_amount || extractedData.total || 0)}`
    };

    // Add opportunity or estimate link if available
    if (opportunityId) {
      documentData.opportunity_id = opportunityId;
    }
    // Note: We can't link to estimate directly as it doesn't have a linked_entity_type for estimates
    // But we can add it to the opportunity which will transfer when converted to project

    await base44.entities.Document.create(documentData);

    // Return the extracted data to parent component
    onQuoteExtracted({
      type: quoteType,
      data: extractedData,
      fileUrl: fileUrl
    });
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {!extractedData && (
        <div className="space-y-4">
          <div>
            <Label>Quote Type</Label>
            <Select value={quoteType} onValueChange={setQuoteType}>
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="subcontractor">Subcontractor Quote</SelectItem>
                <SelectItem value="materials">Materials/Vendor Quote</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600 mt-1">
              {quoteType === 'subcontractor' 
                ? 'Upload quotes from subcontractors for specific trades (e.g., plumbing, electrical)'
                : 'Upload quotes from vendors for materials and supplies'}
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-[#2A6B5A]" />
              <p className="text-sm text-gray-700 mb-4">
                Upload a quote document (PDF, image, or CSV) and we'll automatically extract the pricing data
              </p>
              
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="quote-upload"
                accept=".pdf,.jpg,.jpeg,.png,.csv"
                disabled={uploading}
              />
              <label htmlFor="quote-upload">
                <Button
                  as="span"
                  disabled={uploading}
                  className="bg-[#1B4D3E] hover:bg-[#14503C] text-white cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Quote...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Quote Document
                    </>
                  )}
                </Button>
              </label>
            </div>
          </div>

          {error && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Extraction Error</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Review Extracted Data */}
      {extractedData && (
        <div className="space-y-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Data Extracted Successfully!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Review the extracted information below and confirm to add it to your estimate.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="border-b border-gray-300">
              <CardTitle className="text-base">Extracted Quote Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {quoteType === 'subcontractor' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Vendor/Subcontractor</p>
                      <p className="font-semibold text-gray-900">{extractedData.vendor_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Trade Type</p>
                      <p className="font-semibold text-gray-900">{extractedData.trade_type || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Quote Number</p>
                      <p className="font-semibold text-gray-900">{extractedData.quote_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="font-semibold text-green-600 text-lg">
                        {formatCurrency(extractedData.total_amount || 0)}
                      </p>
                    </div>
                  </div>
                  {extractedData.labor_hours > 0 && (
                    <div>
                      <p className="text-sm text-gray-600">Labor Hours (Optional)</p>
                      <p className="font-semibold text-gray-900">{extractedData.labor_hours} hours</p>
                    </div>
                  )}
                  {extractedData.description && (
                    <div>
                      <p className="text-sm text-gray-600">Description</p>
                      <p className="text-gray-900">{extractedData.description}</p>
                    </div>
                  )}
                  {extractedData.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="text-gray-900">{extractedData.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Vendor</p>
                      <p className="font-semibold text-gray-900">{extractedData.vendor_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Quote Number</p>
                      <p className="font-semibold text-gray-900">{extractedData.quote_number || 'N/A'}</p>
                    </div>
                  </div>

                  {extractedData.items && extractedData.items.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Line Items</p>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-2 text-gray-700">Description</th>
                              <th className="text-right p-2 text-gray-700">Qty</th>
                              <th className="text-right p-2 text-gray-700">Unit Cost</th>
                              <th className="text-right p-2 text-gray-700">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {extractedData.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity}</td>
                                <td className="p-2 text-right">{formatCurrency(item.unit_cost || 0)}</td>
                                <td className="p-2 text-right font-semibold">{formatCurrency(item.total || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                              <td colSpan="3" className="p-2 text-right">Total:</td>
                              <td className="p-2 text-right text-green-600">
                                {formatCurrency(extractedData.total || extractedData.subtotal || 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Add to Estimate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}