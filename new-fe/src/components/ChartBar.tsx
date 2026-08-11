import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from 'recharts';

interface SubKategori {
  sub_kategori: string;
  total: number;
}

interface ChartData {
  name: string; // kategori
  value: number; // total kategori
  subs?: SubKategori[];
}

interface ChartBarProps {
  data: ChartData[];
  totalKategori?: number;
  ticks?: number[]; // custom Y-axis ticks
  showNominal?: boolean;
  showAverageNominal?: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MASK_CURRENCY = 'Rp ••••••••••';

export function ChartBar({
  data,
  totalKategori,
  ticks,
  showNominal = true,
  showAverageNominal = true,
}: ChartBarProps) {
  const averageValue = data.length > 0
    ? data.reduce((sum, item) => sum + Number(item.value || 0), 0) / data.length
    : 0;
  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        value: number;
      };
    }>;
    label?: string;
  }) {
    if (active && payload && payload.length) {
      const sub = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #eee', padding: 12, minWidth: 180, fontSize: 13 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{sub.name}</div>
          <div>
            Nominal:{' '}
            {showNominal
              ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(sub.value)
              : MASK_CURRENCY}
          </div>
        </div>
      );
    }
    return null;
  }

        const barSize = data.length < 4 ? 80 : 80;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="mb-2 flex w-full justify-end">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-2 text-right">
          <div className="text-xs font-medium text-blue-700">Rata-rata (Average)</div>
          <div className="text-sm font-semibold text-blue-700">
            {showAverageNominal ? `Rp ${Math.round(averageValue).toLocaleString('id-ID')}` : MASK_CURRENCY}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 70, bottom: 20 }}
        >
          <XAxis
            dataKey="name"
            textAnchor="center"
            fontSize={12}
            interval={0}
            tick={({ x, y, payload, index }) => {
              const barCenter = x;
              const text = payload.value;
              const maxWidth = 80; // Maximum width for text before wrapping
              
              // Function to wrap text
              const wrapText = (text: string, maxWidth: number) => {
                const words = text.split(' ');
                const lines: string[] = [];
                let currentLine = '';
                
                words.forEach(word => {
                  const testLine = currentLine + (currentLine ? ' ' : '') + word;
                  // Rough estimate: 8px per character
                  if (testLine.length * 8 > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                });
                
                if (currentLine) {
                  lines.push(currentLine);
                }
                
                return lines;
              };
              
              const lines = wrapText(text, maxWidth);
              
              return (
                <g>
                  {lines.map((line, lineIndex) => (
                    <text
                      key={lineIndex}
                      x={barCenter}
                      y={y + 16 + (lineIndex * 14)} // 14px line height
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill="#374151"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            }}
            
          />
          <YAxis
            width={80}
            tickMargin={6}
            ticks={ticks}
            tickFormatter={(value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)}
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            barSize={barSize}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
          <ReferenceLine
            y={averageValue}
            stroke="#2563eb"
            strokeDasharray="8 6"
            strokeWidth={2}
            isFront
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
