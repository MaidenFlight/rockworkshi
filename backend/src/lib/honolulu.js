// The school schedules in Pacific/Honolulu. The database stores UTC instants; staff type
// and read local dates and times. Conversions go through Intl rather than a fixed -10:00,
// so they stay right even though Hawaii happens not to observe daylight saving.
const TZ = "Pacific/Honolulu";

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function localParts(date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

// Minutes Honolulu is ahead of UTC at that instant (negative: -600).
function offsetMinutes(date) {
  const p = localParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

// "2026-11-01" or "2026-11-01T09:30", Honolulu time, to a UTC Date. null if malformed.
function fromLocal(text) {
  const m = LOCAL_RE.exec(String(text || ""));
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const guess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (guess.getUTCMonth() !== +mo - 1 || guess.getUTCDate() !== +d) return null; // e.g. Feb 30
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000);
}

const pad = (n) => String(n).padStart(2, "0");

// UTC Date to "YYYY-MM-DDTHH:mm" in Honolulu, for date-time inputs.
function toLocal(date) {
  const p = localParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function toLocalDate(date) {
  return toLocal(date).slice(0, 10);
}

// The last millisecond of a Honolulu calendar day.
function endOfLocalDay(dateText) {
  const start = fromLocal(dateText);
  if (!start) return null;
  const next = fromLocal(addMonthsAndDays(dateText, 0, 1));
  return new Date(next.getTime() - 1);
}

// Calendar arithmetic on "YYYY-MM-DD". Months clamp to the month's last day (Jan 31 + 1 -> Feb 28).
function addMonthsAndDays(dateText, months, days = 0) {
  const [y, m, d] = dateText.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay) + days);
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

// e.g. "Sun, Nov 1, 2026, 12:00 AM HST"
function display(date) {
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)} HST`;
}

module.exports = { TZ, fromLocal, toLocal, toLocalDate, endOfLocalDay, addMonthsAndDays, display };
