import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export default function TaskModal({ task, projectId, tasks, companies, users, onClose, onSave }) {
  const [formData, setFormData] = React.useState({
    name: task?.name || '',
    description: task?.description || '',
    start_date: task?.start_date || format(new Date(), 'yyyy-MM-dd'),
    finish_date: task?.finish_date || format(new Date(), 'yyyy-MM-dd'),
    duration_days: task?.duration_days || 1,
    percent_complete: task?.percent_complete || 0,
    responsible_party_id: task?.responsible_party_id || '',
    responsible_party_type: task?.responsible_party_type || 'Company',
    trade: task?.trade || '',
    notes: task?.notes || '',
    predecessor_task_ids: task?.predecessor_task_ids || [],
  });

  const handleStartDateChange = (newStartDate) => {
    if (!newStartDate) return;
    
    const startDate = new Date(newStartDate + 'T12:00:00');
    const duration = formData.duration_days || 1;
    const finishDate = addDays(startDate, duration - 1);
    
    setFormData({
      ...formData,
      start_date: format(startDate, 'yyyy-MM-dd'),
      finish_date: format(finishDate, 'yyyy-MM-dd'),
      duration_days: duration
    });
  };

  const handleFinishDateChange = (newFinishDate) => {
    if (!newFinishDate || !formData.start_date) return;
    
    const startDate = new Date(formData.start_date + 'T12:00:00');
    const finishDate = new Date(newFinishDate + 'T12:00:00');
    const calculatedDuration = Math.max(1, differenceInDays(finishDate, startDate) + 1);
    
    setFormData({
      ...formData,
      finish_date: format(finishDate, 'yyyy-MM-dd'),
      duration_days: calculatedDuration
    });
  };

  const handleDurationChange = (newDuration) => {
    const duration = Math.max(1, parseInt(newDuration) || 1);
    
    if (!formData.start_date) return;
    
    const startDate = new Date(formData.start_date + 'T12:00:00');
    const finishDate = addDays(startDate, duration - 1);
    
    setFormData({
      ...formData,
      duration_days: duration,
      finish_date: format(finishDate, 'yyyy-MM-dd')
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      project_id: projectId,
    });
  };

  const handlePredecessorToggle = (taskId) => {
    const current = formData.predecessor_task_ids || [];
    if (current.includes(taskId)) {
      setFormData({
        ...formData,
        predecessor_task_ids: current.filter(id => id !== taskId)
      });
    } else {
      setFormData({
        ...formData,
        predecessor_task_ids: [...current, taskId]
      });
    }
  };

  const availableTasks = tasks.filter(t => t.id !== task?.id);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              placeholder="e.g., Foundation Excavation"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Start Date *</Label>
              <Input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Duration (days) *</Label>
              <Input
                type="number"
                min="1"
                required
                value={formData.duration_days}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <Label>Finish Date *</Label>
              <Input
                type="date"
                required
                value={formData.finish_date}
                onChange={(e) => handleFinishDateChange(e.target.value)}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsible Party Type</Label>
              <Select
                value={formData.responsible_party_type}
                onValueChange={(value) => setFormData({...formData, responsible_party_type: value, responsible_party_id: ''})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Company">Company</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsible Party</Label>
              <Select
                value={formData.responsible_party_id}
                onValueChange={(value) => setFormData({...formData, responsible_party_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300 max-h-60">
                  {formData.responsible_party_type === 'Company' ? (
                    companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trade</Label>
              <Input
                value={formData.trade}
                onChange={(e) => setFormData({...formData, trade: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="e.g., Concrete, Framing"
              />
            </div>
            <div>
              <Label>% Complete</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.percent_complete}
                onChange={(e) => setFormData({...formData, percent_complete: parseInt(e.target.value) || 0})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          {availableTasks.length > 0 && (
            <div>
              <Label className="mb-2 block">Predecessor Tasks</Label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                {availableTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={(formData.predecessor_task_ids || []).includes(t.id)}
                      onChange={() => handlePredecessorToggle(t.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-900">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-white border-gray-300 text-gray-900"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              {task ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}