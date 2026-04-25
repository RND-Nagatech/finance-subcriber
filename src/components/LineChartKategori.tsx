import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, EyeOff } from 'lucide-react';

interface LineChartKategoriProps {
  data: Array<{ bulan: string; nominal: number }>;
  title?: string;
  description?: string;
  showNominal?: boolean;
  onToggleNominal?: () => void;
}

const CustomLabel = (props: any) => {
  const { x, y, value, index, dataLength } = props;

  // Jika ini titik pertama (index 0), geser ke kanan untuk menghindari bentrok dengan YAxis
  const adjustedX = index === 0 ? x + 45 : x + 20;
  // jika ini titik pertama (index 0), geser ke bawah untuk menghindari bentrok dengan YAxis
  const adjustedY = index === 0 ? y + 15 : y - 10;

  return (
    <text x={adjustedX} y={adjustedY} textAnchor="middle" fontSize={12} fill={value < 0 ? '#ef4444' : '#000'} fontWeight={900}>
      {`Rp${value.toLocaleString('id-ID')}`}
    </text>
  );
};

export default function LineChartKategori({
  data,
  title,
  description,
  showNominal = true,
  onToggleNominal,
}: LineChartKategoriProps) {
  const totalValue = data.reduce((sum, item) => {
    return sum + item.nominal
  }, 0);
  const maskCurrency = () => 'Rp ••••••••••';

  return (
    <div className="bg-white">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="text-lg font-bold text-blue-600 inline-flex items-center gap-2">
            <span>Total: {showNominal ? `Rp ${totalValue.toLocaleString('id-ID')}` : maskCurrency()}</span>
            {onToggleNominal && (
              <button
                type="button"
                onClick={onToggleNominal}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title={showNominal ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
                aria-label={showNominal ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
              >
                {showNominal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      )}
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 10, right: 70, left: 10, bottom: 10 }}>
          <XAxis
            dataKey="bulan"
            interval={0}
            dy={10}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => {
              // Jika format YYYY-MM-DD, tampilkan hanya hari (DD)
              if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return value.split('-')[2];
              }
              // Jika format lain seperti JAN-26, tampilkan apa adanya
              return value;
            }}
          />
          <YAxis
            width={100}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => (showNominal ? value.toLocaleString('id-ID') : '')}
            tickCount={6}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0];
                return (
                  <div style={{
                    background: '#fff',
                    border: '1px solid #ececec',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12,
                    minWidth: 150,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                      {label}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        backgroundColor: (data.value as number) < 0 ? '#ef4444' : '#0088FE' ,
                        marginRight: 8,
                        borderRadius: 2
                      }}></div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>Nominal:</span>
                      </div>
                      <div style={{ fontWeight: 600, color: (data.value as number) < 0 ? '#ef4444' : '#0088FE' }}>
                        {showNominal ? `Rp ${(data.value as number).toLocaleString('id-ID')}` : maskCurrency()}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* <Legend verticalAlign="top" align="right" height={24} iconType="circle" /> */}
          <Line 
            type="monotone" 
            dataKey="nominal" 
            stroke="#0088FE" 
            dot={(props) => {
              const { payload } = props;
              const isNegative = payload && payload.nominal < 0;
              return (
                <circle
                  {...props}
                  r={4}
                  fill={isNegative ? '#ef4444' : '#0088FE'}
                  stroke={isNegative ? '#ef4444' : '#0088FE'}
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
