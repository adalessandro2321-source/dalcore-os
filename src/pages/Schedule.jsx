
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Edit, Trash2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDate } from "../components/shared/DateFormatter";
import TaskModal from "../components/schedule/TaskModal";

export default function Schedule() {
  const [editingTask, setEditingTask] = React.useState(null);
  const [showTaskModal, setShowTaskModal] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: allTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['allTasks'],
    queryFn: () => base44.entities.Task.list('start_date'),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, taskData }) => base44.entities.Task.update(id, taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowTaskModal(false);
      setEditingTask(null);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => base44.entities.Task.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetchProjects();
      refetchTasks();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchProjects, refetchTasks]);

  // Refresh when window gains focus
  React.useEffect(() => {
    const handleFocus = () => {
      refetchProjects();
      refetchTasks();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchProjects, refetchTasks]);

  const activeProjects = projects.filter(p => 
    ['Planning', 'Bidding', 'Active'].includes(p.status)
  );

  const upcomingTasks = allTasks
    .filter(task => {
      const startDate = new Date(task.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return startDate >= today && task.percent_complete < 100;
    })
    .slice(0, 10);

  const criticalTasks = allTasks.filter(task => task.critical && task.percent_complete < 100);

  const overdueTasks = allTasks.filter(task => {
    const finishDate = new Date(task.finish_date || task.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return finishDate < today && task.percent_complete < 100;
  });

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const handleMarkComplete = (task) => {
    updateTaskMutation.mutate({
      id: task.id,
      taskData: { percent_complete: 100 }
    });
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleDeleteTask = (task) => {
    const confirmed = confirm(`Are you sure you want to delete task "${task.name}"?`);
    if (confirmed) {
      deleteTaskMutation.mutate(task.id);
    }
  };

  const handleSaveTask = (taskData) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, taskData });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Master Schedule</h2>
        <p className="text-gray-600 mt-1">Overview of all project schedules</p>
        <p className="text-xs text-gray-500 mt-1">Auto-refreshes every 30 seconds</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Upcoming Tasks</p>
                <p className="text-3xl font-bold text-gray-900">{upcomingTasks.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Critical Path Tasks</p>
                <p className="text-3xl font-bold text-red-600">{criticalTasks.length}</p>
              </div>
              <Clock className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Overdue Tasks</p>
                <p className="text-3xl font-bold text-orange-600">{overdueTasks.length}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeProjects.length === 0 ? (
              <div className="p-6 text-center text-gray-600">
                No active projects
              </div>
            ) : (
              <div className="divide-y divide-gray-300">
                {activeProjects.map((project) => {
                  const projectTasks = allTasks.filter(t => t.project_id === project.id);
                  const completedTasks = projectTasks.filter(t => t.percent_complete === 100).length;
                  
                  return (
                    <Link
                      key={project.id}
                      to={createPageUrl(`ProjectDetail?id=${project.id}`) + '#schedule'}
                      className="block p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{project.name}</h4>
                        <span className="text-sm text-gray-600">
                          {completedTasks}/{projectTasks.length} tasks complete
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Start: {formatDate(project.start_date)}</span>
                        <span>•</span>
                        <span>Target: {formatDate(project.target_completion_date)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <CardTitle>Upcoming Tasks (Next 10)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingTasks.length === 0 ? (
              <div className="p-6 text-center text-gray-600">
                No upcoming tasks
              </div>
            ) : (
              <div className="divide-y divide-gray-300">
                {upcomingTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={createPageUrl(`ProjectDetail?id=${task.project_id}`) + '#schedule'}
                    className="block p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{task.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {getProjectName(task.project_id)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                          <span>Start: {formatDate(task.start_date)}</span>
                          {task.finish_date && (
                            <>
                              <span>•</span>
                              <span>Finish: {formatDate(task.finish_date)}</span>
                            </>
                          )}
                          {task.critical && (
                            <>
                              <span>•</span>
                              <span className="text-red-600 font-medium">Critical</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {overdueTasks.length > 0 && (
        <Card className="bg-[#F5F4F3] border-gray-200 border-l-4 border-l-orange-600">
          <CardHeader className="border-b border-gray-300">
            <CardTitle className="text-orange-600">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-300">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      to={createPageUrl(`ProjectDetail?id=${task.project_id}`) + '#schedule'}
                      className="flex-1"
                    >
                      <h4 className="font-medium text-gray-900">{task.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {getProjectName(task.project_id)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-orange-600 font-medium">
                          Due: {formatDate(task.finish_date || task.start_date)}
                        </span>
                        <span className="text-gray-600">
                          {task.percent_complete}% complete
                        </span>
                        {task.critical && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 font-medium">Critical</span>
                          </>
                        )}
                      </div>
                    </Link>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          handleMarkComplete(task);
                        }}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        title="Mark as complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          handleEditTask(task);
                        }}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        title="Edit task"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteTask(task);
                        }}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Edit Modal */}
      {showTaskModal && editingTask && (
        <TaskModal
          task={editingTask}
          projectId={editingTask.project_id}
          tasks={allTasks.filter(t => t.project_id === editingTask.project_id)}
          companies={companies}
          users={users}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}
