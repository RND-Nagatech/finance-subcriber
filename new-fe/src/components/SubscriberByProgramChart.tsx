import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts';

interface SubscriberByProgramData {
  program: string;
  programs?: string[];
  total_subscriber: number;
  total_biaya: number;
  avg_biaya_per_subscriber: number;
}

interface SubscriberByProgramChartProps {
  data: SubscriberByProgramData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function niceStep(rawStep: number) {
  if (rawStep <= 1) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exponent);
  const fraction = rawStep / base;
  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
}

function buildIntegerTicks(maxValue: number) {
  const safeMax = Math.max(1, Math.ceil(maxValue || 0));
  const step = niceStep(safeMax / 4);
  let maxTick = Math.ceil(safeMax / step) * step;
  if (maxTick <= safeMax) maxTick += step;

  const ticks: number[] = [];
  for (let value = 0; value <= maxTick; value += step) {
    ticks.push(value);
  }
  return { ticks, maxTick };
}

export function SubscriberByProgramChart({ data }: SubscriberByProgramChartProps) {
  const chartData = useMemo(
    () => (data || []).filter((item) => Number(item.total_subscriber || 0) > 0),
    [data]
  );
  const yAxis = useMemo(
    () => buildIntegerTicks(Math.max(0, ...chartData.map((item) => Number(item.total_subscriber || 0)))),
    [chartData]
  );

  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      payload: SubscriberByProgramData;
    }>;
    label?: string;
  }) {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #eee', padding: 12, minWidth: 250, fontSize: 13, maxWidth: 400 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{data.program}</div>
          {data.programs && data.programs.length > 1 && (
            <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#f3f4f6', borderRadius: 4 }}>
              <div style={{ fontSize: 11, fontWeight: '600', marginBottom: 4, color: '#6b7280' }}>Grouped Programs:</div>
              <div style={{ fontSize: 11, color: '#374151' }}>
                {data.programs.map((prog, idx) => (
                  <div key={idx} style={{ marginBottom: 2 }}>• {prog}</div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Total Subscribers: {data.total_subscriber.toLocaleString('id-ID')}</div>
            <div>Total Cost: Rp {data.total_biaya.toLocaleString('id-ID')}</div>
            <div>Avg Cost/Subscriber: Rp {data.avg_biaya_per_subscriber.toLocaleString('id-ID')}</div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 42, right: 30, left: 20, bottom: 20 }}
        >
          <XAxis
            dataKey="program"
            textAnchor="center"
            fontSize={12}
            interval={0}
            tick={({ x, y, payload, index }) => {
              const barCenter = x;
              const text = payload.value;
              const maxWidth = 100; // Maximum width for program names

              // Function to wrap text
              const wrapText = (text: string, maxWidth: number) => {
                const words = text.split(' ');
                const lines: string[] = [];
                let currentLine = '';

                words.forEach(word => {
                  const testLine = currentLine + (currentLine ? ' ' : '') + word;
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
                      y={y + 16 + (lineIndex * 14)}
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
            domain={[0, yAxis.maxTick]}
            ticks={yAxis.ticks}
            allowDecimals={false}
            tickFormatter={(value) => value.toLocaleString('id-ID')}
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="total_subscriber"
            radius={[4, 4, 0, 0]}
            barSize={60}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList
              dataKey="total_subscriber"
              position="top"
              offset={10}
              formatter={(value: number) => value.toLocaleString('id-ID')}
              style={{
                fontSize: 11,
                fill: '#374151',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(255,255,255,0.8)'
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
