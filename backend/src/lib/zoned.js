// Local wall-clock times in any IANA time zone, with only the built-in Intl API. Classes are set
// as "4:00pm on Tuesdays in America/Los_Angeles"; these turn that into real instants, correctly
// on either side of a daylight-saving change.

const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
      })
    );
  }
  return formatters.get(timeZone);
}

function isTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The date, weekday and minute of day an instant falls on in a time zone.
function localParts(date, timeZone) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(date).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS.indexOf(p.weekday),
    minute: Number(p.hour) * 60 + Number(p.minute),
    second: Number(p.second),
  };
}

// How far a zone is ahead of UTC at an instant, in milliseconds.
function offsetAt(date, timeZone) {
  const p = localParts(date, timeZone);
  const [y, m, d] = p.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, Math.floor(p.minute / 60), p.minute % 60, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// The instant a local date and minute of day happen in a zone. A time that doesn't exist (skipped
// when clocks go forward) lands just after the gap; one that happens twice takes the first.
function toInstant(dateString, minute, timeZone) {
  const [y, m, d] = dateString.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, Math.floor(minute / 60), minute % 60);
  let guess = new Date(wall - offsetAt(new Date(wall), timeZone));
  // Once more, in case the first guess crossed the change.
  guess = new Date(wall - offsetAt(guess, timeZone));
  return guess;
}

function isDateString(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Calendar arithmetic on "YYYY-MM-DD" strings, independent of any zone.
function addDays(dateString, days) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

module.exports = { isTimeZone, localParts, toInstant, isDateString, addDays, weekdayOf };
