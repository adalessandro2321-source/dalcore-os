
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, RefreshCw, Filter, Brain, Calendar } from "lucide-react";
import TaskTable from "./TaskTable";
import GanttChart from "./GanttChart";
import TaskModal from "./TaskModal";
import { differenceInDays, addDays, format, isValid, parseISO } from "date-fns";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import TaskAIAnalysis from "./TaskAIAnalysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectSchedule({ projectId, project }) {
  const [showTaskModal, setShowTaskModal] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);
  const [showCriticalPath, setShowCriticalPath] = React.useState(false);
  const [filterTrade, setFilterTrade] = React.useState('all');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => base44.entities.Task.filter({ project_id: projectId }, 'start_date'),
    enabled: !!projectId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
    refetchOnMount: 'always',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    refetchOnMount: 'always',
  });

  // Auto-refresh tasks every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetchTasks();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchTasks]);

  // Refresh when window gains focus
  React.useEffect(() => {
    const handleFocus = () => {
      refetchTasks();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchTasks]);

  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const task = await base44.entities.Task.create(taskData);
      await recalculateProjectSchedule();
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowTaskModal(false);
      setEditingTask(null);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, taskData }) => {
      const task = await base44.entities.Task.update(id, taskData);
      await recalculateProjectSchedule();
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowTaskModal(false);
      setEditingTask(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId) => {
      // Remove this task from any successors' predecessor lists
      const successors = tasks.filter(t => 
        t.predecessor_task_ids?.includes(taskId)
      );
      
      await Promise.all(
        successors.map(successor => 
          base44.entities.Task.update(successor.id, {
            predecessor_task_ids: successor.predecessor_task_ids.filter(id => id !== taskId)
          })
        )
      );
      
      await base44.entities.Task.delete(taskId);
      await recalculateProjectSchedule();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const recalculateProjectSchedule = async () => {
    if (!projectId || tasks.length === 0) return;

    try {
      // Calculate critical path
      const criticalPath = calculateCriticalPath(tasks);
      
      // Update critical flags
      await Promise.all(
        tasks.map(task => 
          base44.entities.Task.update(task.id, {
            critical: criticalPath.includes(task.id)
          })
        )
      );

      // Calculate project completion based on tasks (weighted by duration)
      let totalDuration = 0;
      let completedDuration = 0;
      
      tasks.forEach(task => {
        const duration = task.duration_days || 1;
        const completion = task.percent_complete || 0;
        totalDuration += duration;
        completedDuration += (duration * completion / 100);
      });
      
      const projectPercentComplete = totalDuration > 0 
        ? Math.round((completedDuration / totalDuration) * 100)
        : 0;

      // Update project dates and completion
      const startDates = tasks.map(t => new Date(t.start_date)).filter(d => !isNaN(d));
      const finishDates = tasks.map(t => new Date(t.finish_date || t.start_date)).filter(d => !isNaN(d));
      
      if (startDates.length > 0 && finishDates.length > 0) {
        const projectStartDate = format(new Date(Math.min(...startDates)), 'yyyy-MM-dd');
        const projectFinishDate = format(new Date(Math.max(...finishDates)), 'yyyy-MM-dd');

        await base44.entities.Project.update(projectId, {
          start_date: projectStartDate,
          target_completion_date: projectFinishDate,
          percent_complete: projectPercentComplete
        });
      } else {
        // Just update progress if no dates
        await base44.entities.Project.update(projectId, {
          percent_complete: projectPercentComplete
        });
      }
      
      // Invalidate project queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (error) {
      console.error('Error recalculating schedule:', error);
    }
  };

  const calculateCriticalPath = (taskList) => {
    // Simple critical path calculation - longest path through the network
    const taskMap = {};
    taskList.forEach(task => {
      taskMap[task.id] = {
        ...task,
        earliestStart: new Date(task.start_date),
        latestFinish: new Date(task.finish_date || task.start_date)
      };
    });

    // Find tasks with no successors (end tasks)
    const endTasks = taskList.filter(task => 
      !taskList.some(t => t.predecessor_task_ids?.includes(task.id))
    );

    // Calculate longest path from each end task back to start
    const longestPath = [];
    let maxDuration = 0;

    const calculatePath = (taskId, path = []) => {
      const task = taskMap[taskId];
      if (!task) return 0;

      const currentPath = [...path, taskId];
      const taskDuration = task.duration_days || 1;

      if (!task.predecessor_task_ids || task.predecessor_task_ids.length === 0) {
        const totalDuration = currentPath.reduce((sum, id) => sum + (taskMap[id]?.duration_days || 1), 0);
        if (totalDuration > maxDuration) {
          maxDuration = totalDuration;
          longestPath.length = 0;
          longestPath.push(...currentPath);
        }
        return totalDuration;
      }

      return task.predecessor_task_ids.map(predId => 
        calculatePath(predId, currentPath)
      ).reduce((max, val) => Math.max(max, val), 0) + taskDuration;
    };

    endTasks.forEach(task => calculatePath(task.id));

    return longestPath;
  };

  const handleTaskUpdate = async (taskId, updates) => {
    // Recalculate duration if dates changed
    if (updates.start_date || updates.finish_date) {
      const task = tasks.find(t => t.id === taskId);
      const startDate = updates.start_date ? new Date(updates.start_date) : new Date(task.start_date);
      const finishDate = updates.finish_date ? new Date(updates.finish_date) : new Date(task.finish_date || task.start_date);
      updates.duration_days = Math.max(1, differenceInDays(finishDate, startDate) + 1);
    }

    updateTaskMutation.mutate({ id: taskId, taskData: updates });
  };

  const handleExportCSV = () => {
    const csv = [
      ['Task Name', 'Start Date', 'Finish Date', 'Duration (days)', '% Complete', 'Responsible Party', 'Trade', 'Critical', 'Notes'],
      ...tasks.map(task => [
        task.name,
        task.start_date || '',
        task.finish_date || '',
        task.duration_days || '',
        task.percent_complete || 0,
        getResponsiblePartyName(task),
        task.trade || '',
        task.critical ? 'Yes' : 'No',
        task.notes || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.number || 'project'}_schedule_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const tasksToCreate = lines
      .filter(line => line.trim())
      .map(line => {
        const [name, start_date, finish_date, duration_days, percent_complete, , trade] = line.split(',').map(cell => 
          cell.replace(/^"|"$/g, '').trim()
        );
        
        // Safely parse dates
        let parsedStartDate = '';
        let parsedFinishDate = '';
        let startDateObj = null;
        
        if (start_date) {
          const dateObj = parseISO(start_date);
          if (isValid(dateObj)) {
            startDateObj = dateObj;
            parsedStartDate = formatDate(dateObj, 'yyyy-MM-dd');
          }
        }
        
        if (finish_date) {
          const dateObj = parseISO(finish_date);
          if (isValid(dateObj)) {
            parsedFinishDate = formatDate(dateObj, 'yyyy-MM-dd');
          }
        } else if (parsedStartDate && duration_days && startDateObj) {
          // Calculate finish date from start + duration if finish_date is missing or invalid
          const duration = parseInt(duration_days);
          if (!isNaN(duration)) {
            const calculatedFinishDateObj = addDays(startDateObj, duration);
            parsedFinishDate = formatDate(calculatedFinishDateObj, 'yyyy-MM-dd');
          }
        }
        
        return {
          project_id: projectId,
          name,
          start_date: parsedStartDate || null, // Ensure null if invalid/empty
          finish_date: parsedFinishDate || null, // Ensure null if invalid/empty
          duration_days: parseInt(duration_days) || 1,
          percent_complete: parseInt(percent_complete) || 0,
          trade
        };
      });

    await base44.entities.Task.bulkCreate(tasksToCreate);
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    await recalculateProjectSchedule();
  };

  const getResponsiblePartyName = (task) => {
    if (!task.responsible_party_id) return '-';
    
    if (task.responsible_party_type === 'User') {
      const user = users.find(u => u.email === task.responsible_party_id);
      return user?.full_name || task.responsible_party_id;
    } else {
      const company = companies.find(c => c.id === task.responsible_party_id);
      return company?.name || task.responsible_party_id;
    }
  };

  const filteredTasks = filterTrade === 'all' 
    ? tasks 
    : tasks.filter(t => t.trade === filterTrade);

  const trades = [...new Set(tasks.map(t => t.trade).filter(Boolean))];

  return (
    <Tabs defaultValue="schedule" className="space-y-6">
      <TabsList className="bg-[#F5F4F3] border border-gray-200">
        <TabsTrigger value="schedule" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
          <Calendar className="w-4 h-4 mr-2" />
          Schedule View
        </TabsTrigger>
        <TabsTrigger value="ai-insights" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
          <Brain className="w-4 h-4 mr-2" />
          AI Insights
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="space-y-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>

            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button
                as="span"
                variant="outline"
                className="border-gray-300 text-gray-700 cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </label>

            <Button
              onClick={recalculateProjectSchedule}
              variant="outline"
              className="border-gray-300 text-gray-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recalculate
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterTrade}
              onChange={(e) => setFilterTrade(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900"
            >
              <option value="all">All Trades</option>
              {trades.map(trade => (
                <option key={trade} value={trade}>{trade}</option>
              ))}
            </select>

            <Button
              onClick={() => setShowCriticalPath(!showCriticalPath)}
              variant={showCriticalPath ? "default" : "outline"}
              className={showCriticalPath ? "bg-red-600 hover:bg-red-700 text-white" : "border-gray-300 text-gray-700"}
            >
              <Filter className="w-4 h-4 mr-2" />
              Critical Path
            </Button>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="border-gray-300 text-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Schedule View - Stacked Layout */}
        <div className="space-y-6">
          <TaskTable
            tasks={showCriticalPath ? filteredTasks.filter(t => t.critical) : filteredTasks}
            onEdit={(task) => {
              setEditingTask(task);
              setShowTaskModal(true);
            }}
            onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
            onUpdate={handleTaskUpdate}
            getResponsiblePartyName={getResponsiblePartyName}
            isLoading={isLoading}
          />

          <GanttChart
            tasks={showCriticalPath ? filteredTasks.filter(t => t.critical) : filteredTasks}
            onTaskUpdate={handleTaskUpdate}
            showCriticalPath={showCriticalPath}
          />
        </div>

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            task={editingTask}
            projectId={projectId}
            tasks={tasks}
            companies={companies}
            users={users}
            onClose={() => {
              setShowTaskModal(false);
              setEditingTask(null);
            }}
            onSave={(taskData) => {
              if (editingTask) {
                updateTaskMutation.mutate({ id: editingTask.id, taskData });
              } else {
                createTaskMutation.mutate(taskData);
              }
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="ai-insights">
        <TaskAIAnalysis 
          projectId={projectId} 
          project={project} 
          tasks={tasks}
          onTaskUpdate={handleTaskUpdate}
        />
      </TabsContent>
    </Tabs>
  );
}
