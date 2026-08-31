import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  multilineValue?: boolean;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Pilih data...",
  searchPlaceholder = "Cari data...",
  emptyText = "Data tidak ditemukan",
  disabled = false,
  className,
  contentClassName,
  multilineValue = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return options;

    return options.filter((option) => {
      const text = `${option.label} ${option.keywords || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [options, search]);

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between border-2 border-gray-200 bg-white px-3 text-left font-normal text-gray-900 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-100",
            multilineValue ? "min-h-10 py-2" : "h-10",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1",
              multilineValue ? "whitespace-normal break-words leading-snug" : "truncate",
              !selectedOption && "text-gray-500",
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "z-[90] w-[var(--radix-popover-trigger-width)] min-w-[240px] p-2",
          contentClassName,
        )}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 border-2 border-gray-200 pl-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
        </div>
        <div
          className="mt-2 max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-4rem))] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-5 text-center text-sm text-gray-500">{emptyText}</div>
          ) : (
            filteredOptions.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm text-gray-900 transition-colors hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50",
                    active && "bg-yellow-400 hover:bg-yellow-400",
                  )}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 whitespace-normal break-words">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
