import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Pilih Tahun" />
      </SelectTrigger>
      <SelectContent className="max-h-56 overflow-y-auto">
        {loading ? (
          <SelectItem value={value}>{value}</SelectItem>
        ) : (
          years.map(year => (
            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  </div>
);

export default YearSelect;
