// One class session as an .ics file, so a student can put it in their own calendar.
// Built in the browser from the calendar event; nothing is sent anywhere.

const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text) => String(text ?? "").replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

// Lines over 75 characters are folded onto continuation lines that start with a space (RFC 5545).
function fold(line) {
  const parts = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

export function icsFor(event, { kindLabel } = {}) {
  const about = [kindLabel, event.teacher?.name ? `with ${event.teacher.name}` : null].filter(Boolean).join(" ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rock Works School of Music//Classes//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@rockworksschoolofmusichawaii.com`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt ?? event.startsAt)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape([about, event.meetingUrl ? `Join: ${event.meetingUrl}` : null].filter(Boolean).join("\n"))}`,
    ...(event.meetingUrl ? [`URL:${escape(event.meetingUrl)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsHref(event, options) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(event, options))}`;
}
