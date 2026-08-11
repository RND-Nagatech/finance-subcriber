import { addDays, addMonths, calcTempo } from './utils/vpsPeriod';

function testGenerateVpsPeriods(startDateStr: string, months: number, fiscalEndDateStr: string) {
  const startDate = new Date(startDateStr);
  const fiscalEndDate = new Date(fiscalEndDateStr);
  let cursorStart = new Date(startDate);
  let i = 1;
  while (cursorStart <= fiscalEndDate) {
    const tempo = calcTempo(cursorStart, months);
    console.log(`Entry ${i}: start=${cursorStart.toISOString().slice(0,10)}, bulan=${months}, tempo=${tempo.toISOString().slice(0,10)}`);
    const nextStart = addDays(tempo, 1);
    if (nextStart > fiscalEndDate) break;
    cursorStart = nextStart;
    i++;
  }
}

testGenerateVpsPeriods('2025-12-08', 6, '2026-11-30');
