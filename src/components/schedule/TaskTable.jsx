import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ArrowUpDown } from "lucide-react";
import { formatDate } from "../shared/DateFormatter";

export default function TaskTable({ tasks, onEdit, onDelete, onUpdate, getResponsiblePartyName, isLoading }) {
  const [sortConfig, setSortConfig] = React.useState({ key: 'start_date', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTasks = React.useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle dates
      if (sortConfig.key === 'start_date' || sortConfig.key === 'finish_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      // Handle numbers
      if (sortConfig.key === 'duration_days' || sortConfig.key === 'percent_complete') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      // Handle strings (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [tasks, sortConfig]);

  const SortableHeader = ({ label, sortKey }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === sortKey ? 'text-[#1B4D3E]' : 'text-gray-400'}`} />
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-12 text-center">
          <p className="text-gray-600">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Task List</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <p className="text-gray-600">No tasks yet. Click "Add Task" to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle>Task List</CardTitle>
          <p className="text-sm text-gray-600">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F4F3] border-b border-gray-300">
              <tr>
                <SortableHeader label="Task Name" sortKey="name" />
                <SortableHeader label="Start Date" sortKey="start_date" />
                <SortableHeader label="Finish Date" sortKey="finish_date" />
                <SortableHeader label="Duration" sortKey="duration_days" />
                <SortableHeader label="% Complete" sortKey="percent_complete" />
                <SortableHeader label="Responsible Party" sortKey="responsible_party_id" />
                <SortableHeader label="Trade" sortKey="trade" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Critical</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Predecessors</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedTasks.map((task) => (
                <tr 
                  key={task.id} 
                  className={`hover:bg-gray-50 transition-colors ${task.critical ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{task.name}</p>
                      {task.notes && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {task.start_date ? formatDate(task.start_date, 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {task.finish_date ? formatDate(task.finish_date, 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-900 text-center">
                    {task.duration_days || 0}d
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#1B4D3E] h-2 rounded-full transition-all"
                          style={{ width: `${task.percent_complete || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-900 w-10 text-right">
                        {task.percent_complete || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {getResponsiblePartyName(task)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {task.trade || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {task.critical && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Critical
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {task.predecessor_task_ids && task.predecessor_task_ids.length > 0 ? (
                      <span>{task.predecessor_task_ids.length} predecessor{task.predecessor_task_ids.length !== 1 ? 's' : ''}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(task)}
                        className="h-8 w-8 text-gray-600 hover:text-[#1B4D3E]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this task?')) {
                            onDelete(task.id);
                          }
                        }}
                        className="h-8 w-8 text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}