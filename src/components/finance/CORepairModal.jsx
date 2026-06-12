import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Wrench, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "../shared/DateFormatter";

/**
 * CORepairModal — lets you find MaterialCost records that are NOT linked to any change order,
 * then bulk-assign them to an existing CO. Used to retroactively fix reconciliation imports
 * where the CO assignment didn't save.
 */
export default function CORepairModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = React.useState('');
  const [selectedCO, setSelectedCO] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: allChangeOrders = [] } = useQuery({
    queryKey: ['allChangeOrders'],
    queryFn: () => base44.entities.ChangeOrder.list(),
    enabled: open,
  });

  const { data: materialCosts = [], isLoading: costsLoading } = useQuery({
    queryKey: ['materialCosts', selectedProject],
    queryFn: () => base44.entities.MaterialCost.filter({ project_id: selectedProject }, '-date'),
    enabled: !!selectedProject,
  });

  // Only show costs that have NO change_order_id assigned
  const unlinkedCosts = materialCosts.filter(c => !c.change_order_id);

  const projectChangeOrders = allChangeOrders.filter(
    co => co.project_id === selectedProject
  );

  const toggleAll = () => {
    if (selectedIds.size === unlinkedCosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinkedCosts.map(c => c.id)));
    }
  };

  const toggle = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleApply = async () => {
    if (!selectedCO || selectedIds.size === 0) return;
    setSaving(true);

    try {
      const co = allChangeOrders.find(c => c.id === selectedCO);
      if (!co) throw new Error('Change order not found');

      const costsToApply = unlinkedCosts.filter(c => selectedIds.has(c.id));

      // 1. Update each MaterialCost record with the CO link
      await Promise.all(
        costsToApply.map(c =>
          base44.entities.MaterialCost.update(c.id, { change_order_id: selectedCO })
        )
      );

      // 2. Build new line items for the CO
      const newLineItems = costsToApply.map(c => ({
        type: 'Addition',
        description: `${c.transaction}${c.description ? ' - ' + c.description : ''}`,
        quantity: 1,
        unit_cost: 0,
        material_cost: parseFloat(c.amount) || 0,
        labor_hours: 0,
        total: parseFloat(c.amount) || 0,
        notes: c.notes || ''
      }));

      const existingLineItems = co.line_items || [];
      const allLineItems = [...existingLineItems, ...newLineItems];
      const newSubtotal = allLineItems.reduce(
        (sum, li) => sum + (li.type === 'Credit' ? -(li.total || 0) : (li.total || 0)),
        0
      );

      // 3. Update the CO with appended line items
      await base44.entities.ChangeOrder.update(selectedCO, {
        line_items: allLineItems,
        subtotal: newSubtotal,
        cost_impact: newSubtotal
      });

      queryClient.invalidateQueries({ queryKey: ['materialCosts', selectedProject] });
      queryClient.invalidateQueries({ queryKey: ['allChangeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', selectedProject] });

      setDone(true);
      setSelectedIds(new Set());
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedProject('');
    setSelectedCO('');
    setSelectedIds(new Set());
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#F5F4F3] border-[#C9C8AF] text-[#181E18] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-600" />
            Repair: Apply Costs to Change Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
            <p className="text-sm text-orange-800">
              Use this to retroactively link already-imported MaterialCost records to a Change Order. Select the project, pick the CO, check the costs, and hit Apply.
            </p>
          </div>

          {/* Step 1: Project */}
          <div>
            <label className="text-sm font-medium text-[#5A7765] mb-1 block">1. Select Project</label>
            <Select value={selectedProject} onValueChange={v => { setSelectedProject(v); setSelectedCO(''); setSelectedIds(new Set()); setDone(false); }}>
              <SelectTrigger className="bg-white border-[#C9C8AF]">
                <SelectValue placeholder="Choose a project..." />
              </SelectTrigger>
              <SelectContent>
                {allProjects.filter(p => p.status !== 'Closed').map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.number ? `${p.number} - ` : ''}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Change Order */}
          {selectedProject && (
            <div>
              <label className="text-sm font-medium text-[#5A7765] mb-1 block">2. Select Change Order to Apply To</label>
              {projectChangeOrders.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No change orders found for this project.</p>
              ) : (
                <Select value={selectedCO} onValueChange={setSelectedCO}>
                  <SelectTrigger className="bg-white border-[#C9C8AF]">
                    <SelectValue placeholder="Choose a change order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectChangeOrders.map(co => (
                      <SelectItem key={co.id} value={co.id}>
                        {co.number ? `CO# ${co.number} — ` : ''}{co.reason} ({co.status}) · {formatCurrency(co.cost_impact || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Step 3: Costs to apply */}
          {selectedProject && selectedCO && (
            <div>
              <label className="text-sm font-medium text-[#5A7765] mb-2 block">
                3. Select Costs to Apply ({unlinkedCosts.length} unlinked costs)
              </label>
              {costsLoading ? (
                <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
              ) : unlinkedCosts.length === 0 ? (
                <div className="p-6 text-center text-gray-500 bg-white border border-[#C9C8AF] rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  All costs for this project are already linked to a change order.
                </div>
              ) : (
                <div className="bg-white border border-[#C9C8AF] rounded-lg overflow-hidden">
                  {/* Select all header */}
                  <div className="px-4 py-2 bg-[#F5F4F3] border-b border-[#C9C8AF] flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.size === unlinkedCosts.length && unlinkedCosts.length > 0}
                      onCheckedChange={toggleAll}
                      className="data-[state=checked]:bg-[#0E351F] data-[state=checked]:border-[#0E351F]"
                    />
                    <span className="text-xs font-semibold text-[#181E18] uppercase">
                      Select All ({selectedIds.size} selected · {formatCurrency(
                        unlinkedCosts.filter(c => selectedIds.has(c.id)).reduce((s, c) => s + (c.amount || 0), 0)
                      )})
                    </span>
                  </div>
                  <div className="divide-y divide-[#C9C8AF] max-h-64 overflow-y-auto">
                    {unlinkedCosts.map(cost => (
                      <div key={cost.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${selectedIds.has(cost.id) ? 'bg-green-50' : ''}`}>
                        <Checkbox
                          checked={selectedIds.has(cost.id)}
                          onCheckedChange={() => toggle(cost.id)}
                          className="data-[state=checked]:bg-[#0E351F] data-[state=checked]:border-[#0E351F]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#181E18] truncate">{cost.transaction}</p>
                          <p className="text-xs text-[#5A7765]">
                            {formatDate(cost.date)} · {cost.item} {cost.description ? `· ${cost.description}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#181E18]">{formatCurrency(cost.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                Successfully applied {selectedIds.size > 0 ? 'costs' : 'all selected costs'} to the change order!
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="border-[#C9C8AF] text-[#5A7765]">
              Close
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedIds.size === 0 || !selectedCO || saving}
              className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</> : `Apply ${selectedIds.size} Cost${selectedIds.size !== 1 ? 's' : ''} to CO`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}