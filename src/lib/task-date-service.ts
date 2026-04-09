import type { DatePreset } from "@/lib/task-types";

export type CalendarCell = {
  date: Date;
  inMonth: boolean;
  key: string;
};

export class TaskDateService {
  static readonly presetOptions: ReadonlyArray<{ value: Exclude<DatePreset, "custom">; label: string }> = [
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "next-week", label: "Next Week" },
    { value: "next-month", label: "Next Month" },
  ];

  static readonly reminderQuickOptions = [
    { label: "Morning", hour: 9, minute: 0 },
    { label: "Afternoon", hour: 13, minute: 0 },
    { label: "Evening", hour: 18, minute: 0 },
  ] as const;

  static readonly calendarWeekdays = ["S", "M", "T", "W", "T", "F", "S"] as const;

  static toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  static toDateTimeLocalValue(value: string | null): string {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  static toIsoStringOrNull(value: string): string | null {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString();
  }

  static dateForPreset(preset: Exclude<DatePreset, "custom">): string {
    const base = new Date();

    if (preset === "today") return TaskDateService.toDateOnly(base);

    if (preset === "tomorrow") {
      base.setDate(base.getDate() + 1);
      return TaskDateService.toDateOnly(base);
    }

    if (preset === "next-week") {
      base.setDate(base.getDate() + 7);
      return TaskDateService.toDateOnly(base);
    }

    base.setMonth(base.getMonth() + 1);
    return TaskDateService.toDateOnly(base);
  }

  static detectPreset(dateOnly: string): DatePreset {
    for (const preset of TaskDateService.presetOptions.map((item) => item.value)) {
      if (TaskDateService.dateForPreset(preset) === dateOnly) {
        return preset;
      }
    }

    return "custom";
  }

  static formatFullDate(date: Date = new Date()): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  static formatDueDate(dateOnly: string): string {
    const today = TaskDateService.toDateOnly(new Date());
    const tomorrow = TaskDateService.dateForPreset("tomorrow");

    if (dateOnly < today) return "Overdue";
    if (dateOnly === today) return "Today";
    if (dateOnly === tomorrow) return "Tomorrow";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(`${dateOnly}T12:00:00`));
  }

  static formatReminder(dateTime: string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).format(new Date(dateTime));
  }

  static formatReminderPicker(dateTime: string): string {
    if (!dateTime) return "Pick a date";

    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return "Pick a date";

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).format(parsed);
  }

  static formatPickerDate(dateOnly: string): string {
    if (!dateOnly) return "Pick a date";

    const parsed = new Date(`${dateOnly}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return "Pick a date";

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }

  static parseDateOnly(dateOnly: string): Date | null {
    if (!dateOnly) return null;

    const parsed = new Date(`${dateOnly}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed;
  }

  static formatMonthHeading(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  static buildCalendarGrid(monthStart: Date): CalendarCell[] {
    const firstInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const gridStart = new Date(firstInMonth);
    gridStart.setDate(firstInMonth.getDate() - firstInMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);

      return {
        date: cellDate,
        inMonth: cellDate.getMonth() === monthStart.getMonth(),
        key: `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`,
      };
    });
  }

  static isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }
}
