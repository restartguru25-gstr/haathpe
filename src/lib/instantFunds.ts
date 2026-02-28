const IST_TZ = "Asia/Kolkata";

export const INSTANT_FUNDS_CYCLES_IST: { hour: number; minute: number }[] = [
  { hour: 10, minute: 30 },
  { hour: 12, minute: 30 },
  { hour: 14, minute: 30 },
  { hour: 16, minute: 30 },
  { hour: 18, minute: 30 },
  { hour: 20, minute: 30 },
];

function istParts(date = new Date()): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function istToUtcDate(ist: { year: number; month: number; day: number; hour: number; minute: number }): Date {
  // Create the intended IST local time then convert to actual UTC Date by using the same instant in Asia/Kolkata.
  // We do this by formatting with timezone and then reconstructing an ISO-like string with offset is not available,
  // so we approximate by using Date.UTC and subtracting 5:30.
  const utcMs = Date.UTC(ist.year, ist.month - 1, ist.day, ist.hour, ist.minute, 0, 0);
  const offsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(utcMs - offsetMs);
}

function formatIstTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { timeZone: IST_TZ, hour: "numeric", minute: "2-digit" });
}

function formatIstDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { timeZone: IST_TZ, day: "2-digit", month: "short" });
}

export function getInstantFundsCycleState(now = new Date()): {
  enabled: boolean;
  nextCycleAt: Date;
  nextCycleLabel: string;
  reason?: string;
} {
  const p = istParts(now);
  const minutes = p.hour * 60 + p.minute;
  const start = 10 * 60 + 30;
  const end = 20 * 60 + 30;

  const inWindow = minutes >= start && minutes <= end;

  let next: { year: number; month: number; day: number; hour: number; minute: number } | null = null;
  if (minutes > end) {
    // tomorrow 10:30
    const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
    base.setUTCDate(base.getUTCDate() + 1);
    const istTomorrow = istParts(new Date(base.getTime() + 5.5 * 60 * 60 * 1000));
    next = { year: istTomorrow.year, month: istTomorrow.month, day: istTomorrow.day, hour: 10, minute: 30 };
  } else {
    // today next cycle >= now
    for (const c of INSTANT_FUNDS_CYCLES_IST) {
      const cMin = c.hour * 60 + c.minute;
      if (minutes <= cMin) {
        next = { year: p.year, month: p.month, day: p.day, hour: c.hour, minute: c.minute };
        break;
      }
    }
    if (!next) next = { year: p.year, month: p.month, day: p.day, hour: 20, minute: 30 };
  }

  const nextCycleAt = istToUtcDate(next);
  const isTomorrow = formatIstDate(nextCycleAt) !== formatIstDate(now);
  const label = `${formatIstTime(nextCycleAt)}${isTomorrow ? " tomorrow" : ""}`;

  return {
    enabled: inWindow,
    nextCycleAt,
    nextCycleLabel: label,
    reason: inWindow ? undefined : `Next cycle at ${label}`,
  };
}

