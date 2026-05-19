import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Estimates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [estimateToDelete, setEstimateToDelete] = React.useState(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState(null);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [createFormData, setCreateFormData] = React.useState({
    name: '',
    project_id: '',
    labor_rate: 75,
    markup_percent: 15,
    gross_profit_margin_percent: 20
  });
  const [uploadProjectId, setUploadProjectId] = React.useState('');
  const [uploadOpportunityId, setUploadOpportunityId] = React.useState('');
  const [uploadLinkType, setUploadLinkType] = React.useState('none'); // 'none' | 'opportunity' | 'project'

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list('-created_date'),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (estimateId) => base44.entities.Estimate.delete(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setShowDeleteConfirm(false);
      setEstimateToDelete(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const estimate = await base44.entities.Estimate.create(data);
      
      // If project selected, update project with estimate_id
      if (data.project_id) {
        await base44.entities.Project.update(data.project_id, {
          estimate_id: estimate.id
        });
      }
      
      return estimate;
    },
    onSuccess: (estimate) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      setCreateFormData({
        name: '',
        project_id: '',
        labor_rate: 75,
        markup_percent: 15,
        gross_profit_margin_percent: 20
      });
      navigate(createPageUrl(`CreateEstimate?id=${estimate.id}`));
    },
  });

  const handleRowClick = (estimate) => {
    navigate(createPageUrl(`CreateEstimate?id=${estimate.id}`));
  };

  const handleDeleteClick = (e, estimate) => {
    e.stopPropagation();
    setEstimateToDelete(estimate);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (estimateToDelete) {
      deleteMutation.mutate(estimateToDelete.id);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createFormData.name) {
      toast.error('Please enter an estimate name');
      return;
    }
    createMutation.mutate(createFormData);
  };

  const handleUploadEstimate = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setIsExtracting(true);
    try {
      // Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });

      // Use LLM to extract estimate data (handles PDF, Excel, Google Docs export, CSV)
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are extracting construction estimate data from a document. Extract ALL line items, costs, labor, subcontractors, and financial details you can find. Return a JSON object with this exact structure:
{
  "name": "project or estimate name",
  "project_address": "address if found",
  "labor_rate": number or null,
  "labor_hours": total labor hours or 0,
  "markup_percent": markup % or 0,
  "sales_tax_rate": sales tax % or 0,
  "permit_cost": permit cost number or 0,
  "task_line_items": [
    { "description": "item description", "quantity": number, "unit_cost": number, "material_cost": number, "labor_hours": number, "total": number, "notes": "" }
  ],
  "subcontractor_line_items": [
    { "name": "subcontractor name/trade", "sub_cost": number, "labor_hours": 0, "total": number, "notes": "" }
  ]
}
Extract every cost row you can find. For Excel/spreadsheet files, map each row to the appropriate category. For items that look like subcontractor/trade work, put them in subcontractor_line_items. For materials and labor, use task_line_items.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            project_address: { type: "string" },
            labor_rate: { type: "number" },
            labor_hours: { type: "number" },
            markup_percent: { type: "number" },
            sales_tax_rate: { type: "number" },
            permit_cost: { type: "number" },
            task_line_items: { type: "array", items: { type: "object" } },
            subcontractor_line_items: { type: "array", items: { type: "object" } }
          }
        },
        model: "gemini_3_flash"
      });

      const extractedData = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;

      const linkedOpportunityId = uploadLinkType === 'opportunity' ? uploadOpportunityId : '';
      const linkedProjectId = uploadLinkType === 'project' ? uploadProjectId : '';

      // Create the estimate with extracted data
      const newEstimate = await base44.entities.Estimate.create({
        name: extractedData.name || uploadFile.name.replace(/\.[^/.]+$/, '') || 'Imported Estimate',
        opportunity_id: linkedOpportunityId || '',
        project_id: linkedProjectId || '',
        project_address: extractedData.project_address || '',
        labor_rate: extractedData.labor_rate || 75,
        labor_hours: extractedData.labor_hours || 0,
        markup_percent: extractedData.markup_percent || 15,
        sales_tax_rate: extractedData.sales_tax_rate || 7,
        permit_cost: extractedData.permit_cost || 0,
        task_line_items: (extractedData.task_line_items || []).map(item => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost || 0,
          material_cost: item.material_cost || (item.quantity || 1) * (item.unit_cost || 0),
          labor_hours: item.labor_hours || 0,
          total: item.total || item.material_cost || 0,
          notes: item.notes || ''
        })),
        subcontractor_line_items: (extractedData.subcontractor_line_items || []).map(item => ({
          name: item.name || 'Subcontractor',
          unit_cost: item.unit_cost || 0,
          sub_cost: item.sub_cost || 0,
          labor_hours: item.labor_hours || 0,
          total: item.total || item.sub_cost || 0,
          notes: item.notes || ''
        })),
        status: 'Draft'
      });

      // Link back to opportunity or project
      if (linkedOpportunityId) {
        await base44.entities.Opportunity.update(linkedOpportunityId, { estimate_id: newEstimate.id });
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      }
      if (linkedProjectId) {
        await base44.entities.Project.update(linkedProjectId, { estimate_id: newEstimate.id });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }

      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadProjectId('');
      setUploadOpportunityId('');
      setUploadLinkType('none');
      toast.success('Estimate imported successfully! Review and adjust the line items.');
      navigate(createPageUrl(`CreateEstimate?id=${newEstimate.id}`));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to extract estimate: ' + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const getOpportunityName = (opportunityId) => {
    const opp = opportunities.find(o => o.id === opportunityId);
    return opp?.name || '-';
  };

  const columns = [
    {
      header: "Number",
      accessorKey: "number",
      cell: (row) => <span className="font-mono text-sm">{row.number || '-'}</span>,
      sortable: true,
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortable: true,
    },
    {
      header: "Opportunity",
      accessorKey: "opportunity_id",
      cell: (row) => getOpportunityName(row.opportunity_id),
      sortable: true,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    },
    {
      header: "Version",
      accessorKey: "version",
      cell: (row) => <span className="text-sm">v{row.version || 1}</span>,
      sortable: true,
    },
    {
      header: "Estimated Price",
      accessorKey: "estimated_selling_price",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.estimated_selling_price || 0)}</span>
      ),
      sortable: true,
    },
    {
      header: "Estimated Profit",
      accessorKey: "estimated_profit",
      cell: (row) => {
        const profit = row.estimated_profit || 0;
        return (
          <span className={profit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {formatCurrency(profit)}
          </span>
        );
      },
      sortable: true,
    },
    {
      header: "Created",
      accessorKey: "created_date",
      cell: (row) => formatDate(row.created_date),
      sortable: true,
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => handleDeleteClick(e, row)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      sortable: false,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estimates</h2>
          <p className="text-gray-600 mt-1">View and manage all project estimates</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowUploadModal(true)}
            variant="outline"
            className="border-gray-300"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Estimate
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={estimates}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        emptyMessage="No estimates yet. Create one from an opportunity."
        searchPlaceholder="Search estimates..."
        statusFilter={{
          field: 'status',
          options: ['Draft', 'Submitted', 'Awarded', 'Lost']
        }}
      />

      {/* Create Estimate Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Create New Estimate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label>Estimate Name *</Label>
              <Input
                value={createFormData.name}
                onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                className="bg-white border-gray-300"
                placeholder="e.g., Kitchen Remodel - 123 Main St"
                required
              />
            </div>

            <div>
              <Label>Link to Project (Optional)</Label>
              <Select
                value={createFormData.project_id}
                onValueChange={(value) => setCreateFormData({...createFormData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value={null}>None</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.number ? `${project.number} - ` : ''}{project.name} ({project.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Link this estimate as the baseline for change orders
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Labor Rate ($/hr)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={createFormData.labor_rate}
                  onChange={(e) => setCreateFormData({...createFormData, labor_rate: parseFloat(e.target.value) || 0})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Markup %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={createFormData.markup_percent}
                  onChange={(e) => setCreateFormData({...createFormData, markup_percent: parseFloat(e.target.value) || 0})}
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label>Profit Margin %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={createFormData.gross_profit_margin_percent}
                  onChange={(e) => setCreateFormData({...createFormData, gross_profit_margin_percent: parseFloat(e.target.value) || 0})}
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Estimate'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Estimate Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Estimate from File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Upload Estimate File</Label>
              <Input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="bg-white border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-2">
                Accepts PDF, Excel (.xlsx/.xls), CSV, or Word documents. AI will extract all line items, costs, and details automatically.
              </p>
            </div>

            <div>
              <Label>Link To (Optional)</Label>
              <Select value={uploadLinkType} onValueChange={setUploadLinkType}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">None — standalone estimate</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadLinkType === 'opportunity' && (
              <div>
                <Label>Select Opportunity</Label>
                <Select value={uploadOpportunityId} onValueChange={setUploadOpportunityId}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select an opportunity..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    {opportunities.map((opp) => (
                      <SelectItem key={opp.id} value={opp.id}>{opp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  This estimate will be set as the baseline for this opportunity and will carry over when converted to a project.
                </p>
              </div>
            )}

            {uploadLinkType === 'project' && (
              <div>
                <Label>Select Project</Label>
                <Select value={uploadProjectId} onValueChange={setUploadProjectId}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.number ? `${project.number} - ` : ''}{project.name} ({project.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  This estimate will be set as the budget baseline for this project.
                </p>
              </div>
            )}

            {isExtracting && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing file and extracting estimate data... This may take a moment.</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadProjectId('');
                  setUploadOpportunityId('');
                  setUploadLinkType('none');
                }}
                className="border-gray-300"
                disabled={isExtracting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadEstimate}
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={!uploadFile || isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Estimate
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{estimateToDelete?.name}</span>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
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
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Estimate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}