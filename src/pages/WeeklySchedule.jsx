import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  FileText,
  AlertCircle,
  Plus,
  RefreshCw
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isSameDay, addMinutes, isWithinInterval } from "date-fns";
import { getCalendarEvents } from "@/functions/getCalendarEvents";
import { createCalendarEvent } from "@/functions/createCalendarEvent";
import { updateCalendarEvent } from "@/functions/updateCalendarEvent";
import { syncProjectTasksToCalendar } from "@/functions/syncProjectTasksToCalendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WeeklySchedule() {
  const [currentWeek, setCurrentWeek] = React.useState(new Date());
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const [showNotesModal, setShowNotesModal] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [followUpNotes, setFollowUpNotes] = React.useState("");
  const [actionItems, setActionItems] = React.useState([""]);
  const [selectedProject, setSelectedProject] = React.useState('all');
  const [syncing, setSyncing] = React.useState(false);
  const queryClient = useQueryClient();

  const [newEvent, setNewEvent] = React.useState({
    summary: "",
    description: "",
    startTime: "",
    endTime: "",
    attendees: ""
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });

  const { data: calendarData, isLoading, refetch } = useQuery({
    queryKey: ['calendarEvents', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const response = await getCalendarEvents({
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString()
      });
      return response.data;
    },
  });

  const { data: calendarNotes = [] } = useQuery({
    queryKey: ['calendarNotes'],
    queryFn: () => base44.entities.CalendarNote.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks'],
    queryFn: () => base44.entities.Task.list(),
  });

  const saveNotesMutation = useMutation({
    mutationFn: async (data) => {
      const existingNote = calendarNotes.find(n => n.event_id === selectedEvent.id);
      
      if (existingNote) {
        return base44.entities.CalendarNote.update(existingNote.id, data);
      } else {
        return base44.entities.CalendarNote.create({
          event_id: selectedEvent.id,
          event_title: selectedEvent.summary,
          event_date: selectedEvent.start.dateTime || selectedEvent.start.date,
          ...data
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarNotes'] });
      setShowNotesModal(false);
      setSelectedEvent(null);
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData) => {
      const response = await createCalendarEvent(eventData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      setShowCreateModal(false);
      setNewEvent({
        summary: "",
        description: "",
        startTime: "",
        endTime: "",
        attendees: ""
      });
      refetch();
    },
  });

  const events = calendarData?.events || [];

  // Filter project tasks for the week
  const weekTasks = React.useMemo(() => {
    return allTasks.filter(task => {
      const taskStart = new Date(task.start_date);
      const taskEnd = task.finish_date ? new Date(task.finish_date) : taskStart;
      
      const overlapsWeek = taskStart <= weekEnd && taskEnd >= weekStart;
      const matchesProject = selectedProject === 'all' || task.project_id === selectedProject;
      
      return overlapsWeek && matchesProject;
    });
  }, [allTasks, weekStart, weekEnd, selectedProject]);

  const handleSyncTasks = async () => {
    setSyncing(true);
    try {
      const response = await syncProjectTasksToCalendar({
        projectId: selectedProject === 'all' ? null : selectedProject
      });
      
      if (response.data.success) {
        alert(`✅ Synced ${response.data.synced} tasks to calendar!`);
        refetch();
      }
    } catch (error) {
      alert('Failed to sync tasks: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Group events by day
  const eventsByDay = React.useMemo(() => {
    const days = {};
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayKey = format(day, 'yyyy-MM-dd');
      days[dayKey] = [];
    }

    events.forEach(event => {
      const eventDate = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date);
      const dayKey = format(eventDate, 'yyyy-MM-dd');
      if (days[dayKey]) {
        days[dayKey].push({ ...event, type: 'calendar' });
      }
    });

    // Add project tasks to the calendar view
    weekTasks.forEach(task => {
      const taskDate = new Date(task.start_date);
      const dayKey = format(taskDate, 'yyyy-MM-dd');
      if (days[dayKey]) {
        days[dayKey].push({ 
          ...task, 
          type: 'task',
          summary: task.name,
          start: { date: task.start_date },
          end: { date: task.finish_date || task.start_date }
        });
      }
    });

    // Sort events within each day
    Object.keys(days).forEach(dayKey => {
      days[dayKey].sort((a, b) => {
        const timeA = a.start.dateTime || a.start.date;
        const timeB = b.start.dateTime || b.start.date;
        return timeA.localeCompare(timeB);
      });
    });

    return days;
  }, [events, weekTasks, weekStart]);

  // Check for double bookings
  const checkDoubleBooking = (newStart, newEnd) => {
    const newStartTime = new Date(newStart);
    const newEndTime = new Date(newEnd);

    return events.some(event => {
      if (!event.start.dateTime || !event.end.dateTime) return false;
      
      const eventStart = parseISO(event.start.dateTime);
      const eventEnd = parseISO(event.end.dateTime);

      return (
        (newStartTime >= eventStart && newStartTime < eventEnd) ||
        (newEndTime > eventStart && newEndTime <= eventEnd) ||
        (newStartTime <= eventStart && newEndTime >= eventEnd)
      );
    });
  };

  const handleCreateEvent = () => {
    const hasConflict = checkDoubleBooking(newEvent.startTime, newEvent.endTime);
    
    if (hasConflict) {
      alert("⚠️ Double booking detected! This time slot conflicts with an existing event.");
      return;
    }

    const attendeesArray = newEvent.attendees
      .split(',')
      .map(email => email.trim())
      .filter(email => email);

    createEventMutation.mutate({
      summary: newEvent.summary,
      description: newEvent.description,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      attendees: attendeesArray
    });
  };

  const handleOpenNotes = (event) => {
    setSelectedEvent(event);
    const existingNote = calendarNotes.find(n => n.event_id === event.id);
    if (existingNote) {
      setFollowUpNotes(existingNote.follow_up_notes || "");
      setActionItems(existingNote.action_items || [""]);
    } else {
      setFollowUpNotes("");
      setActionItems([""]);
    }
    setShowNotesModal(true);
  };

  const handleSaveNotes = () => {
    const filteredActionItems = actionItems.filter(item => item.trim());
    saveNotesMutation.mutate({
      follow_up_notes: followUpNotes,
      action_items: filteredActionItems,
      attendees: selectedEvent.attendees?.map(a => a.email) || []
    });
  };

  const getEventNote = (eventId) => {
    return calendarNotes.find(n => n.event_id === eventId);
  };

  const getUpcomingReminders = () => {
    const now = new Date();
    const upcoming = events.filter(event => {
      if (!event.start.dateTime) return false;
      const eventStart = parseISO(event.start.dateTime);
      const reminderTime = addMinutes(eventStart, -15);
      return reminderTime > now && reminderTime <= addMinutes(now, 60);
    });
    return upcoming;
  };

  const upcomingReminders = getUpcomingReminders();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Schedule</h2>
          <p className="text-gray-600 mt-1">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.filter(p => ['Active', 'Planning'].includes(p.status)).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSyncTasks}
            disabled={syncing}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Tasks
              </>
            )}
          </Button>
          <Button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            variant="outline"
            size="icon"
            className="border-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setCurrentWeek(new Date())}
            variant="outline"
            className="border-gray-300"
          >
            Today
          </Button>
          <Button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            variant="outline"
            size="icon"
            className="border-gray-300"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-gray-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <Card className="bg-amber-50 border-amber-300">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 mb-2">Upcoming Reminders (Next Hour)</p>
                {upcomingReminders.map(event => (
                  <div key={event.id} className="text-sm text-amber-800 mb-1">
                    • {event.summary} at {format(parseISO(event.start.dateTime), 'h:mm a')}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-7 gap-4">
        {Object.entries(eventsByDay).map(([dayKey, dayEvents]) => {
          const day = parseISO(dayKey);
          const isToday = isSameDay(day, new Date());

          return (
            <Card
              key={dayKey}
              className={`border ${isToday ? 'border-[#0E351F] border-2' : 'border-gray-200'}`}
            >
              <CardHeader className={`p-3 ${isToday ? 'bg-[#E8E7DD]' : 'bg-gray-50'} border-b`}>
                <CardTitle className="text-sm">
                  <div className="font-semibold">{format(day, 'EEE')}</div>
                  <div className={`text-2xl ${isToday ? 'text-[#0E351F]' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[400px]">
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No events</p>
                ) : (
                  dayEvents.map(event => {
                    if (event.type === 'task') {
                      // Project task
                      const project = projects.find(p => p.id === event.project_id);
                      return (
                        <div
                          key={`task-${event.id}`}
                          className="p-2 bg-green-50 border border-green-200 rounded-md"
                        >
                          <div className="flex items-start gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-green-900 truncate">
                                {event.summary}
                              </p>
                              <p className="text-xs text-green-700 mt-1 truncate">
                                {project?.name || 'Unknown Project'}
                              </p>
                              {event.calendar_event_id && (
                                <Badge className="mt-1 text-xs bg-green-100 text-green-800">
                                  Synced
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Calendar event
                    const note = getEventNote(event.id);
                    const hasNotes = note?.follow_up_notes || note?.action_items?.length > 0;

                    return (
                      <div
                        key={event.id}
                        onClick={() => handleOpenNotes(event)}
                        className="p-2 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-blue-900 truncate">
                              {event.summary}
                            </p>
                            {event.start.dateTime && (
                              <p className="text-xs text-blue-700 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(event.start.dateTime), 'h:mm a')}
                              </p>
                            )}
                          </div>
                          {hasNotes && (
                            <FileText className="w-3 h-3 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notes Modal */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.summary}</DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  {selectedEvent.start.dateTime && format(parseISO(selectedEvent.start.dateTime), 'EEEE, MMMM d, yyyy h:mm a')}
                </p>
                {selectedEvent.description && (
                  <p className="text-sm text-gray-700 mb-4">{selectedEvent.description}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  Follow-up Notes
                </label>
                <Textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Add notes from this meeting..."
                  rows={6}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  Action Items
                </label>
                {actionItems.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newItems = [...actionItems];
                        newItems[index] = e.target.value;
                        setActionItems(newItems);
                      }}
                      placeholder="Action item..."
                      className="bg-white border-gray-300"
                    />
                    {index === actionItems.length - 1 && (
                      <Button
                        onClick={() => setActionItems([...actionItems, ""])}
                        variant="outline"
                        size="icon"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowNotesModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNotes}
                  className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                >
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Event Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Event Title *
              </label>
              <Input
                value={newEvent.summary}
                onChange={(e) => setNewEvent({...newEvent, summary: e.target.value})}
                placeholder="Meeting title..."
                className="bg-white border-gray-300"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Description
              </label>
              <Textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Event description..."
                rows={3}
                className="bg-white border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  Start Time *
                </label>
                <Input
                  type="datetime-local"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 mb-2 block">
                  End Time *
                </label>
                <Input
                  type="datetime-local"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Attendees (comma-separated emails)
              </label>
              <Input
                value={newEvent.attendees}
                onChange={(e) => setNewEvent({...newEvent, attendees: e.target.value})}
                placeholder="john@example.com, jane@example.com"
                className="bg-white border-gray-300"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-800">
                  Double-booking prevention is enabled. You'll be alerted if this event conflicts with existing events.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateEvent}
                disabled={!newEvent.summary || !newEvent.startTime || !newEvent.endTime}
                className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
              >
                Create Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}