import React from 'react';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface YearSelectProps {
  value: string;
  onChange: (year: string) => void;
  years: number[];
  loading?: boolean;
  hideActiveLabel?: boolean;
}

export const YearSelect: React.FC<YearSelectProps> = ({ value, onChange, years, loading, hideActiveLabel }) => (
  <div className="flex flex-col items-end mb-4">
    {!hideActiveLabel ? (
      <span className="mb-1 text-sm text-muted-foreground">Tahun Fiskal Aktif: <span className="font-semibold text-primary">{value}</span></span>
    ) : null}
    <SearchableSelect
      value={value}
      onValueChange={onChange}
      options={(loading ? [Number(value)] : years).map((year) => ({
        value: year.toString(),
        label: year.toString(),
      }))}
      placeholder="Pilih Tahun"
      searchPlaceholder="Cari tahun..."
      className="w-40"
    />
  </div>
);

export default YearSelect;
