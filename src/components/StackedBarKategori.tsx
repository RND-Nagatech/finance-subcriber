import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts';


interface ISubItem {
  name: string;
  total: number;
}

interface IStackedBarKategoriProps {
  data: Array<{ kategori: string; subs: ISubItem[] }>;
  title?: string;
  description?: string;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#7B61FF', '#F95D6A', '#4CAF50', '#9C27B0', '#03A9F4', '#FF9800'
];

const keyFromName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');

export default function StackedBarKategori({ data, title, description }: IStackedBarKategoriProps) {
  const allSubNames: string[] = [];
  data.forEach(d => d.subs.forEach(s => { if (!allSubNames.includes(s.name)) allSubNames.push(s.name); }));

  const chartData = data.map(d => {
    const row: any = { kategori: d.kategori };
    let totalKategori = 0;
    d.subs.forEach(s => { row[keyFromName(s.name)] = s.total; totalKategori += s.total; });
    allSubNames.forEach(n => { const k = keyFromName(n); if (row[k] === undefined) row[k] = 0; });
    row._total = totalKategori;
    return row;
  })
  

  // Bar size dinamis: jika kategori < 4, bar lebih lebar
  const barSize = chartData.length < 4 ? 80 : 40;
   // Calculate dynamic YAxis width based on max value
  const maxValue = Math.max(...chartData.map(d => d._total));
  const formattedMaxValue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(maxValue);
  const yAxisWidth = Math.max(60, formattedMaxValue.length * 5); // ensure enough width for 'Rp'
  return (
    <div
      className="rounded-xl"
      style={{ background: '#fff', position: 'relative' }}
    >
      {title && <h2 className="text-xl font-bold text-foreground">{title}</h2>}
      {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
      <div className="flex items-center justify-start mb-2">
        <Legend
          layout="horizontal"
          verticalAlign="top"
          align="left"
          wrapperStyle={{ fontSize: 14, marginBottom: 0, marginLeft: 8 }}
          iconSize={16}
        />
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
              return (
                <g>
                  <text
                    x={barCenter}
                    y={y + 16}
                    textAnchor="middle"
                    fontSize={13}
                    fill="#606060ff"
                  >
                    {payload.value}
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
            domain={[0, 'auto']}
          />
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
                })).filter(item => item.value > 0);

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
                          backgroundColor: item.color,
                          marginRight: 8,
                          borderRadius: 2
                        }}></div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500 }}>{item.name}:</span>
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          Rp {item.value.toLocaleString('id-ID')}
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
                      Total: Rp {subItems.reduce((sum, item) => sum + item.value, 0).toLocaleString('id-ID')}
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
            />
          ))}
          {/* Label total tahunan kategori di atas bar stack */}
          <Bar dataKey="_total" fill="transparent">
            <LabelList
              dataKey="_total"
              position="top"

              content={({ x, y, value, index }) => {
                if (!value) return null;
                const barCenter = Number(x) + barSize / 2;
                const textWidth = `Rp ${value.toLocaleString('id-ID')}`.length * 6; // rough estimate
                const adjustedX = barCenter - textWidth / 2 - 45; // geser ke kiri 10px
                const textY = Number(y) - 20;
                const barTop = Number(y) ; // posisi lebih dekat ke bar

                return (
                  <g>
                    {/* Garis penghubung dari text ke bar */}
                    <line
                      x1={barCenter - 50}
                      y1={textY } // mulai dari bawah text
                      x2={barCenter - 50}
                      y2={barTop } // ke bar
                      stroke="#333333"
                      strokeWidth={1}
                      opacity={0.8}
                    />
                    {/* Text label */}
                    <text
                      x={adjustedX}
                      y={textY}
                      textAnchor="start"
                      fontSize={12}
                      fill="#000000"
                      fontWeight={900}
                      style={{ textShadow: '0 1px 2px #fff' }}
                    >
                      {`Rp ${value.toLocaleString('id-ID')}`}
                    </text>
                  </g>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
