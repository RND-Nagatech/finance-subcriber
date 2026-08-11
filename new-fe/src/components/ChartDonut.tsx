

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useState } from 'react';

interface SubKategori {
  sub_kategori: string;
  total: number;
}

interface ChartData {
  name: string; // kategori
  value: number; // total kategori
  subs?: SubKategori[];
}

interface ChartDonutProps {
  data: ChartData[];
  totalKategori?: number;
  showNominal?: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MASK_CURRENCY = 'Rp ••••••••••';

export function ChartDonut({ data, totalKategori, showNominal = true }: ChartDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handlePieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };
  const handlePieLeave = () => {
    setActiveIndex(null);
  };

  const activeData = activeIndex !== null ? data[activeIndex] : null;

  function CustomTooltip({ active, payload }: any) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={100}
            paddingAngle={1}
            dataKey="value"
            onMouseEnter={handlePieEnter}
            onMouseLeave={handlePieLeave}
            activeIndex={activeIndex ?? undefined}
            label={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 grid w-full grid-cols-1 gap-2 px-2 md:grid-cols-2">
        {data.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate text-gray-700">{item.name}</span>
            </div>
            <span className="ml-3 shrink-0 font-semibold text-gray-900">
              {showNominal ? `Rp ${Number(item.value || 0).toLocaleString('id-ID')}` : MASK_CURRENCY}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
