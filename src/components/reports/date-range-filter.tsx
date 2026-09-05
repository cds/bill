'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [date, setDate] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [preset, setPreset] = useState<string>('this_month');
  const [open, setOpen] = useState(false);

  const updateUrl = useCallback((start: Date, end: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start', format(start, 'yyyy-MM-dd'));
    params.set('end', format(end, 'yyyy-MM-dd'));
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const applyPreset = useCallback((presetValue: string) => {
    setPreset(presetValue);
    const today = new Date();
    
    if (presetValue === 'this_month') {
      const from = startOfMonth(today);
      const to = endOfMonth(today);
      setDate({ from, to });
      updateUrl(from, to);
    } else if (presetValue === 'last_month') {
      const lastMonth = subMonths(today, 1);
      const from = startOfMonth(lastMonth);
      const to = endOfMonth(lastMonth);
      setDate({ from, to });
      updateUrl(from, to);
    }
  }, [updateUrl]);

  // Initialize from URL
  useEffect(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
    if (start && end) {
      setDate({ from: new Date(start), to: new Date(end) });
      // Determine if it matches preset
      const today = new Date();
      if (start === format(startOfMonth(today), 'yyyy-MM-dd') && end === format(endOfMonth(today), 'yyyy-MM-dd')) {
        setPreset('this_month');
      } else if (start === format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd') && end === format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')) {
        setPreset('last_month');
      } else {
        setPreset('custom');
      }
    } else {
      applyPreset('this_month');
    }
  }, [searchParams, applyPreset]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-center print:hidden">
      <Select value={preset} onValueChange={(val) => {
        if (!val) return;
        if (val === 'custom') setPreset('custom');
        else applyPreset(val);
      }}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger 
            className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarIcon className="h-4 w-4 opacity-50" />
            <span className="flex-1 text-left">
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date</span>
              )}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={(range) => {
                setDate(range as any);
                if (range?.from && range?.to) {
                  updateUrl(range.from, range.to);
                  setOpen(false);
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
