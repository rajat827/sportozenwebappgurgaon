export function calculateEndTime(start, durationMinutes) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start || '')) return null;
  const [hours, minutes] = start.split(':').map(Number);
  const total = hours * 60 + minutes + Number(durationMinutes);
  if (!Number.isFinite(total) || total < 0) return null;
  return {
    time: `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    nextDay: total >= 1440
  };
}

export function composeMessage(venue, preference, reference) {
  const parts = [
    `Hi Sportozen, I would like to book ${preference.sport} at ${venue.name}, ${venue.locality || venue.city || 'Gurugram'}.`,
    `Venue ID: ${venue.id}`
  ];
  if (reference) parts.push(`Enquiry reference: ${reference}`);
  parts.push(
    `Preferred date: ${preference.preferredDate || 'Please share available dates'}`,
    `Start time: ${preference.preferredStartTime || 'Please share available slots'}`,
    `End time: ${preference.preferredEndTime ? `${preference.preferredEndTime}${preference.endNextDay ? ' (next day)' : ''}` : 'Please share available slots'}`,
    `Duration: ${preference.durationMinutes} minutes`,
    'Please confirm availability, total price, and cancellation terms. This is an enquiry, not a confirmed booking.'
  );
  return parts.join('\n');
}
