import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await req.json();

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Get project tasks
    const tasks = await base44.entities.Task.filter(
      projectId ? { project_id: projectId } : {}
    );

    // Get project details for context
    const projectIds = [...new Set(tasks.map(t => t.project_id))];
    const projects = await Promise.all(
      projectIds.map(id => base44.entities.Project.filter({ id }))
    );
    const projectMap = {};
    projects.flat().forEach(p => {
      projectMap[p.id] = p;
    });

    const syncedTasks = [];
    const errors = [];

    for (const task of tasks) {
      try {
        const project = projectMap[task.project_id];
        const projectName = project?.name || 'Unknown Project';

        // Check if task already synced (has a calendar event ID stored)
        if (task.calendar_event_id) {
          // Update existing event
          const event = {
            summary: `${projectName}: ${task.name}`,
            description: task.description || '',
            start: {
              date: task.start_date,
            },
            end: {
              date: task.finish_date || task.start_date,
            },
          };

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.calendar_event_id}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event),
            }
          );

          if (response.ok) {
            syncedTasks.push({ taskId: task.id, action: 'updated' });
          }
        } else {
          // Create new event
          const event = {
            summary: `${projectName}: ${task.name}`,
            description: task.description || '',
            start: {
              date: task.start_date,
            },
            end: {
              date: task.finish_date || task.start_date,
            },
            colorId: '9', // Blue color for project tasks
          };

          const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event),
            }
          );

          if (response.ok) {
            const data = await response.json();
            // Update task with calendar event ID
            await base44.asServiceRole.entities.Task.update(task.id, {
              calendar_event_id: data.id
            });
            syncedTasks.push({ taskId: task.id, action: 'created', eventId: data.id });
          }
        }
      } catch (error) {
        errors.push({ taskId: task.id, error: error.message });
      }
    }

    return Response.json({ 
      success: true,
      synced: syncedTasks.length,
      errors: errors.length,
      details: { syncedTasks, errors }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});