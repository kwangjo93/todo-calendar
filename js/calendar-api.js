// Google Calendar API wrapper
const CalendarAPI = (() => {

  async function listCalendars() {
    const resp = await gapi.client.calendar.calendarList.list({ minAccessRole: 'reader' });
    return resp.result.items || [];
  }

  async function listEvents(calendarId, timeMin, timeMax) {
    const resp = await gapi.client.calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    return (resp.result.items || []).map(ev => ({ ...ev, _calendarId: calendarId }));
  }

  async function listEventsForRange(calendarIds, timeMin, timeMax) {
    const results = await Promise.all(calendarIds.map(id => listEvents(id, timeMin, timeMax)));
    return results.flat();
  }

  async function createEvent(calendarId, eventBody) {
    const resp = await gapi.client.calendar.events.insert({ calendarId, resource: eventBody });
    return resp.result;
  }

  async function deleteEvent(calendarId, eventId) {
    await gapi.client.calendar.events.delete({ calendarId, eventId });
  }

  // Fetch user profile via People/Tokeninfo
  async function getUserInfo() {
    try {
      const resp = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo`,
        { headers: { Authorization: `Bearer ${Auth.getToken()}` } }
      );
      return await resp.json();
    } catch { return null; }
  }

  return { listCalendars, listEvents, listEventsForRange, createEvent, deleteEvent, getUserInfo };
})();
