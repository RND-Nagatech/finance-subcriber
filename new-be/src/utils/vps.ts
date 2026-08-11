import FiscalConfig from '../models/FiscalConfig';

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // If day overflowed (e.g., adding 1 month to Jan 31), set to last day of new month
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function calcDueDate(startDate: Date, months: number) {
  // Due date at month N-1 from start (same day as start)
  return addMonths(startDate, Math.max(0, months - 1));
}

export function calcGross(pricePerMonth: number, months: number) {
  return Math.max(0, pricePerMonth) * Math.max(0, months);
}

export function calcNet(gross: number, discount: number) {
  return Math.max(0, gross - Math.max(0, discount));
}

// Generate monthly periods from given startDate up to inclusive last month (November) of active fiscal year
export async function generatePeriodsUntilFiscalNovember(params: {
  startDate: Date;
  pricePerMonth: number;
}): Promise<Array<{ month: number; year: number; startDate: Date; endDate: Date; amount: number; paid: boolean }>> {
  const { startDate, pricePerMonth } = params;
  const cfg = await FiscalConfig.findOne({ key: 'fiscal' }).lean();
  const activeYear = cfg?.active_year || new Date().getFullYear();
  // Fiscal last month is November (month index 10) in calendar year = activeYear
  const lastMonthIndex = 10;
  const lastYear = activeYear;

  const periods: Array<{ month: number; year: number; startDate: Date; endDate: Date; amount: number; paid: boolean }> = [];
  let cursor = new Date(startDate);
  // Normalize time
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getFullYear() < lastYear || (cursor.getFullYear() === lastYear && cursor.getMonth() <= lastMonthIndex)) {
    const nextStart = addMonths(cursor, 1);
    const endDate = addDays(nextStart, -1);
    periods.push({
      month: cursor.getMonth(),
      year: cursor.getFullYear(),
      startDate: new Date(cursor),
      endDate,
      amount: pricePerMonth,
      paid: false,
    });
    cursor = nextStart;
  }

  return periods;
}

// Generate a full 12-month fiscal schedule for the next active fiscal year (DEC prev -> NOV current)
export async function generateNextFiscalYearPeriods(params: {
  startDayOfMonth: number;
  pricePerMonth: number;
}): Promise<Array<{ month: number; year: number; startDate: Date; endDate: Date; amount: number; paid: boolean }>> {
  const { startDayOfMonth, pricePerMonth } = params;
  const cfg = await FiscalConfig.findOne({ key: 'fiscal' }).lean();
  const activeYear = cfg?.active_year || new Date().getFullYear();
  const months: Array<{ month: number; year: number }> = [];
  // Fiscal months for activeYear: DEC (activeYear-1) ... NOV (activeYear)
  for (let m = 11; m <= 11 + 12 - 1; m++) {
    const year = activeYear - 1 + Math.floor(m / 12);
    const month = m % 12;
    months.push({ month, year });
  }

  const periods = months.map(({ month, year }) => {
    const start = new Date(year, month, Math.min(startDayOfMonth, 28));
    const nextStart = addMonths(start, 1);
    const endDate = addDays(nextStart, -1);
    return { month, year, startDate: start, endDate, amount: pricePerMonth, paid: false };
  });
  return periods;
}
