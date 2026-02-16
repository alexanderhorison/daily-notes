import { type FormEvent, type TouchEvent as ReactTouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignIn, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Loader2, PenLine, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createClerkSupabaseClient,
  hasSupabaseEnv,
  type DbTaskRow,
  type Priority,
} from "@/lib/supabase";
import { cn } from "@/lib/utils";

type DatePreset = "today" | "tomorrow" | "next-week" | "next-month" | "custom";

type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  reminderAt: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
};

type FormErrors = Partial<Record<"title" | "dueDate" | "reminderAt" | "notes", string>>;

const priorityRank: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Task is required").max(160, "Task title is too long"),
    dueDate: z
      .string()
      .regex(dateOnlyRegex, "Choose a valid due date")
      .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00`).getTime()), "Choose a valid due date"),
    priority: z.enum(["low", "medium", "high"]),
    reminderAt: z
      .string()
      .trim()
      .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Reminder date is invalid"),
    notes: z.string().trim().max(1000, "Notes are too long"),
  })
  .superRefine((data, ctx) => {
    if (!data.reminderAt) return;

    const reminderTime = new Date(data.reminderAt).getTime();
    const dueBoundary = new Date(`${data.dueDate}T23:59:59`).getTime();

    if (reminderTime > dueBoundary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reminderAt"],
        message: "Reminder should be on or before the due date",
      });
    }
  });

const presetOptions: ReadonlyArray<{ value: Exclude<DatePreset, "custom">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next-week", label: "Next Week" },
  { value: "next-month", label: "Next Month" },
];
const reminderQuickOptions = [
  { label: "Morning", hour: 9, minute: 0 },
  { label: "Afternoon", hour: 13, minute: 0 },
  { label: "Evening", hour: 18, minute: 0 },
] as const;

const formErrorKeys = ["title", "dueDate", "reminderAt", "notes"] as const;
type FormErrorKey = (typeof formErrorKeys)[number];
const calendarWeekdays = ["S", "M", "T", "W", "T", "F", "S"] as const;
const pullRefreshTriggerPx = 72;
const pullRefreshMaxPx = 96;

function isFormErrorKey(value: string): value is FormErrorKey {
  return formErrorKeys.includes(value as FormErrorKey);
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(value: string | null): string {
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

function toIsoStringOrNull(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function dateForPreset(preset: Exclude<DatePreset, "custom">): string {
  const base = new Date();

  if (preset === "today") return toDateOnly(base);

  if (preset === "tomorrow") {
    base.setDate(base.getDate() + 1);
    return toDateOnly(base);
  }

  if (preset === "next-week") {
    base.setDate(base.getDate() + 7);
    return toDateOnly(base);
  }

  base.setMonth(base.getMonth() + 1);
  return toDateOnly(base);
}

function detectPreset(dateOnly: string): DatePreset {
  for (const preset of presetOptions.map((item) => item.value)) {
    if (dateForPreset(preset) === dateOnly) {
      return preset;
    }
  }

  return "custom";
}

function formatFullDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDueDate(dateOnly: string): string {
  const today = toDateOnly(new Date());
  const tomorrow = dateForPreset("tomorrow");

  if (dateOnly < today) return "Overdue";
  if (dateOnly === today) return "Today";
  if (dateOnly === tomorrow) return "Tomorrow";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateOnly}T12:00:00`));
}

