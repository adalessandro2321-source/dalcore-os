
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Upload, Loader2, Sparkles, Eye } from "lucide-react";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import { recalculateProjectBudget } from "../components/shared/BudgetRecalculation";
import DocumentViewer from "../components/shared/DocumentViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ChangeOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Parse project_id from URL query params
  const queryParams = new URLSearchParams(location.search);
  const initialProjectIdFromUrl = queryParams.get('project_id');

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [smartUploading, setSmartUploading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    status: 'Draft',
    cost_impact: 0,
    schedule_impact_days: 0,
    attachments: [],
    project_id: initialProjectIdFromUrl || '',
  });

  const { data: changeOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['changeOrders'],
    queryFn: () => base44.entities.ChangeOrder.list('-created_date'),
    refetchOnMount: 'always', // Added for auto-update
    refetchOnWindowFocus: true, // Added for auto-update
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  // Auto-refetch every 10 seconds to catch updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Refetch when window regains focus
  React.useEffect(() => {
    const handleFocus = () => {
      refetch();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

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
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            number: { type: "string" },
            reason: { type: "string" },
            description: { type: "string" },
            cost_impact: { type: "number" },
            schedule_impact_days: { type: "number" },
            requested_by: { type: "string" }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const data = result.output;
        
        setFormData((prevFormData) => ({
          ...prevFormData,
          number: data.number || prevFormData.number,
          reason: data.reason || prevFormData.reason,
          description: data.description || prevFormData.description,
          cost_impact: data.cost_impact || prevFormData.cost_impact,
          schedule_impact_days: data.schedule_impact_days || prevFormData.schedule_impact_days,
          requested_by: data.requested_by || prevFormData.requested_by,
          attachments: [...(prevFormData.attachments || []), file_url]
        }));

        alert('Change Order data extracted successfully! Please review and adjust as needed.');
      } else {
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

  const handleRemoveAttachment = (index) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      attachments: prevFormData.attachments.filter((_, i) => i !== index)
    }));
  };

  // Function to reset form data, optionally using initialProjectIdFromUrl
  const resetFormData = () => {
    setFormData({
      status: 'Draft',
      cost_impact: 0,
      schedule_impact_days: 0,
      attachments: [],
      project_id: initialProjectIdFromUrl || '', // Reset project_id to URL param or empty
    });
  };

  const handleOpenCreateModal = () => {
    resetFormData(); // Reset form data when opening modal
    setShowCreateModal(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const co = await base44.entities.ChangeOrder.create(data);

      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          try {
            await base44.entities.Document.create({
              name: `Change Order ${data.number || co.id}`,
              project_id: data.project_id,
              folder: 'Change Orders',
              type: 'Change Order',
              file_url: attachment,
              linked_entity_type: 'ChangeOrder',
              linked_entity_id: co.id,
              description: `CO ${data.number} - ${formatCurrency(data.cost_impact || 0)}`
            });
          } catch (error) {
            console.error('Failed to create document entry:', error);
          }
        }
      }

      // Recalculate budget only if the change order is approved
      if (data.status === 'Approved' && data.project_id) {
        try {
          await recalculateProjectBudget(data.project_id, queryClient);
        } catch (error) {
          console.error('Failed to recalculate budget:', error);
        }
      }

      return co;
    },
    onSuccess: async () => {
      // Aggressive invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      await queryClient.refetchQueries({ queryKey: ['changeOrders'] }); // Added explicit refetch
      
      setShowCreateModal(false);
      resetFormData(); // Reset form after successful creation
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const columns = [
    {
      key: 'number',
      label: 'Number',
      render: (co) => co.number || `CO-${co.id?.slice(0, 8)}`
    },
    {
      key: 'project',
      label: 'Project',
      render: (co) => {
        const project = projects.find(p => p.id === co.project_id);
        return project?.name || '-';
      }
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (co) => co.reason || '-'
    },
    {
      key: 'cost_impact',
      label: 'Cost Impact',
      render: (co) => formatCurrency(co.cost_impact || 0)
    },
    {
      key: 'schedule_impact',
      label: 'Schedule Impact',
      render: (co) => co.schedule_impact_days ? `${co.schedule_impact_days} days` : '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (co) => <StatusBadge status={co.status} />
    },
    {
      key: 'date',
      label: 'Date',
      render: (co) => formatDate(co.created_date)
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold heading" style={{ color: '#181E18' }}>Change Orders</h2>
          <p style={{ color: '#5A7765' }} className="mt-1">Track project changes and their impact</p>
        </div>
        <Button
          onClick={handleOpenCreateModal} // Use the new handler
          className="text-white"
          style={{ backgroundColor: '#0E351F' }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Change Order
        </Button>
      </div>

      <Card className="bg-[#F5F4F3] border-[#C9C8AF]">
        <CardContent className="p-0">
          <DataTable
            data={changeOrders}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(co) => navigate(createPageUrl(`ChangeOrderDetail?id=${co.id}`))}
          />
        </CardContent>
      </Card>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading">Create Change Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Change Order Number</Label>
                <Input
                  value={formData.number || ''}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="CO-001"
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
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                      {project.name} ({project.number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason <span className="text-red-600">*</span></Label>
              <Input
                required
                value={formData.reason || ''}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="e.g., Design change, unforeseen conditions"
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
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Schedule Impact (Days)</Label>
                <Input
                  type="number"
                  value={formData.schedule_impact_days || ''}
                  onChange={(e) => setFormData({...formData, schedule_impact_days: parseInt(e.target.value) || 0})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label>Requested By</Label>
              <Input
                value={formData.requested_by || ''}
                onChange={(e) => setFormData({...formData, requested_by: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Name or company"
              />
            </div>

            {/* Attachments with Smart/Manual Upload */}
            <Card className="bg-white border-[#C9C8AF]">
              <CardHeader>
                <CardTitle className="text-lg heading">Attachments & Document Upload</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        Upload a change order PDF or image and we'll automatically extract the data for you.
                      </p>
                      <input
                        type="file"
                        onChange={handleSmartUpload}
                        className="hidden"
                        id="smart-co-upload"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={smartUploading}
                      />
                      <label htmlFor="smart-co-upload">
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
                        id="manual-co-upload"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                        disabled={uploadingFile}
                      />
                      <label htmlFor="manual-co-upload">
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  resetFormData(); // Reset form on cancel
                }}
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
                {createMutation.isPending ? 'Creating...' : 'Create Change Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
