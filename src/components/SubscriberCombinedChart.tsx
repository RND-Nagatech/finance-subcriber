import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell, LabelList } from 'recharts';

interface SubscriberCombinedData {
  bulan: string;
  count: number; // Growth data
  total: number; // Cumulative data
  year: number;
}

interface SubscriberCombinedChartProps {
  data: SubscriberCombinedData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SubscriberCombinedChart({ data }: SubscriberCombinedChartProps) {
  // Guard: keep cumulative total carried forward if any month is missing total.
  const normalizedData = (() => {
    let runningTotal = 0;
    return (data || []).map((row) => {
      const nextCount = Number(row?.count || 0);
      const providedTotal = Number(row?.total || 0);
      if (providedTotal > 0 || nextCount > 0 || runningTotal === 0) {
        runningTotal = providedTotal || (runningTotal + nextCount);
      }
      return {
        ...row,
        count: nextCount,
        total: runningTotal,
      };
    });
  })();

  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      payload: SubscriberCombinedData;
      dataKey: string;
      value: number;
    }>;
    label?: string;
  }) {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #eee', padding: 12, minWidth: 220, fontSize: 13 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{data.bulan} {data.year}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: '#10b981', fontWeight: '600' }}>
              📈 New Subscribers: {data.count.toLocaleString('id-ID')}
            </div>
            <div style={{ color: '#3b82f6', fontWeight: '600' }}>
              📊 Total Subscribers: {data.total.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart
          data={normalizedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <XAxis
            dataKey="bulan"
            textAnchor="center"
            fontSize={12}
            interval={0}
            tick={({ x, y, payload }) => {
              const barCenter = x;
              const text = payload.value;
              
              // Format label: jika YYYY-MM-DD, tampilkan hanya hari (DD)
              const formattedText = typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) 
                ? text.split('-')[2] 
                : text;
              
              return (
                <text
                  x={barCenter}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#374151"
                >
                  {formattedText}
                </text>
              );
            }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={(value) => value.toLocaleString('id-ID')}
            fontSize={12}
            label={{ value: 'New Subscribers', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => value.toLocaleString('id-ID')}
            fontSize={12}
            label={{ value: 'Total Subscribers', angle: 90, position: 'insideRight' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="count"
            fill="#10b981"
            name="New Subscribers"
            radius={[4, 4, 0, 0]}
            barSize={50}
          >
            {normalizedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#10b981" />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              offset={8}
              formatter={(value: number) => value.toLocaleString('id-ID')}
              style={{
                fontSize: 10,
                fill: '#065f46',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(255,255,255,0.8)'
              }}
            />
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Total Subscribers"
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
          >
            <LabelList
              dataKey="total"
              position="top"
              offset={14}
              formatter={(value: number) => value.toLocaleString('id-ID')}
              style={{
                fontSize: 10,
                fill: '#1d4ed8',
                fontWeight: 700,
                textShadow: '0 1px 2px rgba(255,255,255,0.9)'
              }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
