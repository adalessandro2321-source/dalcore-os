import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, description } = await req.json();

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Get existing event first
    const getResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!getResponse.ok) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingEvent = await getResponse.json();

    // Update with new description (follow-up notes)
    const updatedEvent = {
      ...existingEvent,
      description: description,
    };

    const updateResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      return Response.json({ error: 'Failed to update event', details: error }, { status: updateResponse.status });
    }

    const data = await updateResponse.json();
    return Response.json({ event: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});