export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toPeriod(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1..12
  return `${y}-${pad2(m)}`;
}

export function formatYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const targetMonth = d.getUTCMonth() + months;
  // Set to 1st to avoid end-of-month issues, then adjust day later
  const day = d.getUTCDate();
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1));
  // clamp day to end of resulting month
  const endOfMonth = new Date(Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, endOfMonth);
  return new Date(Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth(), clampedDay));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// tempo = (start + bulan months) - 1 day
export function calcTempo(start: Date, bulan: number): Date {
  return addDays(addMonths(start, bulan), -1);
}

// Fiscal period ends in November (month=10) of fiscal year.
// If date is in December, fiscal end is next year's November; otherwise, same year's November.
export function getFiscalEnd(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0..11
  const endYear = m === 11 ? y + 1 : y;
  // Return last day of November (month index 10) in UTC
  return new Date(Date.UTC(endYear, 10, 30 + 1)); // temp; we'll calculate precise last day
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0));
}

export function getFiscalEndOfMonth(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const endYear = m === 11 ? y + 1 : y;
  const novLast = new Date(Date.UTC(endYear, 11, 0)); // last day of November
  return novLast;
}

export function enumerateMonthsInclusive(from: Date, to: Date): string[] {
  const res: string[] = [];
  const cursor = new Date(Date.UTC(from.getFullYear(), from.getMonth(), 1));
  const end = new Date(Date.UTC(to.getFullYear(), to.getMonth(), 1));
  while (cursor <= end) {
    res.push(toPeriod(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return res;
}
