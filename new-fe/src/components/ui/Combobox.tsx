import { useState, useRef, useEffect } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  extra?: any;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  renderOption?: (option: ComboboxOption, active: boolean) => React.ReactNode;
}

export function Combobox({ options, value, onChange, placeholder, disabled, renderOption }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const openedByUser = useRef(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Only open dropdown on user action, not on mount/value change
  useEffect(() => {
    if (!open) openedByUser.current = false;
  }, [open]);

  useEffect(() => {
    setHighlighted(filtered.findIndex(opt => opt.value === value));
  }, [value, search]);

  // Track if user has clicked input for typing
  const [typingMode, setTypingMode] = useState(false);

  // Helper to format date string as dd-mm-yyyy
  function formatDateDDMMYYYY(val: string): string {
    // Accept yyyy-mm-dd or yyyy-mm-ddTHH:mm:ss
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
    if (match) {
      // match[1]=yyyy, match[2]=mm, match[3]=dd
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return val;
  }

  // If not typing, show label, but if value is a date, format as dd-mm-yyyy
  let displayValue = '';
  if (typingMode) {
    displayValue = search;
  } else {
    const opt = options.find(opt => opt.value === value);
    if (opt) {
      // If label is a date, format it
      if (/^\d{4}-\d{2}-\d{2}/.test(opt.label)) {
        displayValue = formatDateDDMMYYYY(opt.label);
      } else if (/^\d{4}-\d{2}-\d{2}/.test(opt.value)) {
        displayValue = formatDateDDMMYYYY(opt.value);
      } else {
        displayValue = opt.label;
      }
    }
  }
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400"
        placeholder={placeholder}
        value={displayValue}
        readOnly={!typingMode}
        onFocus={e => {
          // Do not enter typing mode on focus (e.g. tab), only on click
        }}
        onClick={e => {
          if (open) {
            setOpen(false);
            setTypingMode(false);
          } else {
            setOpen(true);
            openedByUser.current = true;
            setTypingMode(true);
            setTimeout(() => inputRef.current?.select(), 0);
          }
        }}
        onBlur={e => {
          setTypingMode(false);
        }}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            setOpen(true);
            setHighlighted(h => Math.min(h + 1, filtered.length - 1));
            e.preventDefault();
          } else if (e.key === 'ArrowUp') {
            setOpen(true);
            setHighlighted(h => Math.max(h - 1, 0));
            e.preventDefault();
          } else if (e.key === 'Enter' && highlighted >= 0) {
            onChange(filtered[highlighted].value);
            setOpen(false);
            setSearch('');
            setTypingMode(false);
            e.preventDefault();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setSearch('');
            setTypingMode(false);
          }
        }}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-gray-400 text-sm">Tidak ada data</div>
          )}
          {filtered.map((opt, idx) => (
            <div
              key={opt.value}
              className={`px-3 py-2 cursor-pointer text-sm ${idx === highlighted ? 'bg-blue-100' : ''}`}
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false); setSearch(''); setTypingMode(false); }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              {renderOption ? renderOption(opt, idx === highlighted) : opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
