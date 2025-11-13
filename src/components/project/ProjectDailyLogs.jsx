
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Trash2, Eye, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "../shared/DateFormatter";

export default function ProjectDailyLogs({ projectId, projectName }) {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showViewModal, setShowViewModal] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState(null);
  const [editingLog, setEditingLog] = React.useState(null);
  const [formData, setFormData] = React.useState({
    log_date: formatDate(new Date(), 'yyyy-MM-dd'),
    subcontractors: [],
    equipment_materials: [''],
    inspections_meetings: [''],
    safety_issues: false,
    injuries_accidents: false,
    work_performed: '',
    safety_issues_description: '',
    injuries_accidents_description: '',
    issues_delays: '',
    notes_next_steps: '',
    weather: '',
    temperature: '',
  });
  const queryClient = useQueryClient();

  const { data: dailyLogs = [], isLoading } = useQuery({
    queryKey: ['dailyLogs', projectId],
    queryFn: () => base44.entities.DailyLog.filter({ project_id: projectId }, '-log_date'),
    enabled: !!projectId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Filter for subcontractors only
  const subcontractors = companies.filter(c => c.type === 'Subcontractor');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DailyLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs', projectId] });
      setShowCreateModal(false);
      setEditingLog(null); // Clear editing state after create
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DailyLog.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs', projectId] });
      setShowCreateModal(false);
      setEditingLog(null); // Clear editing state after update
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (logId) => base44.entities.DailyLog.delete(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLogs', projectId] });
    },
  });

  const resetForm = () => {
    setFormData({
      log_date: formatDate(new Date(), 'yyyy-MM-dd'),
      subcontractors: [],
      equipment_materials: [''],
      inspections_meetings: [''],
      safety_issues: false,
      injuries_accidents: false,
      work_performed: '',
      safety_issues_description: '',
      injuries_accidents_description: '',
      issues_delays: '',
      notes_next_steps: '',
      weather: '',
      temperature: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const cleanedData = {
      ...formData,
      project_id: projectId,
      prepared_by: currentUser?.email || '',
      equipment_materials: formData.equipment_materials.filter(item => item.trim()),
      inspections_meetings: formData.inspections_meetings.filter(item => item.trim()),
      // Only include description fields if their corresponding checkbox is true
      safety_issues_description: formData.safety_issues ? formData.safety_issues_description : undefined,
      injuries_accidents_description: formData.injuries_accidents ? formData.injuries_accidents_description : undefined,
    };

    if (editingLog) {
      updateMutation.mutate({ id: editingLog.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setFormData({
      log_date: log.log_date || formatDate(new Date(), 'yyyy-MM-dd'),
      subcontractors: log.subcontractors || [],
      equipment_materials: log.equipment_materials?.length > 0 ? log.equipment_materials : [''],
      inspections_meetings: log.inspections_meetings?.length > 0 ? log.inspections_meetings : [''],
      safety_issues: log.safety_issues || false,
      injuries_accidents: log.injuries_accidents || false,
      work_performed: log.work_performed || '',
      safety_issues_description: log.safety_issues_description || '',
      injuries_accidents_description: log.injuries_accidents_description || '',
      issues_delays: log.issues_delays || '',
      notes_next_steps: log.notes_next_steps || '',
      weather: log.weather || '',
      temperature: log.temperature || '',
    });
    setShowCreateModal(true);
  };

  const addSubcontractor = () => {
    setFormData({
      ...formData,
      subcontractors: [...formData.subcontractors, { name: '', trade: '', num_workers: 0, work_performed: '' }]
    });
  };

  const removeSubcontractor = (index) => {
    setFormData({
      ...formData,
      subcontractors: formData.subcontractors.filter((_, i) => i !== index)
    });
  };

  const updateSubcontractor = (index, field, value) => {
    const updated = [...formData.subcontractors];
    updated[index] = { ...updated[index], [field]: value };
    
    // If name is being updated, auto-fill trade from the selected company
    if (field === 'name') {
      const selectedCompany = subcontractors.find(s => s.name === value);
      if (selectedCompany) {
        updated[index].trade = selectedCompany.trade || '';
      }
    }
    
    setFormData({ ...formData, subcontractors: updated });
  };

  const addEquipmentItem = () => {
    setFormData({
      ...formData,
      equipment_materials: [...formData.equipment_materials, '']
    });
  };

  const updateEquipmentItem = (index, value) => {
    const updated = [...formData.equipment_materials];
    updated[index] = value;
    setFormData({ ...formData, equipment_materials: updated });
  };

  const addInspectionItem = () => {
    setFormData({
      ...formData,
      inspections_meetings: [...formData.inspections_meetings, '']
    });
  };

  const updateInspectionItem = (index, value) => {
    const updated = [...formData.inspections_meetings];
    updated[index] = value;
    setFormData({ ...formData, inspections_meetings: updated });
  };

  return (
    <>
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardHeader className="border-b border-gray-300">
          <div className="flex items-center justify-between">
            <CardTitle>Daily Logs</CardTitle>
            <Button
              onClick={() => {
                setEditingLog(null); // Clear editing state when creating new
                resetForm();
                setShowCreateModal(true);
              }}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Daily Log
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Loading daily logs...</p>
            </div>
          ) : dailyLogs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-gray-600 mb-4">No daily logs yet for this project.</p>
              <Button
                onClick={() => {
                  setEditingLog(null); // Clear editing state when creating first
                  resetForm();
                  setShowCreateModal(true);
                }}
                variant="outline"
                className="border-gray-300 text-gray-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Daily Log
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-300">
              {dailyLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-[#EBEAE8] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {formatDate(log.log_date, 'EEEE, MMMM d, yyyy')}
                        </h4>
                        {log.safety_issues && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-600 rounded-full">
                            Safety Issue
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{log.work_performed}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span>By {log.prepared_by}</span>
                        {log.subcontractors?.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{log.subcontractors.length} subcontractors</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(log)}
                        className="text-gray-600 hover:text-[#1B4D3E]"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedLog(log);
                          setShowViewModal(true);
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(log.id)}
                        className="text-gray-600 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) {
          setEditingLog(null); // Clear editing state when modal closes
          resetForm();
        }
      }}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingLog ? 'Edit' : 'Create New'} Daily Log - {projectName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date */}
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={formData.log_date || ''}
                onChange={(e) => setFormData({...formData, log_date: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            {/* 1. Work Performed */}
            <div className="space-y-2">
              <Label className="text-lg font-semibold">1. Work Performed Today</Label>
              <p className="text-sm text-gray-600">Briefly describe tasks completed today</p>
              <Textarea
                required
                value={formData.work_performed || ''}
                onChange={(e) => setFormData({...formData, work_performed: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            {/* 2. Subcontractors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-semibold">2. Subcontractors On-Site</Label>
                  {subcontractors.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      No subcontractors in system. Add subcontractors in the Companies page first.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubcontractor}
                  className="border-gray-300 text-gray-700"
                  disabled={subcontractors.length === 0}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Subcontractor
                </Button>
              </div>
              
              {formData.subcontractors.map((sub, index) => (
                <Card key={index} className="bg-white border-gray-300">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Subcontractor Name</Label>
                        <Select
                          value={sub.name}
                          onValueChange={(value) => updateSubcontractor(index, 'name', value)}
                        >
                          <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                            <SelectValue placeholder="Select subcontractor" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-300 max-h-60">
                            {subcontractors.map((company) => (
                              <SelectItem key={company.id} value={company.name}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Trade</Label>
                        <Input
                          value={sub.trade}
                          onChange={(e) => updateSubcontractor(index, 'trade', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900"
                          placeholder="e.g., Electrical, Plumbing"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm"># of Workers</Label>
                        <Input
                          type="number"
                          value={sub.num_workers}
                          onChange={(e) => updateSubcontractor(index, 'num_workers', parseInt(e.target.value, 10) || 0)}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Work Performed</Label>
                        <Input
                          value={sub.work_performed}
                          onChange={(e) => updateSubcontractor(index, 'work_performed', e.target.value)}
                          className="bg-white border-gray-300 text-gray-900"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubcontractor(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 3. Equipment & Materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">3. Equipment & Materials Used</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEquipmentItem}
                  className="border-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {formData.equipment_materials.map((item, index) => (
                <Input
                  key={index}
                  value={item}
                  onChange={(e) => updateEquipmentItem(index, e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., Crane delivered, Concrete pour for slab"
                />
              ))}
            </div>

            {/* 4. Inspections & Meetings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">4. Inspections & Meetings</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInspectionItem}
                  className="border-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {formData.inspections_meetings.map((item, index) => (
                <Input
                  key={index}
                  value={item}
                  onChange={(e) => updateInspectionItem(index, e.target.value)}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., City inspector reviewed framing"
                />
              ))}
            </div>

            {/* 5. Safety & Incidents */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">5. Safety & Incidents</Label>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.safety_issues}
                    onCheckedChange={(checked) => setFormData({...formData, safety_issues: checked})}
                    id="safety_issues"
                  />
                  <Label htmlFor="safety_issues" className="text-gray-900">Were there any safety issues today?</Label>
                </div>
                
                {formData.safety_issues && (
                  <Textarea
                    value={formData.safety_issues_description || ''}
                    onChange={(e) => setFormData({...formData, safety_issues_description: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="Describe the safety issue..."
                    rows={2}
                  />
                )}

                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.injuries_accidents}
                    onCheckedChange={(checked) => setFormData({...formData, injuries_accidents: checked})}
                    id="injuries_accidents"
                  />
                  <Label htmlFor="injuries_accidents" className="text-gray-900">Any injuries or accidents?</Label>
                </div>
                
                {formData.injuries_accidents && (
                  <Textarea
                    value={formData.injuries_accidents_description || ''}
                    onChange={(e) => setFormData({...formData, injuries_accidents_description: e.target.value})}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="Describe the injury or accident..."
                    rows={2}
                  />
                )}
              </div>
            </div>

            {/* 6. Issues & Delays */}
            <div className="space-y-2">
              <Label className="text-lg font-semibold">6. Issues & Delays</Label>
              <p className="text-sm text-gray-600">Any problems that arose, delays, or unexpected events?</p>
              <Textarea
                value={formData.issues_delays || ''}
                onChange={(e) => setFormData({...formData, issues_delays: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            {/* 7. Notes & Next Steps */}
            <div className="space-y-2">
              <Label className="text-lg font-semibold">7. Notes & Next Steps</Label>
              <p className="text-sm text-gray-600">Additional comments, follow-up actions, or upcoming tasks</p>
              <Textarea
                value={formData.notes_next_steps || ''}
                onChange={(e) => setFormData({...formData, notes_next_steps: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            {/* Weather */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Weather</Label>
                <Input
                  value={formData.weather || ''}
                  onChange={(e) => setFormData({...formData, weather: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., Sunny, Rainy"
                />
              </div>
              <div>
                <Label>Temperature</Label>
                <Input
                  value={formData.temperature || ''}
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="e.g., 75°F"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingLog(null); // Clear editing state on cancel
                  resetForm();
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingLog ? 'Update Daily Log' : 'Save Daily Log'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      {selectedLog && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Daily Log - {formatDate(selectedLog.log_date, 'MMMM d, yyyy')}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">1. Work Performed Today</h3>
                <p className="text-gray-800">{selectedLog.work_performed || 'N/A'}</p>
              </div>

              {selectedLog.subcontractors?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">2. Subcontractors On-Site</h3>
                  <div className="space-y-2">
                    {selectedLog.subcontractors.map((sub, idx) => (
                      <Card key={idx} className="bg-white border-gray-300">
                        <CardContent className="p-3">
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <p className="text-gray-800">{sub.name}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Trade:</span>
                              <p className="text-gray-800">{sub.trade}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Workers:</span>
                              <p className="text-gray-800">{sub.num_workers}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Work:</span>
                              <p className="text-gray-800">{sub.work_performed}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.equipment_materials?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">3. Equipment & Materials Used</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {selectedLog.equipment_materials.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedLog.inspections_meetings?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">4. Inspections & Meetings</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {selectedLog.inspections_meetings.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-2">5. Safety & Incidents</h3>
                <div className="space-y-2 text-gray-800">
                  <p>Safety Issues: <span className={selectedLog.safety_issues ? 'text-red-600' : 'text-green-600'}>
                    {selectedLog.safety_issues ? 'Yes' : 'No'}
                  </span></p>
                  {selectedLog.safety_issues_description && (
                    <p className="text-sm pl-4">{selectedLog.safety_issues_description}</p>
                  )}
                  <p>Injuries/Accidents: <span className={selectedLog.injuries_accidents ? 'text-red-600' : 'text-green-600'}>
                    {selectedLog.injuries_accidents ? 'Yes' : 'No'}
                  </span></p>
                  {selectedLog.injuries_accidents_description && (
                    <p className="text-sm pl-4">{selectedLog.injuries_accidents_description}</p>
                  )}
                </div>
              </div>

              {selectedLog.issues_delays && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">6. Issues & Delays</h3>
                  <p className="text-gray-800">{selectedLog.issues_delays}</p>
                </div>
              )}

              {selectedLog.notes_next_steps && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">7. Notes & Next Steps</h3>
                  <p className="text-gray-800">{selectedLog.notes_next_steps}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-300">
                <div>
                  <span className="text-sm text-gray-600">Prepared By:</span>
                  <p className="text-gray-800">{selectedLog.prepared_by}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Weather:</span>
                  <p className="text-gray-800">{selectedLog.weather || 'N/A'} {selectedLog.temperature && `• ${selectedLog.temperature}`}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
