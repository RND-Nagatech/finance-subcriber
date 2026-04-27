import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Cell } from 'recharts';
import { Eye, EyeOff } from 'lucide-react';


interface ISubItem {
  name: string;
  total: number;
}

interface IStackedBarKategoriProps {
  data: Array<{ kategori: string; subs: ISubItem[] }>;
  title?: string;
  description?: string;
  showAverageNominal?: boolean;
  onToggleAverageNominal?: () => void;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#7B61FF', '#F95D6A', '#4CAF50', '#9C27B0', '#03A9F4', '#FF9800'
];
const NEGATIVE_COLOR = '#ef4444';

const keyFromName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');

function formatRupiah(value: number) {
  return `Rp ${Math.abs(value).toLocaleString('id-ID')}`;
}

function formatSignedRupiah(value: number) {
  if (value < 0) return `-${formatRupiah(value)}`;
  if (value > 0) return `+${formatRupiah(value)}`;
  return formatRupiah(0);
}

export default function StackedBarKategori({
  data,
  title,
  description,
  showAverageNominal = true,
  onToggleAverageNominal,
}: IStackedBarKategoriProps) {
  const allSubNames: string[] = [];
  data.forEach(d => d.subs.forEach(s => { if (!allSubNames.includes(s.name)) allSubNames.push(s.name); }));

  const chartData = data.map(d => {
    const row: any = { kategori: d.kategori };
    d.subs.forEach(s => { row[keyFromName(s.name)] = s.total; });
    allSubNames.forEach(n => { const k = keyFromName(n); if (row[k] === undefined) row[k] = 0; });
    const totals = allSubNames.reduce((acc, name) => {
      const val = Number(row[keyFromName(name)] || 0);
      if (val >= 0) acc.positive += val;
      else acc.negative += val;
      return acc;
    }, { positive: 0, negative: 0 });
    row._positiveTotal = totals.positive;
    row._negativeTotal = totals.negative;
    row._total = totals.positive + totals.negative;
    return row;
  })

  // tolong chartData diurutkan berdasarkan kategori , isi dari kategori string tanggal dalam format YYYY-MM-DD atau bisa saja JAN-26 sampai DES-26 misalkan
  chartData.sort((a, b) => {
    // check apakah kategori foramtnya adalah DES - 24 , JAN - 26, FEB - 26 , atau format YYYY-MM-DD
    const monthOrder = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
    const isMonthFormatA = monthOrder.includes(a.kategori.trim().split('-')[0].trim());
    const isMonthFormatB = monthOrder.includes(b.kategori.trim().split('-')[0].trim());
    if (isMonthFormatA && isMonthFormatB) {
      console.log("DISINI");
      
      const [monthA, yearA] = a.kategori.trim().split('-');
      const [monthB, yearB] = b.kategori.trim().split('-');
      console.log(monthA, yearA, yearB);
      
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      } else {
        return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
      }
    }

    // Jika bukan format bulan-tahun, anggap formatnya adalah YYYY-MM-DD
    
    const dateA = new Date(a.kategori);
    const dateB = new Date(b.kategori);
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateA.getTime() - dateB.getTime();
    } else {
      return a.kategori.localeCompare(b.kategori);
    }
  });
  
  

  // Bar size dinamis: jika kategori < 4, bar lebih lebar
  const barSize = chartData.length < 4 ? 80 : 40;
  // Calculate dynamic YAxis width and domain based on signed stacked totals.
  const maxPositive = Math.max(0, ...chartData.map(d => Number(d._positiveTotal || 0)));
  const minNegative = Math.min(0, ...chartData.map(d => Number(d._negativeTotal || 0)));
  const maxAbs = Math.max(Math.abs(maxPositive), Math.abs(minNegative), 1);
  const domainPadding = Math.max(1_000, Math.round(maxAbs * 0.08));
  const yDomain: [number, number] = [
    minNegative < 0 ? minNegative - domainPadding : 0,
    maxPositive > 0 ? maxPositive + domainPadding : 0,
  ];
  const maxValueForWidth = Math.max(Math.abs(yDomain[0]), Math.abs(yDomain[1]));
  const formattedMaxValue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(maxValueForWidth);
  const yAxisWidth = Math.max(60, formattedMaxValue.length * 5); // ensure enough width for 'Rp'
  const averageTotal = chartData.length > 0
    ? chartData.reduce((sum, row) => sum + Number(row._total || 0), 0) / chartData.length
    : 0;
  return (
    <div
      className="rounded-xl"
      style={{ background: '#fff', position: 'relative' }}
    >
      {title && <h2 className="text-xl font-bold text-foreground">{title}</h2>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="flex items-center justify-start">
        <Legend
          layout="horizontal"
          verticalAlign="top"
          align="left"
          wrapperStyle={{ fontSize: 14, marginBottom: 0, marginLeft: 8 }}
          iconSize={16}
        />
      </div>
      <div className="flex justify-end">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-2 text-right">
          <div className="text-xs font-medium text-blue-700">Rata-rata (Average)</div>
          <div className="flex items-center justify-end gap-2">
            <div className="text-sm font-semibold text-blue-700">
              {showAverageNominal ? formatSignedRupiah(Math.round(averageTotal)) : 'Rp ••••••••••'}
            </div>
            {onToggleAverageNominal ? (
              <button
                type="button"
                onClick={onToggleAverageNominal}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title={showAverageNominal ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
                aria-label={showAverageNominal ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
              >
                {showAverageNominal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={chartData}
          margin={{ top: 40, right: 60, left: 60, bottom: 20 }}
          barCategoryGap={30}
          barGap={8}
        >
          <XAxis
            dataKey="kategori"
            interval={0}
            axisLine={false}
            tickLine={false}
            tick={({ x, y, payload, index }) => {
              // Center label by shifting x by half barSize
              const barCenter = x + barSize / 2;
              let value = payload.value
               // Jika format YYYY-MM-DD, tampilkan hanya hari (DD)
              if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                value = value.split('-')[2];
              }
              // Jika format lain seperti JAN-26, tampilkan apa adanya
              return (
                <g>
                  <text
                    x={x}
                    y={y + 16}
                    textAnchor="middle"
                    fontSize={13}
                    fill="#606060ff"
                  >
                    {value}
                  </text>
                </g>
              );
            }}
          />
          <YAxis
            tickFormatter={(v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v))}
            width={yAxisWidth}
            tick={{ fontSize: 12, fill: '#222', fontWeight: 600 }}
            axisLine={{ stroke: '#e7e7e7ff' }}
            domain={yDomain}
          />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                // Cari data bar yang sedang di-hover
                const barData = payload[0].payload;
                const kategori = barData.kategori;
                const subItems = allSubNames.map(subName => ({
                  name: subName,
                  value: barData[keyFromName(subName)] || 0,
                  color: COLORS[allSubNames.indexOf(subName) % COLORS.length]
                }));
                const netTotal = subItems.reduce((sum, item) => sum + item.value, 0);

                return (
                  <div style={{
                    background: '#fff',
                    border: '1px solid #ececec',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12,
                    minWidth: 200,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                      {kategori}
                    </div>
                    {subItems.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: idx < subItems.length - 1 ? 6 : 0
                      }}>
                        <div style={{
                          width: 12,
                          height: 12,
                          backgroundColor: item.value < 0 ? NEGATIVE_COLOR : item.color,
                          marginRight: 8,
                          borderRadius: 2
                        }}></div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500 }}>{item.name}:</span>
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {formatSignedRupiah(item.value)}
                        </div>
                      </div>
                    ))}
                    <div style={{
                      borderTop: '1px solid #eee',
                      marginTop: 8,
                      paddingTop: 8,
                      fontWeight: 700,
                      fontSize: 13
                    }}>
                      Total: {formatSignedRupiah(netTotal)}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {allSubNames.map((subName, idx) => (
            <Bar
              key={subName}
              dataKey={keyFromName(subName)}
              stackId="total"
              name={subName}
              fill={COLORS[idx % COLORS.length]}
              barSize={barSize}
              isAnimationActive={true}
            >
              {chartData.map((entry, entryIdx) => (
                <Cell
                  key={`${subName}-${entryIdx}`}
                  fill={Number(entry[keyFromName(subName)] || 0) < 0 ? NEGATIVE_COLOR : COLORS[idx % COLORS.length]}
                />
              ))}
            </Bar>
          ))}
          <ReferenceLine
            y={averageTotal}
            stroke="#2563eb"
            strokeDasharray="8 6"
            strokeWidth={2}
          />

        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
