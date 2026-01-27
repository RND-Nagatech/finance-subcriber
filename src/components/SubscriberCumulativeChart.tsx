import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SubscriberCumulativeData {
  bulan: string;
  total: number;
  year: number;
}

interface SubscriberCumulativeChartProps {
  data: SubscriberCumulativeData[];
}

export function SubscriberCumulativeChart({ data }: SubscriberCumulativeChartProps) {
  function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      payload: SubscriberCumulativeData;
    }>;
    label?: string;
  }) {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #eee', padding: 12, minWidth: 180, fontSize: 13 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{data.bulan} {data.year}</div>
          <div>Total Subscribers: {data.total.toLocaleString('id-ID')}</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
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
          <Line
            type="monotone"
            dataKey="total"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}