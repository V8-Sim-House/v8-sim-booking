"use client";
import { useEffect, useRef, useState } from "react";
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore,
  addMonths, subMonths, startOfDay,
} from "date-fns";

interface Props {
  value: string;       // "YYYY-MM-DD"
  onChange: (date: string) => void;
  minDate?: Date;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DatePicker({ value, onChange, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);
  const min = minDate ?? startOfDay(new Date());

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  });

  const handleSelect = (day: Date) => {
    if (isBefore(day, min)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`v8-input flex items-center justify-between text-left w-full ${!value ? "text-brand-text-muted" : "text-brand-text"}`}
      >
        <span>{value ? format(parseISO(value), "MMMM d, yyyy") : "Select a date"}</span>
        <svg className="w-4 h-4 text-brand-text-muted shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-brand-card-bg border border-brand-border-subtle rounded-xl shadow-2xl p-4 w-72 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-red hover:bg-brand-border-subtle transition-colors"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-brand-text uppercase tracking-widest">
              {format(viewMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-red hover:bg-brand-border-subtle transition-colors"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-brand-text-muted uppercase py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const disabled = isBefore(day, min);
              const isSelected = selected && isSameDay(day, selected);
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isCurrentDay = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelect(day)}
                  className={[
                    "h-9 w-9 rounded-md text-sm font-medium transition-colors mx-auto flex items-center justify-center",
                    !isCurrentMonth && "opacity-25",
                    disabled && "cursor-not-allowed opacity-20",
                    isSelected && "bg-brand-red text-white font-bold",
                    !isSelected && isCurrentDay && "border border-brand-red/50 text-brand-red",
                    !isSelected && !disabled && isCurrentMonth && "text-brand-text hover:bg-brand-red/20 hover:text-brand-red",
                    !isSelected && !disabled && !isCurrentMonth && "text-brand-text-muted",
                  ].filter(Boolean).join(" ")}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
