import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, differenceInDays, addDays, min, max } from "date-fns";

export default function GanttChart({ tasks, onTaskUpdate, showCriticalPath }) {
  if (tasks.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Gantt Chart</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <p className="text-gray-600">No tasks to display</p>
        </CardContent>
      </Card>
    );
  }

  // Parse dates properly - add T12:00:00 to avoid timezone issues
  const dates = tasks.flatMap(task => {
    const start = task.start_date ? new Date(task.start_date + 'T12:00:00') : null;
    const finish = task.finish_date ? new Date(task.finish_date + 'T12:00:00') : null;
    return [start, finish].filter(d => d && !isNaN(d.getTime()));
  });

  if (dates.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Gantt Chart</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <p className="text-gray-600">No valid dates to display</p>
        </CardContent>
      </Card>
    );
  }

  const projectStart = min(dates);
  const projectEnd = max(dates);
  const totalDays = differenceInDays(projectEnd, projectStart) + 1;

  // Generate time scale (weeks or months depending on duration)
  const timeScale = [];
  if (totalDays <= 90) {
    // Show weeks
    let currentDate = new Date(projectStart);
    while (currentDate <= projectEnd) {
      timeScale.push({
        label: format(currentDate, 'MMM d'),
        date: new Date(currentDate)
      });
      currentDate = addDays(currentDate, 7);
    }
  } else {
    // Show months
    let currentDate = new Date(projectStart);
    while (currentDate <= projectEnd) {
      timeScale.push({
        label: format(currentDate, 'MMM yyyy'),
        date: new Date(currentDate)
      });
      currentDate = addDays(currentDate, 30);
    }
  }

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <CardTitle>Gantt Chart</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Timeline Header */}
            <div className="flex mb-4 pb-2 border-b border-gray-300">
              <div className="w-48 flex-shrink-0"></div>
              <div className="flex-1 flex">
                {timeScale.map((scale, idx) => (
                  <div key={idx} className="flex-1 text-xs text-gray-600 text-center">
                    {scale.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Task Bars */}
            <div className="space-y-3">
              {tasks.map((task) => {
                const taskStart = new Date(task.start_date + 'T12:00:00');
                const taskFinish = new Date((task.finish_date || task.start_date) + 'T12:00:00');
                
                // Calculate position and width
                const startOffset = differenceInDays(taskStart, projectStart);
                const taskDuration = differenceInDays(taskFinish, taskStart) + 1;
                const leftPercent = (startOffset / totalDays) * 100;
                const widthPercent = (taskDuration / totalDays) * 100;

                const barColor = task.critical 
                  ? 'bg-red-500' 
                  : task.percent_complete === 100 
                    ? 'bg-green-500' 
                    : 'bg-[#1B4D3E]';

                return (
                  <div key={task.id} className="flex items-center">
                    <div className="w-48 flex-shrink-0 pr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
                      <p className="text-xs text-gray-600">
                        {format(taskStart, 'MMM d')} - {format(taskFinish, 'MMM d')}
                      </p>
                    </div>
                    <div className="flex-1 relative h-8 bg-gray-100 rounded">
                      <div
                        className={`absolute h-full rounded ${barColor} transition-all group cursor-pointer`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${Math.max(widthPercent, 1)}%`,
                        }}
                        title={`${task.name}: ${format(taskStart, 'MMM d, yyyy')} - ${format(taskFinish, 'MMM d, yyyy')} (${taskDuration} days)`}
                      >
                        <div className="h-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium px-2 truncate">
                            {task.percent_complete}%
                          </span>
                        </div>
                        {task.percent_complete > 0 && task.percent_complete < 100 && (
                          <div
                            className="absolute top-0 left-0 h-full bg-white/30 rounded-l"
                            style={{ width: `${task.percent_complete}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-300 flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#1B4D3E] rounded"></div>
                <span className="text-gray-600">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-600">Completed</span>
              </div>
              {showCriticalPath && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-gray-600">Critical Path</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}