function formatReminder(dateTime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

function formatPickerDate(dateOnly: string): string {
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

function parseDateOnly(dateOnly: string): Date | null {
  if (!dateOnly) return null;

  const parsed = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatMonthHeading(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildCalendarGrid(monthStart: Date): Array<{ date: Date; inMonth: boolean; key: string }> {
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

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sortTasks(a: Task, b: Task): number {
  if (a.completed !== b.completed) {
    return Number(a.completed) - Number(b.completed);
  }

  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }

  return a.createdAt.localeCompare(b.createdAt);
}

function priorityStyle(priority: Priority): string {
  if (priority === "high") return "border-rose-300 text-rose-800 bg-rose-50";
  if (priority === "medium") return "border-amber-300 text-amber-800 bg-amber-50";

  return "border-stone-300 text-stone-700 bg-stone-100";
}

function fromTaskRow(row: DbTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes || "",
    dueDate: row.due_date,
    reminderAt: toDateTimeLocalValue(row.reminder_at),
    priority: row.priority,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

function mapZodErrors(error: z.ZodError): FormErrors {
  const next: FormErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field !== "string" || !isFormErrorKey(field) || next[field]) {
      continue;
    }

    next[field] = issue.message;
  }

  return next;
}

function isPriority(value: string): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

type TaskRowProps = {
  task: Task;
  compact?: boolean;
  isEditing?: boolean;
  swipeEnabled?: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

function TaskRow({
  task,
  compact = false,
  isEditing = false,
  swipeEnabled = false,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
}: TaskRowProps): JSX.Element {
  const actionWidth = 88;
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const dragBaseRef = useRef(0);
  const isSwipingRef = useRef(false);
  const isSwipeOpen = swipeOffset > 2;

  useEffect(() => {
    if (!swipeEnabled && swipeOffset !== 0) {
      setSwipeOffset(0);
    }
  }, [swipeEnabled, swipeOffset]);

  function closeSwipeIfOpen(): boolean {
    if (swipeOffset > 0) {
      setSwipeOffset(0);
      return true;
    }

    return false;
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!swipeEnabled || disabled) return;

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    dragBaseRef.current = swipeOffset;
    isSwipingRef.current = false;
    setIsDragging(true);
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!swipeEnabled || disabled) return;

    const touch = event.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (!isSwipingRef.current) {
      if (Math.abs(dx) < 12) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.9) {
        setIsDragging(false);
        return;
      }
      isSwipingRef.current = true;
    }

    event.preventDefault();
    const next = Math.min(actionWidth, Math.max(0, dragBaseRef.current - dx));
    setSwipeOffset(next);
  }

  function handleTouchEnd(): void {
    if (!swipeEnabled || disabled) return;

    setIsDragging(false);

    if (!isSwipingRef.current) return;

    setSwipeOffset((prev) => (prev > actionWidth * 0.45 ? actionWidth : 0));
    isSwipingRef.current = false;
  }

  const content = (
    <div
      className={cn(
        "grid gap-2.5 rounded-xl border border-stone-300 bg-stone-50 p-3",
        compact ? "grid-cols-[1fr_auto] items-center" : "grid-cols-[auto_1fr_auto] items-start",
        task.completed && "bg-stone-50",
        isEditing && "border-stone-500 shadow-[inset_0_0_0_2px_rgba(120,113,108,0.2)]",
      )}
    >
      {!compact ? (
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => {
            if (disabled) return;
            if (closeSwipeIfOpen()) return;
            onToggle(task.id);
          }}
          className="mt-0.5 h-6 w-6 rounded-lg"
          aria-label={`Mark ${task.title} as completed`}
          disabled={disabled}
        />
      ) : null}

      <div>
        <p className={cn("text-sm font-semibold text-stone-900", task.completed && "line-through")}>{task.title}</p>
        {!compact && task.notes ? <p className="mt-1 text-sm text-stone-500">{task.notes}</p> : null}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline">{formatDueDate(task.dueDate)}</Badge>
          <Badge variant="outline" className={priorityStyle(task.priority)}>
            {task.priority[0].toUpperCase() + task.priority.slice(1)}
          </Badge>
          {task.reminderAt ? <Badge variant="outline">Reminder {formatReminder(task.reminderAt)}</Badge> : null}
        </div>
      </div>

      <div className={cn("flex gap-1 transition-all duration-150", swipeEnabled && isSwipeOpen && "pointer-events-none opacity-0")}>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-lg text-stone-700 hover:bg-stone-100"
          onClick={() => {
            if (disabled) return;
            if (closeSwipeIfOpen()) return;
            onEdit(task.id);
          }}
          aria-label={`Edit ${task.title}`}
          disabled={disabled}
        >
          <PenLine className="h-5 w-5" />
        </Button>

        {!swipeEnabled ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-lg text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={() => {
              if (disabled) return;
              onDelete(task.id);
            }}
            aria-label={`Delete ${task.title}`}
            disabled={disabled}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (!swipeEnabled) {
    return <li>{content}</li>;
  }

  return (
    <li className="relative overflow-hidden rounded-xl">
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-r-xl bg-rose-700 transition-opacity duration-150",
          isSwipeOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Button
          variant="ghost"
          className="h-full w-full rounded-none text-rose-50 hover:bg-rose-800 hover:text-rose-50"
          onClick={() => {
            if (disabled) return;
            onDelete(task.id);
          }}
          aria-label={`Delete ${task.title}`}
          disabled={disabled}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <div
        className={cn("relative touch-pan-y", !isDragging && "transition-transform duration-150")}
        style={{ transform: `translateX(-${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {content}
      </div>
    </li>
  );
}

function SignedOutView(): JSX.Element {
  const signInAppearance = {
    variables: {
      colorPrimary: "#4a443b",
      colorText: "#2f2b25",
      colorTextSecondary: "#6d665a",
      colorBackground: "#fcfaf6",
      colorInputBackground: "#f5f1e9",
      colorInputText: "#2f2b25",
      colorDanger: "#a45447",
      borderRadius: "0.75rem",
      fontFamily: "'Noto Sans JP', 'Manrope', sans-serif",
    },
    elements: {
      cardBox: "shadow-none",
      card: "rounded-2xl border border-stone-300 bg-stone-50 shadow-sm",
      headerTitle: "text-stone-900 text-2xl font-bold tracking-tight",
      headerSubtitle: "text-stone-600",
      socialButtonsBlockButton: "h-11 rounded-lg border border-stone-300 bg-stone-100 text-stone-800 shadow-none hover:bg-stone-200",
      socialButtonsBlockButtonText: "font-medium text-stone-800",
      dividerLine: "bg-stone-300",
      dividerText: "text-stone-500",
      formFieldLabel: "font-medium text-stone-700",
      formFieldInput:
        "h-11 rounded-lg border border-stone-300 bg-stone-50 text-stone-900 placeholder:text-stone-400 focus:ring-stone-400",
      formButtonPrimary: "h-11 rounded-lg bg-stone-700 text-stone-50 shadow-none hover:bg-stone-800",
      footerActionText: "text-stone-500 hidden",
      footerActionLink: "text-stone-800 hover:text-stone-900 hidden",
      footer: "hidden",
      footerPages: "hidden",
      identityPreviewText: "text-stone-600",
      identityPreviewEditButton: "text-stone-700 hover:text-stone-900",
    },
  } as const;

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-stone-300 bg-stone-50 shadow-sm">
        <div className="grid lg:min-h-[640px] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="hidden border-r border-stone-300 bg-[#f1ece2] p-8 lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Reminders</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-stone-900">Quietly organize what matters today.</h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-600">
                A practical, clean space for your daily reminders with minimal visual noise.
              </p>
            </div>

            <div className="rounded-xl border border-stone-300 bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Daily Focus</p>
              <p className="mt-2 text-sm text-stone-700">Plan today, keep upcoming in view, and stay calm.</p>
            </div>
          </section>

          <section className="flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md">
              <div className="mb-4 text-center lg:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Reminders</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Welcome back</h1>
                <p className="mt-1 text-sm text-stone-600">Sign in to continue your daily focus.</p>
              </div>

              <SignIn routing="virtual" appearance={signInAppearance} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SignedInView(): JSX.Element {
  const { userId, getToken, isLoaded } = useAuth();

  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isMobile, setIsMobile] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickAddClosing, setIsQuickAddClosing] = useState(false);
  const [isQuickAddDragging, setIsQuickAddDragging] = useState(false);
  const [quickAddDragY, setQuickAddDragY] = useState(0);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("today");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(dateForPreset("today"));
  const [dueDateMonth, setDueDateMonth] = useState(() => {
    const initial = parseDateOnly(dateForPreset("today")) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>("medium");
  const [reminderAt, setReminderAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const pullStartRef = useRef<number | null>(null);
  const quickAddTouchStartRef = useRef<number | null>(null);
  const quickAddCanDragRef = useRef(false);
  const quickAddCloseTimerRef = useRef<number | null>(null);
  const quickAddScrollRef = useRef<HTMLDivElement | null>(null);
  const dueDatePickerRef = useRef<HTMLDivElement | null>(null);
  const loadedUserRef = useRef<string | null>(null);

  function clearFormError(field: FormErrorKey): void {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncMedia = () => setIsMobile(mediaQuery.matches);

    syncMedia();
    mediaQuery.addEventListener("change", syncMedia);
    return () => mediaQuery.removeEventListener("change", syncMedia);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsQuickAddOpen(false);
      setIsQuickAddClosing(false);
      setIsQuickAddDragging(false);
      setQuickAddDragY(0);
    }
  }, [isMobile]);

  useEffect(() => {
    return () => {
      if (quickAddCloseTimerRef.current) {
        window.clearTimeout(quickAddCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPreset === "custom") return;
    setDueDate(dateForPreset(selectedPreset));
    clearFormError("dueDate");
  }, [selectedPreset]);

  useEffect(() => {
    const parsed = parseDateOnly(dueDate);
    if (!parsed) return;

    setDueDateMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [dueDate]);

  useEffect(() => {
    if (isQuickAddOpen) return;
    setIsDueDatePickerOpen(false);
  }, [isQuickAddOpen]);

  useEffect(() => {
    if (!isDueDatePickerOpen) return;

    function handleOutsidePointer(event: MouseEvent | globalThis.TouchEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!dueDatePickerRef.current?.contains(target)) {
        setIsDueDatePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [isDueDatePickerOpen]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsLoadingTasks(false);
    }
  }, []);

  const loadTasks = useCallback(
    async (showLoadingState: boolean): Promise<void> => {
      if (!isLoaded || !userId || !supabase) return;

      if (showLoadingState) {
        setIsLoadingTasks(true);
      }

      setErrorMessage("");
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, clerk_user_id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at")
          .eq("clerk_user_id", userId)
          .order("due_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) {
          setErrorMessage(error.message || "Failed to load tasks.");
          setTasks([]);
        } else {
          const rows = data ?? [];
          setTasks(rows.map(fromTaskRow));
        }
      } catch {
        setErrorMessage("Failed to load tasks.");
        setTasks([]);
      } finally {
        if (showLoadingState) {
          setIsLoadingTasks(false);
        }
      }
    },
    [isLoaded, userId, supabase],
  );

  useEffect(() => {
    if (!isLoaded || !userId || !supabase) return;
    if (loadedUserRef.current === userId) return;

    loadedUserRef.current = userId;
    void loadTasks(true);
  }, [isLoaded, userId, supabase, loadTasks]);

  useEffect(() => {
    if (userId) return;
    loadedUserRef.current = null;
  }, [userId]);

  const todayKey = toDateOnly(new Date());

  const todayTasks = useMemo(() => tasks.filter((task) => task.dueDate <= todayKey).sort(sortTasks), [tasks, todayKey]);

  const upcomingTasks = useMemo(
    () => tasks.filter((task) => task.dueDate > todayKey).sort(sortTasks).slice(0, 6),
    [tasks, todayKey],
  );

  const deleteCandidateTask = useMemo(
    () => tasks.find((task) => task.id === deleteCandidateId) || null,
    [tasks, deleteCandidateId],
  );

  useEffect(() => {
    if (deleteCandidateId && !tasks.some((task) => task.id === deleteCandidateId)) {
      setDeleteCandidateId(null);
    }
  }, [tasks, deleteCandidateId]);

  const refreshTasks = useCallback(async (): Promise<void> => {
    if (isRefreshing || isMutating) return;

    setIsRefreshing(true);
    try {
      await loadTasks(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isMutating, loadTasks]);

  function handleRootTouchStart(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!isMobile || isQuickAddOpen || deleteCandidateId || isMutating || isLoadingTasks || isRefreshing) {
      pullStartRef.current = null;
      return;
    }

    if (window.scrollY > 0) {
      pullStartRef.current = null;
      return;
    }

    pullStartRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleRootTouchMove(event: ReactTouchEvent<HTMLDivElement>): void {
    if (pullStartRef.current === null) return;

    const currentY = event.touches[0]?.clientY ?? pullStartRef.current;
    const delta = currentY - pullStartRef.current;

    if (delta <= 0 || window.scrollY > 0) {
      setPullDistance(0);
      return;
    }

    const nextDistance = Math.min(pullRefreshMaxPx, delta * 0.45);
    setPullDistance(nextDistance);
    event.preventDefault();
  }

  function handleRootTouchEnd(): void {
    if (pullStartRef.current === null) return;

    if (pullDistance >= pullRefreshTriggerPx) {
      void refreshTasks();
    }

    setPullDistance(0);
    pullStartRef.current = null;
  }

  function handleQuickAddTouchStart(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!isMobile || isQuickAddClosing) return;

    const target = event.target as HTMLElement;
    const isGrabZone = Boolean(target.closest("[data-sheet-grab='true']"));
    quickAddTouchStartRef.current = event.touches[0]?.clientY ?? null;
    quickAddCanDragRef.current = isGrabZone || (quickAddScrollRef.current?.scrollTop ?? 0) <= 0;
    setIsQuickAddDragging(false);
  }

  function handleQuickAddTouchMove(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!quickAddCanDragRef.current || quickAddTouchStartRef.current === null || isQuickAddClosing) return;

    const currentY = event.touches[0]?.clientY ?? quickAddTouchStartRef.current;
    const delta = currentY - quickAddTouchStartRef.current;

    if (delta <= 0) {
      setIsQuickAddDragging(false);
      setQuickAddDragY(0);
      return;
    }

    setIsQuickAddDragging(true);
    setQuickAddDragY(Math.min(window.innerHeight, delta));
    event.preventDefault();
  }

  function handleQuickAddTouchEnd(): void {
    const shouldClose = quickAddCanDragRef.current && quickAddDragY > 120;

    quickAddTouchStartRef.current = null;
    quickAddCanDragRef.current = false;

    if (shouldClose) {
      requestCloseQuickAddSheet();
      return;
    }

    setIsQuickAddDragging(false);
    setQuickAddDragY(0);
  }

  function applyReminderPreset(hour: number, minute: number): void {
    if (!dueDate) return;

    const hourPart = String(hour).padStart(2, "0");
    const minutePart = String(minute).padStart(2, "0");
    setReminderAt(`${dueDate}T${hourPart}:${minutePart}`);
    clearFormError("reminderAt");
  }

  const selectedDueDate = useMemo(() => parseDateOnly(dueDate), [dueDate]);
  const calendarCells = useMemo(() => buildCalendarGrid(dueDateMonth), [dueDateMonth]);

  function moveDueDateMonth(monthDelta: number): void {
    setDueDateMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + monthDelta, 1));
  }

  function pickDueDate(date: Date): void {
    const nextDateOnly = toDateOnly(date);
    setDueDate(nextDateOnly);
    setSelectedPreset(detectPreset(nextDateOnly));
    clearFormError("dueDate");
    setIsDueDatePickerOpen(false);
  }

  function openDueDatePicker(): void {
    const parsed = parseDateOnly(dueDate);
    if (parsed) {
      setDueDateMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }

    setIsDueDatePickerOpen((previous) => !previous);
  }

  function resetFormFields(): void {
    setEditingTaskId(null);
    setTitle("");
    setPriority("medium");
    setReminderAt("");
    setNotes("");
    setSelectedPreset("today");
    setDueDate(dateForPreset("today"));
    setFormErrors({});
  }

  function presentQuickAddSheet(): void {
    if (!isMobile) return;

    if (quickAddCloseTimerRef.current) {
      window.clearTimeout(quickAddCloseTimerRef.current);
      quickAddCloseTimerRef.current = null;
    }

    setIsQuickAddOpen(true);
    setIsQuickAddClosing(false);
    setIsQuickAddDragging(false);
    const startOffset = window.innerHeight;
    setQuickAddDragY(startOffset);
    window.requestAnimationFrame(() => {
      setQuickAddDragY(0);
    });
  }

  function requestCloseQuickAddSheet(): void {
    if (!isQuickAddOpen || isQuickAddClosing) return;

    setIsQuickAddClosing(true);
    setIsQuickAddDragging(false);
    setQuickAddDragY(window.innerHeight);

    if (quickAddCloseTimerRef.current) {
      window.clearTimeout(quickAddCloseTimerRef.current);
    }

    quickAddCloseTimerRef.current = window.setTimeout(() => {
      setIsQuickAddOpen(false);
      setIsQuickAddClosing(false);
      setQuickAddDragY(0);
      resetFormFields();
      quickAddCloseTimerRef.current = null;
    }, 220);
  }

  function resetForm({ closeQuickAdd = false }: { closeQuickAdd?: boolean } = {}): void {
    if (closeQuickAdd && isMobile) {
      requestCloseQuickAddSheet();
      return;
    }

    resetFormFields();

    if (closeQuickAdd) {
      setIsQuickAddOpen(false);
    }
  }

  function openQuickAddForCreate(): void {
    resetFormFields();
    if (isMobile) {
      presentQuickAddSheet();
      return;
    }

    setIsQuickAddOpen(true);
  }

  function closeQuickAdd(): void {
    if (isMobile) {
      requestCloseQuickAddSheet();
      return;
    }

    resetForm({ closeQuickAdd: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!userId || !supabase) return;

    const parsed = taskFormSchema.safeParse({
      title,
      dueDate,
      priority,
      reminderAt,
      notes,
    });

    if (!parsed.success) {
      setFormErrors(mapZodErrors(parsed.error));
      return;
    }

    setFormErrors({});
    setIsMutating(true);
    setErrorMessage("");

    const payload = {
      title: parsed.data.title,
      due_date: parsed.data.dueDate,
      priority: parsed.data.priority,
      reminder_at: toIsoStringOrNull(parsed.data.reminderAt),
      notes: parsed.data.notes,
    };

    if (editingTaskId) {
      const { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", editingTaskId)
        .eq("clerk_user_id", userId)
        .select("id, clerk_user_id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at")
        .single();

      if (error || !data) {
        setErrorMessage(error?.message || "Failed to update task.");
        setIsMutating(false);
        return;
      }

      setTasks((prev) => prev.map((task) => (task.id === editingTaskId ? fromTaskRow(data) : task)));
    } else {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          clerk_user_id: userId,
          ...payload,
        })
        .select("id, clerk_user_id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at")
        .single();

      if (error || !data) {
        setErrorMessage(error?.message || "Failed to create task.");
        setIsMutating(false);
        return;
      }

      setTasks((prev) => [...prev, fromTaskRow(data)]);
    }

    setIsMutating(false);
    resetForm({ closeQuickAdd: isMobile });
  }

  function startEdit(id: string): void {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    setEditingTaskId(task.id);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setReminderAt(task.reminderAt);
    setNotes(task.notes);
    setSelectedPreset(detectPreset(task.dueDate));
    setFormErrors({});

    if (isMobile) {
      presentQuickAddSheet();
    }
  }

  async function toggleTask(id: string): Promise<void> {
    if (!userId || !supabase) return;

    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;

    setIsMutating(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("tasks")
      .update({ completed: !currentTask.completed })
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select("id, clerk_user_id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message || "Failed to update task status.");
      setIsMutating(false);
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === id ? fromTaskRow(data) : task)));
    setIsMutating(false);
  }

  function requestDelete(id: string): void {
    setDeleteCandidateId(id);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteCandidateId || !userId || !supabase) return;

    setIsMutating(true);
    setErrorMessage("");

    const { error } = await supabase.from("tasks").delete().eq("id", deleteCandidateId).eq("clerk_user_id", userId);

    if (error) {
      setErrorMessage(error.message || "Failed to delete task.");
      setIsMutating(false);
      return;
    }

    if (editingTaskId === deleteCandidateId) {
      resetForm({ closeQuickAdd: isMobile });
    }

    setTasks((prev) => prev.filter((task) => task.id !== deleteCandidateId));
    setDeleteCandidateId(null);
    setIsMutating(false);
  }

  function cancelDelete(): void {
    setDeleteCandidateId(null);
  }

  async function clearCompleted(): Promise<void> {
    if (!userId || !supabase) return;

    const completedTaskIds = tasks.filter((task) => task.completed).map((task) => task.id);
    if (!completedTaskIds.length) return;

    setIsMutating(true);
    setErrorMessage("");

    const { error } = await supabase.from("tasks").delete().in("id", completedTaskIds).eq("clerk_user_id", userId);

    if (error) {
      setErrorMessage(error.message || "Failed to clear completed tasks.");
      setIsMutating(false);
      return;
    }

    if (editingTaskId && completedTaskIds.includes(editingTaskId)) {
      resetForm({ closeQuickAdd: isMobile });
    }

    setTasks((prev) => prev.filter((task) => !task.completed));
    setIsMutating(false);
  }

  function renderQuickAddForm(idPrefix: "desktop" | "mobile"): JSX.Element {
    const isMobileForm = idPrefix === "mobile";
    const titleErrorId = `${idPrefix}-title-error`;
    const dueDateErrorId = `${idPrefix}-due-date-error`;
    const reminderErrorId = `${idPrefix}-reminder-error`;
    const notesErrorId = `${idPrefix}-notes-error`;

    return (
      <form
        className={cn("grid gap-3", isMobileForm && "pb-[calc(6rem+env(safe-area-inset-bottom))]")}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-task-title`}>Task</Label>
          <Input
            id={`${idPrefix}-task-title`}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearFormError("title");
            }}
            placeholder="Pay electricity bill"
            aria-invalid={Boolean(formErrors.title)}
            aria-describedby={formErrors.title ? titleErrorId : undefined}
            disabled={isMutating}
          />
          {formErrors.title ? (
            <p id={titleErrorId} className="text-xs font-medium text-rose-700">
              {formErrors.title}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label>When</Label>
          <div className="flex flex-wrap gap-2">
            {presetOptions.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={selectedPreset === preset.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedPreset(preset.value);
                  setIsDueDatePickerOpen(false);
                }}
                disabled={isMutating}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="relative" ref={dueDatePickerRef}>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-between rounded-xl px-3 text-left font-medium text-stone-900"
              aria-expanded={isDueDatePickerOpen}
              aria-haspopup="dialog"
              aria-invalid={Boolean(formErrors.dueDate)}
              aria-describedby={formErrors.dueDate ? dueDateErrorId : undefined}
              onClick={openDueDatePicker}
              disabled={isMutating}
            >
              <span>{formatPickerDate(dueDate)}</span>
              <Calendar className="h-4 w-4 text-stone-500" />
            </Button>

            {isDueDatePickerOpen ? (
              <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-stone-300 bg-stone-50 shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                  <p className="text-sm font-semibold text-stone-800">{formatMonthHeading(dueDateMonth)}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => moveDueDateMonth(-1)}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      onClick={() => moveDueDateMonth(1)}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 px-2 pt-2 text-center text-[11px] font-semibold text-stone-500">
                  {calendarWeekdays.map((weekday) => (
                    <span key={weekday} className="py-1">
                      {weekday}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 p-2">
                  {calendarCells.map((cell) => {
                    const isSelected = selectedDueDate ? isSameDay(cell.date, selectedDueDate) : false;
                    const isToday = isSameDay(cell.date, new Date());

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className={cn(
                          "h-9 rounded-lg text-sm font-medium transition-colors",
                          cell.inMonth ? "text-stone-800" : "text-stone-400",
                          !isSelected && "hover:bg-stone-100",
                          isToday && !isSelected && "border border-stone-300",
                          isSelected && "bg-stone-700 text-stone-50 shadow-sm",
                        )}
                        onClick={() => pickDueDate(cell.date)}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => pickDueDate(new Date())}>
                    Today
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const tomorrow = parseDateOnly(dateForPreset("tomorrow")) ?? new Date();
                        pickDueDate(tomorrow);
                      }}
                    >
                      Tomorrow
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextWeek = parseDateOnly(dateForPreset("next-week")) ?? new Date();
                        pickDueDate(nextWeek);
                      }}
                    >
                      Next Week
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {formErrors.dueDate ? (
            <p id={dueDateErrorId} className="text-xs font-medium text-rose-700">
              {formErrors.dueDate}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => {
              if (isPriority(value)) {
                setPriority(value);
              }
            }}
            disabled={isMutating}
          >
            <SelectTrigger id={`${idPrefix}-priority`}>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-reminder-at`}>Reminder (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {reminderQuickOptions.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant="outline"
                size="sm"
                disabled={isMutating}
                onClick={() => applyReminderPreset(option.hour, option.minute)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isMutating || !reminderAt}
              onClick={() => {
                setReminderAt("");
                clearFormError("reminderAt");
              }}
            >
              Clear
            </Button>
          </div>
          <Input
            id={`${idPrefix}-reminder-at`}
            type="datetime-local"
            value={reminderAt}
            onChange={(event) => {
              setReminderAt(event.target.value);
              clearFormError("reminderAt");
            }}
            aria-invalid={Boolean(formErrors.reminderAt)}
            aria-describedby={formErrors.reminderAt ? reminderErrorId : undefined}
            disabled={isMutating}
          />
          {formErrors.reminderAt ? (
            <p id={reminderErrorId} className="text-xs font-medium text-rose-700">
              {formErrors.reminderAt}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
          <Textarea
            id={`${idPrefix}-notes`}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              clearFormError("notes");
            }}
            placeholder="Any extra context"
            aria-invalid={Boolean(formErrors.notes)}
            aria-describedby={formErrors.notes ? notesErrorId : undefined}
            disabled={isMutating}
          />
          {formErrors.notes ? (
            <p id={notesErrorId} className="text-xs font-medium text-rose-700">
              {formErrors.notes}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-wrap gap-2 pt-1",
            isMobileForm &&
              "fixed inset-x-0 bottom-0 z-20 border-t border-stone-300 bg-stone-50/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 justify-end",
          )}
        >
          {(isMobileForm || editingTaskId) && (
            <Button
              type="button"
              variant="outline"
              onClick={closeQuickAdd}
              disabled={isMutating}
              className={cn(isMobileForm && "h-11 px-4")}
            >
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={isMutating} className={cn(isMobileForm && "h-11 px-5")}>
            {isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editingTaskId ? (
              "Save changes"
            ) : (
              "Add reminder"
            )}
          </Button>
        </div>
      </form>
    );
  }

  const completedToday = todayTasks.filter((task) => task.completed).length;
  const completionRate = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  const isReadyToRefresh = pullDistance >= pullRefreshTriggerPx;

  return (
    <div
      className="min-h-screen touch-pan-y bg-stone-100"
      onTouchStart={handleRootTouchStart}
      onTouchMove={handleRootTouchMove}
      onTouchEnd={handleRootTouchEnd}
      onTouchCancel={handleRootTouchEnd}
    >
      <div
        className={cn(
          "pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 transition-all duration-150 lg:hidden",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0",
        )}
        style={{ top: `${8 + Math.min(pullDistance, 42)}px` }}
      >
        <div className="flex items-center gap-2 rounded-full border border-stone-300 bg-stone-50/95 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm">
          <Loader2 className={cn("h-3.5 w-3.5", (isRefreshing || isReadyToRefresh) && "animate-spin")} />
          <span>{isRefreshing ? "Refreshing..." : isReadyToRefresh ? "Release to refresh" : "Pull to refresh"}</span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:pb-10">
        <header className="mb-4">
          <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Reminders</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Today</h1>
                <p className="mt-1 text-sm text-stone-600 sm:text-base">{formatFullDate()}</p>
              </div>

              <div className="shrink-0 pt-0.5">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-stone-300 bg-stone-100 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Total</p>
                <p className="mt-1 text-xl font-bold leading-none text-stone-900">{tasks.length}</p>
              </div>

              <div className="rounded-xl border border-stone-300 bg-stone-100 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Today</p>
                <p className="mt-1 text-xl font-bold leading-none text-stone-900">{todayTasks.length}</p>
              </div>

              <div className="rounded-xl border border-stone-300 bg-stone-100 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Done</p>
                <p className="mt-1 text-xl font-bold leading-none text-stone-900">{completedToday}</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                <span>Today progress</span>
                <span>{completionRate}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-stone-700 transition-all duration-300" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
        </header>

        {!hasSupabaseEnv ? (
          <Card className="mb-4 border-amber-300 bg-amber-100/80">
            <CardContent className="pt-6 text-sm text-amber-900">
              Supabase env vars are missing. Set <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or legacy <code>VITE_SUPABASE_ANON_KEY</code>).
            </CardContent>
          </Card>
        ) : null}

        {errorMessage ? (
          <Card className="mb-4 border-rose-300 bg-rose-50">
            <CardContent className="pt-6 text-sm text-rose-800">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <main className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-stone-300 bg-stone-50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Today Focus</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void clearCompleted();
                  }}
                  disabled={isMutating || !tasks.some((task) => task.completed)}
                >
                  Clear completed
                </Button>
              </div>
              <CardDescription>Your day at a glance. Finish these first.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTasks ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading reminders...
                </div>
              ) : todayTasks.length ? (
                <ul className="grid gap-2">
                  {todayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      swipeEnabled={isMobile}
                      onToggle={(id) => {
                        void toggleTask(id);
                      }}
                      onEdit={startEdit}
                      onDelete={requestDelete}
                      isEditing={editingTaskId === task.id}
                      disabled={isMutating || !hasSupabaseEnv}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-stone-300 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-stone-700">No tasks for today</p>
                  <p className="mt-1 text-sm text-stone-500">Tap Quick Add to create your first reminder.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="grid content-start gap-4">
            {!isMobile ? (
              <Card className="border-stone-300 bg-stone-50 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{editingTaskId ? "Edit Reminder" : "Quick Add"}</CardTitle>
                </CardHeader>
                <CardContent>{renderQuickAddForm("desktop")}</CardContent>
              </Card>
            ) : null}

            <Card className="border-stone-300 bg-stone-50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTasks ? (
                  <div className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                    Loading upcoming tasks...
                  </div>
                ) : upcomingTasks.length ? (
                  <ul className="grid gap-2">
                    {upcomingTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        compact
                        swipeEnabled={isMobile}
                        onToggle={(id) => {
                          void toggleTask(id);
                        }}
                        onEdit={startEdit}
                        onDelete={requestDelete}
                        isEditing={editingTaskId === task.id}
                        disabled={isMutating || !hasSupabaseEnv}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                    Nothing upcoming yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </main>
      </div>

      {isMobile && isQuickAddOpen ? (
        <div className="fixed inset-0 z-50 bg-stone-900/30" onClick={closeQuickAdd}>
          <div
            className="absolute inset-x-0 bottom-0 h-[100dvh] overflow-hidden rounded-t-[1.6rem] border border-stone-300 bg-stone-50 shadow-lg transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${quickAddDragY}px)`, transition: isQuickAddDragging ? "none" : undefined }}
            onTouchStart={handleQuickAddTouchStart}
            onTouchMove={handleQuickAddTouchMove}
            onTouchEnd={handleQuickAddTouchEnd}
            onTouchCancel={handleQuickAddTouchEnd}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex justify-center pt-2" data-sheet-grab="true">
                <span className="h-1.5 w-12 rounded-full bg-stone-400" />
              </div>

              <div className="border-b border-stone-300 px-4 pb-3 pt-2" data-sheet-grab="true">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{editingTaskId ? "Edit Reminder" : "Quick Add"}</h2>
                    <p className="text-sm text-stone-500">Add and edit tasks without leaving Today Focus.</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    onClick={closeQuickAdd}
                    aria-label="Close quick add"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div
                ref={quickAddScrollRef}
                className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
              >
                {renderQuickAddForm("mobile")}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidateTask ? (
        <div
          className="fixed inset-0 z-[60] bg-stone-900/35 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-16"
          onClick={cancelDelete}
        >
          <Card
            className="mx-auto w-full max-w-md border-stone-300 bg-stone-50"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Delete this task?</CardTitle>
              <CardDescription>
                This will permanently remove <span className="font-semibold text-stone-700">{deleteCandidateTask.title}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelDelete} disabled={isMutating}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void confirmDelete();
                }}
                disabled={isMutating}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Button
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 h-11 rounded-xl px-4 shadow-sm lg:hidden",
          isQuickAddOpen && "hidden",
        )}
        onClick={openQuickAddForCreate}
        aria-label="Open quick add"
        disabled={isMutating || !hasSupabaseEnv}
      >
        <Plus className="mr-1 h-5 w-5" />
        Quick Add
      </Button>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <>
      <SignedOut>
        <SignedOutView />
      </SignedOut>
      <SignedIn>
        <SignedInView />
      </SignedIn>
    </>
  );
}
