import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, X } from 'lucide-react';
import { formatDateKey } from '@/lib/dateUtils';

interface DateSelectorProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  month: string; // e.g., "Aug 2025"
}

const DateSelector = ({ selectedDates, onDatesChange, month }: DateSelectorProps) => {
  const [newDate, setNewDate] = useState('');

  // Parse "Aug 2025" -> {year, monthIndex}
  const parseMonth = () => {
    const [monthName, yearStr] = month.split(' ');
    const year = Number(yearStr);
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    return { year, monthIndex };
  };

  const inSelectedMonth = (d: Date) => {
    const { year, monthIndex } = parseMonth();
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  };

  const sortAsc = (arr: Date[]) => arr.sort((a, b) => a.getTime() - b.getTime());

  const addCustomDate = () => {
    if (!newDate) return;

    try {
      // Input type="date" yields "YYYY-MM-DD" which new Date() treats as UTC
      const d = new Date(newDate);
      if (Number.isNaN(d.getTime())) return;

      // Enforce selected month/year
      if (!inSelectedMonth(d)) {
        // Optional: show a toast instead of silently returning
        // toast({ title: 'Pick a date in the selected month', variant: 'destructive' });
        return;
      }

      // De-dupe using epoch time
      const exists = selectedDates.some(x => x.getTime() === d.getTime());
      if (!exists) {
        onDatesChange(sortAsc([...selectedDates, d]));
      }

      setNewDate('');
    } catch (err) {
      console.error('Invalid date:', err);
    }
  };

  const removeDate = (dateToRemove: Date) => {
    const updated = selectedDates.filter(d => d.getTime() !== dateToRemove.getTime());
    onDatesChange(updated);
  };

  const generateWeeklyDates = () => {
    const { year, monthIndex } = parseMonth();

    const dates: Date[] = [];
    // Start at 1st of month (local time)
    const start = new Date(year, monthIndex, 1);

    // Find first Monday (1). Change this if your default lesson day should be Tue/Wed/etc.
    const first = new Date(start);
    while (first.getDay() !== 1) {
      first.setDate(first.getDate() + 1);
    }

    // Add 4–5 weekly slots that remain within month
    const cur = new Date(first);
    for (let i = 0; i < 5; i++) {
      if (cur.getMonth() !== monthIndex) break;
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }

    // Merge with any existing dates, de-dupe, and sort
    const merged = [...selectedDates, ...dates];
    const uniqueByTime = Array.from(new Map(merged.map(d => [d.getTime(), d])).values());
    onDatesChange(sortAsc(uniqueByTime));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        <h3 className="font-medium">Lesson Dates</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedDates.map((date) => (
          <Badge key={date.getTime()} variant="secondary" className="flex items-center gap-1">
            {formatDateKey(date)}
            <button
              onClick={() => removeDate(date)}
              className="ml-1 hover:text-destructive transition-colors"
              aria-label="Remove date"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateWeeklyDates}
        >
          Generate Weekly Lessons
        </Button>

        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={addCustomDate}
            disabled={!newDate}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {selectedDates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No lesson dates selected. Use "Generate Weekly Lessons" for a quick start or add custom dates.
        </p>
      )}
    </div>
  );
};

export default DateSelector;
