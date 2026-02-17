/**
 * Shop open/closed logic for vendor dukaan.
 * Checks is_online, opening_hours, weekly_off, and holidays.
 */

export interface ShopDetails {
  opening_hours?: Record<string, string> | null;
  weekly_off?: string | null;
  holidays?: string[] | null;
  is_online?: boolean | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function getTodayName(): string {
  return DAY_NAMES[new Date().getDay()];
}

function parseTimeRange(range: string): { open: number; close: number } | null {
  if (!range || range.toLowerCase() === "closed") return null;
  const m = range.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const open = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const close = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  return { open, close };
}

function getMinutesSinceMidnight(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export interface ShopStatus {
  open: boolean;
  message: string;
  messageHi: string;
  messageTe: string;
  closesAt?: string;
  opensAt?: string;
  nextOpening?: string;
}

const DEFAULT_HOURS: Record<string, string> = {
  Monday: "08:00-22:00",
  Tuesday: "08:00-22:00",
  Wednesday: "08:00-22:00",
  Thursday: "08:00-22:00",
  Friday: "08:00-22:00",
  Saturday: "08:00-22:00",
  Sunday: "closed",
};

/** Format "22:00" as "10 PM" */
export function formatTimeForDisplay(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (h === 0) return `12:${m.toString().padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${m.toString().padStart(2, "0")} AM`;
  if (h === 12) return `12:${m.toString().padStart(2, "0")} PM`;
  return `${h - 12}:${m.toString().padStart(2, "0")} PM`;
}

/** Find next opening day and time */
function getNextOpening(
  openingHours: Record<string, string>,
  weeklyOff: string | null,
  holidays: string[]
): { day: string; time: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayName = DAY_NAMES[d.getDay()];
    const dateStr = d.toISOString().slice(0, 10);

    if (holidays.includes(dateStr)) continue;
    if (weeklyOff && dayName === weeklyOff) continue;

    const range = openingHours[dayName] ?? "closed";
    const parsed = parseTimeRange(range);
    if (parsed) {
      const [closeH] = range.split("-")[1]?.split(":") ?? ["22"];
      return {
        day: i === 1 ? "tomorrow" : dayName,
        time: formatTimeForDisplay(range.split("-")[0]),
      };
    }
  }
  return null;
}

export function isShopOpen(details: ShopDetails | null | undefined): ShopStatus {
  if (!details) {
    return {
      open: true,
      message: "Open",
      messageHi: "खुला है",
      messageTe: "తెరిచి ఉంది",
    };
  }

  if (details.is_online === false) {
    return {
      open: false,
      message: "Dukaan is currently closed for online orders",
      messageHi: "दुकान अभी ऑनलाइन ऑर्डर के लिए बंद है",
      messageTe: "షాప్ ప్రస్తుతం ఒన్‌లైన్ ఆర్డర్లకు మూసివేయబడింది",
    };
  }

  const hours = details.opening_hours ?? DEFAULT_HOURS;
  const weeklyOff = details.weekly_off ?? null;
  const holidaysRaw = details.holidays;
  const holidays: string[] = Array.isArray(holidaysRaw)
    ? holidaysRaw.filter((x): x is string => typeof x === "string")
    : [];

  const todayStr = new Date().toISOString().slice(0, 10);
  if (holidays.includes(todayStr)) {
    const next = getNextOpening(hours, weeklyOff, holidays);
    const msg = next
      ? `Closed for holiday • Opens ${next.day} at ${next.time}`
      : "Closed for holiday";
    return {
      open: false,
      message: msg,
      messageHi: next ? `छुट्टी के कारण बंद • ${next.day} ${next.time} को खुलेगा` : "छुट्टी के कारण बंद",
      messageTe: next ? `సెలవు కారణంగా మూసివేయబడింది • ${next.day} ${next.time}కు తెరుస్తుంది` : "సెలవు కారణంగా మూసివేయబడింది",
    };
  }

  const todayName = getTodayName();
  if (weeklyOff === todayName) {
    const next = getNextOpening(hours, weeklyOff, holidays);
    const msg = next
      ? `Closed for weekly off • Opens ${next.day} at ${next.time}`
      : "Closed for weekly off";
    return {
      open: false,
      message: msg,
      messageHi: next ? `साप्ताहिक अवकाश • ${next.day} ${next.time} को खुलेगा` : "साप्ताहिक अवकाश",
      messageTe: next ? `వారానికి సెలవు • ${next.day} ${next.time}కు తెరుస్తుంది` : "వారానికి సెలవు",
    };
  }

  const range = hours[todayName] ?? "closed";
  const parsed = parseTimeRange(range);

  if (!parsed) {
    const next = getNextOpening(hours, weeklyOff, holidays);
    const msg = next
      ? `Closed today • Opens ${next.day} at ${next.time}`
      : "Closed today";
    return {
      open: false,
      message: msg,
      messageHi: next ? `आज बंद • ${next.day} ${next.time} को खुलेगा` : "आज बंद",
      messageTe: next ? `ఈ రోజు మూసివేయబడింది • ${next.day} ${next.time}కు తెరుస్తుంది` : "ఈ రోజు మూసివేయబడింది",
    };
  }

  const now = getMinutesSinceMidnight();
  const closeDisplay = range.split("-")[1] || "22:00";

  if (now >= parsed.close) {
    const next = getNextOpening(hours, weeklyOff, holidays);
    const msg = next
      ? `Closed • Opens ${next.day} at ${next.time}`
      : `Closed • Opens tomorrow at ${formatTimeForDisplay(range.split("-")[0])}`;
    return {
      open: false,
      message: msg,
      messageHi: next ? `बंद • ${next.day} ${next.time} को खुलेगा` : "बंद",
      messageTe: next ? `మూసివేయబడింది • ${next.day} ${next.time}కు తెరుస్తుంది` : "మూసివేయబడింది",
      nextOpening: next?.time,
    };
  }

  if (now < parsed.open) {
    const openTime = range.split("-")[0] || "08:00";
    return {
      open: false,
      message: `Opens at ${formatTimeForDisplay(openTime)}`,
      messageHi: `${formatTimeForDisplay(openTime)} को खुलेगा`,
      messageTe: `${formatTimeForDisplay(openTime)}కు తెరుస్తుంది`,
      opensAt: openTime,
    };
  }

  const minsToClose = parsed.close - now;
  const closingSoon = minsToClose <= 30;
  const closesMsg = `Closes at ${formatTimeForDisplay(closeDisplay)}`;
  const openMsg = closingSoon ? `Closing soon • ${closesMsg}` : `Open • ${closesMsg}`;

  return {
    open: true,
    message: openMsg,
    messageHi: closingSoon ? `जल्द बंद • ${formatTimeForDisplay(closeDisplay)} को बंद` : `खुला • ${formatTimeForDisplay(closeDisplay)} को बंद`,
    messageTe: closingSoon ? `త్వరలో మూస్తారు • ${formatTimeForDisplay(closeDisplay)}కు మూస్తారు` : `తెరిచి ఉంది • ${formatTimeForDisplay(closeDisplay)}కు మూస్తారు`,
    closesAt: closeDisplay,
  };
}

/** Build opening_hours json from simple open/close + weekly off */
export function buildOpeningHours(
  openTime: string,
  closeTime: string,
  weeklyOff: string | null
): Record<string, string> {
  const range = `${openTime}-${closeTime}`;
  const result: Record<string, string> = {};
  for (const day of DAY_NAMES) {
    result[day] = weeklyOff === day ? "closed" : range;
  }
  return result;
}

export const TIME_OPTIONS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00", "22:00", "23:00",
];

/** Extract open/close time from opening_hours (first non-closed day) */
export function getOpenCloseFromHours(hours: Record<string, string> | null | undefined): { open: string; close: string } {
  const h = hours ?? DEFAULT_HOURS;
  for (const day of DAY_NAMES) {
    const range = h[day];
    if (range && range.toLowerCase() !== "closed") {
      const [open, close] = range.split("-");
      return { open: open ?? "08:00", close: close ?? "22:00" };
    }
  }
  return { open: "08:00", close: "22:00" };
}

export const WEEKLY_OFF_OPTIONS = [
  { value: "", label: "None" },
  { value: "Sunday", label: "Sunday" },
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
];
