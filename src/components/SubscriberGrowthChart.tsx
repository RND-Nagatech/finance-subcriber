import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell, LabelList } from 'recharts';

interface SubscriberGrowthData {
  bulan: string;
  count: number;
  year: number;
}

interface SubscriberGrowthChartProps {
  data: SubscriberGrowthData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SubscriberGrowthChart({ data }: SubscriberGrowthChartProps) {
  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      payload: SubscriberGrowthData;
    }>;
    label?: string;
  }) {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #eee', padding: 12, minWidth: 180, fontSize: 13 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{data.bulan} {data.year}</div>
          <div>Jumlah Subscriber Baru: {data.count.toLocaleString('id-ID')}</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
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
            tickFormatter={(value) => value.toLocaleString('id-ID')}
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            barSize={60}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList
              dataKey="count"
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