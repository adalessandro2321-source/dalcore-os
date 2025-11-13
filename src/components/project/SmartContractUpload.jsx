import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { recalculateProjectBudget } from "../shared/BudgetRecalculation";

export default function SmartContractUpload({ projectId, onComplete, onCancel }) {
  const [file, setFile] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [extractedData, setExtractedData] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const queryClient = useQueryClient();

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setExtractedData(null);
      setShowPreview(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;

    setUploading(true);
    setExtracting(true);
    setError(null);

    try {
      // Step 1: Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Step 2: Extract contract data using AI
      const extractionSchema = {
        type: "object",
        properties: {
          contract_number: { type: "string", description: "Contract number or ID" },
          contract_value: { type: "number", description: "Total contract value/amount" },
          counterparty_name: { type: "string", description: "Name of the other party (contractor, subcontractor, vendor)" },
          contract_type: { 
            type: "string", 
            enum: ["Prime", "Subcontract", "Purchase Order", "Service"],
            description: "Type of contract"
          },
          payment_terms: { type: "string", description: "Payment terms description" },
          retention_percent: { type: "number", description: "Retention percentage (0-100)" },
          start_date: { type: "string", description: "Contract start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Contract end date (YYYY-MM-DD)" },
          performance_obligations: {
            type: "array",
            description: "Payment milestones/performance obligations - break down how payment will be made throughout the project",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Milestone/obligation name" },
                description: { type: "string", description: "What needs to be completed" },
                percentage_of_contract: { type: "number", description: "Percentage of total contract value (0-100)" },
                estimated_completion_date: { type: "string", description: "Expected completion date (YYYY-MM-DD)" }
              }
            }
          }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === 'error') {
        throw new Error(result.details || 'Failed to extract contract data');
      }

      const extracted = result.output;
      
      // Calculate allocated values for performance obligations
      if (extracted.performance_obligations && Array.isArray(extracted.performance_obligations)) {
        extracted.performance_obligations = extracted.performance_obligations.map(po => ({
          ...po,
          allocated_value: (extracted.contract_value * po.percentage_of_contract) / 100
        }));
      }

      setExtractedData({ ...extracted, file_url });
      setShowPreview(true);
      setUploading(false);
      setExtracting(false);
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message || 'Failed to extract contract data');
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedData) return;

    setUploading(true);
    try {
      // Step 1: Create Contract record
      const contractData = {
        project_id: projectId,
        number: extractedData.contract_number,
        type: extractedData.contract_type || 'Prime',
        amount: extractedData.contract_value,
        payment_terms: extractedData.payment_terms,
        retention_percent: extractedData.retention_percent || 0,
        start_date: extractedData.start_date,
        end_date: extractedData.end_date,
        status: 'Active',
        signed_file_url: extractedData.file_url,
        counterparty_name: extractedData.counterparty_name
      };

      // Find or create counterparty company if name is provided
      if (extractedData.counterparty_name) {
        const companies = await base44.entities.Company.list();
        let counterparty = companies.find(c => 
          c.name.toLowerCase() === extractedData.counterparty_name.toLowerCase()
        );

        if (!counterparty) {
          // Create new company
          counterparty = await base44.entities.Company.create({
            name: extractedData.counterparty_name,
            type: extractedData.contract_type === 'Prime' ? 'Owner' : 'Subcontractor'
          });
        }

        contractData.counterparty_id = counterparty.id;
      }

      const contract = await base44.entities.Contract.create(contractData);

      // Step 2: Create Document record
      await base44.entities.Document.create({
        name: `Contract ${extractedData.contract_number || contract.id.slice(0, 8)}`,
        project_id: projectId,
        folder: 'Contracts',
        type: 'Contract',
        file_url: extractedData.file_url,
        linked_entity_type: 'Contract',
        linked_entity_id: contract.id,
        description: `Contract with ${extractedData.counterparty_name || 'counterparty'}`
      });

      // Step 3: Create Performance Obligations if extracted
      if (extractedData.performance_obligations && extractedData.performance_obligations.length > 0) {
        for (const po of extractedData.performance_obligations) {
          await base44.entities.PerformanceObligation.create({
            project_id: projectId,
            contract_id: contract.id,
            name: po.name,
            description: po.description,
            percentage_of_contract: po.percentage_of_contract,
            allocated_value: po.allocated_value,
            estimated_completion_date: po.estimated_completion_date ? new Date(po.estimated_completion_date).toISOString() : null,
            status: 'Not Started'
          });
        }
      }

      // Step 4: Update project contract value if this is the prime contract
      if (extractedData.contract_type === 'Prime') {
        await base44.entities.Project.update(projectId, {
          contract_value: extractedData.contract_value
        });
      }

      // Step 5: Recalculate budget
      await recalculateProjectBudget(projectId, queryClient);

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      queryClient.invalidateQueries({ queryKey: ['performanceObligations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      onComplete();
    } catch (err) {
      console.error('Contract creation error:', err);
      setError(err.message || 'Failed to create contract');
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          Upload your signed contract and we'll automatically extract payment terms, milestones, and create performance obligations.
        </AlertDescription>
      </Alert>

      {!showPreview ? (
        <>
          <div>
            <Label>Select Contract File (PDF)</Label>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="bg-white border-gray-300 text-gray-900"
              disabled={uploading}
            />
            <p className="text-xs text-gray-600 mt-1">
              Upload the signed contract document
            </p>
          </div>

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-900">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={uploading}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtract}
              disabled={!file || uploading}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {extracting ? 'Extracting Data...' : 'Uploading...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract Contract Data
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Contract Data Extracted</h3>
            </div>
            <p className="text-sm text-green-800">
              Review the extracted information below and click Confirm to create the contract and performance obligations.
            </p>
          </div>

          <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-300">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Contract Number</p>
                <p className="font-medium text-gray-900">{extractedData.contract_number || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Contract Type</p>
                <p className="font-medium text-gray-900">{extractedData.contract_type || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Counterparty</p>
                <p className="font-medium text-gray-900">{extractedData.counterparty_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Contract Value</p>
                <p className="font-medium text-gray-900">
                  {extractedData.contract_value?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Start Date</p>
                <p className="font-medium text-gray-900">{extractedData.start_date || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">End Date</p>
                <p className="font-medium text-gray-900">{extractedData.end_date || '-'}</p>
              </div>
            </div>

            {extractedData.payment_terms && (
              <div>
                <p className="text-xs text-gray-600">Payment Terms</p>
                <p className="text-sm text-gray-900">{extractedData.payment_terms}</p>
              </div>
            )}

            {extractedData.performance_obligations && extractedData.performance_obligations.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Performance Obligations ({extractedData.performance_obligations.length})</p>
                <div className="space-y-2">
                  {extractedData.performance_obligations.map((po, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-900">{po.name}</p>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {po.allocated_value?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </p>
                          <p className="text-xs text-gray-600">{po.percentage_of_contract}% of contract</p>
                        </div>
                      </div>
                      {po.description && (
                        <p className="text-xs text-gray-600 mb-1">{po.description}</p>
                      )}
                      {po.estimated_completion_date && (
                        <p className="text-xs text-gray-500">Est. Complete: {po.estimated_completion_date}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-900">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview(false);
                setExtractedData(null);
                setFile(null);
              }}
              disabled={uploading}
              className="border-gray-300 text-gray-700"
            >
              Start Over
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={uploading}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Contract...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Create
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}