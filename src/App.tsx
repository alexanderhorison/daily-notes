import {
  type FormEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Calendar,
  CalendarDays,
  CircleDot,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  Leaf,
  Plus,
  Sun,
  Sunrise,
  Shield,
  Settings,
  X,
  Moon,
  type LucideIcon,
} from "lucide-react";

import { AddReminderPage } from "@/features/app/pages/add-reminder-page";
import { LoginView } from "@/features/app/components/login-view";
import { SettingsPage } from "@/features/app/pages/settings-page";
import { TodayPage } from "@/features/app/pages/today-page";
import { UpcomingPage } from "@/features/app/pages/upcoming-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskDateService } from "@/lib/task-date-service";
import { TaskDataService } from "@/lib/task-data-service";
import { TaskFormService } from "@/lib/task-form-service";
import { TaskNotificationService, type NotificationPermissionState } from "@/lib/task-notification-service";
import { TaskPresenterService } from "@/lib/task-presenter-service";
import { supabase, APP_USER_ID, hasSupabaseEnv, type Priority } from "@/lib/supabase";
import type { DatePreset, FormErrorKey, FormErrors, Task } from "@/lib/task-types";
import { cn } from "@/lib/utils";

const APP_PASSWORD = "Suthiono11";
const AUTH_KEY = "app_auth_v1";
const pullRefreshTriggerPx = 72;
const pullRefreshMaxPx = 96;
const reminderScanIntervalMs = 30 * 1000;
const profileName = "Irene Suthiono";
const profileRole = "Senior Premier Banking Manager";

type ActiveTab = "today" | "upcoming" | "add" | "settings";
type ToastState = {
  variant: "success" | "error";
  title: string;
  description: string;
} | null;

// ─── MainApp ─────────────────────────────────────────────────────────────────

function MainApp({ onLogout }: { onLogout: () => void }): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickAddClosing, setIsQuickAddClosing] = useState(false);
  const [isQuickAddDragging, setIsQuickAddDragging] = useState(false);
  const [quickAddDragY, setQuickAddDragY] = useState(0);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [completeCandidateId, setCompleteCandidateId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("today");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(TaskDateService.dateForPreset("today"));
  const [dueDateMonth, setDueDateMonth] = useState(() => {
    const initial = TaskDateService.parseDateOnly(TaskDateService.dateForPreset("today")) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [isReminderTimeModalOpen, setIsReminderTimeModalOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>("medium");
  const [reminderAt, setReminderAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const pullStartRef = useRef<number | null>(null);
  const quickAddTouchStartRef = useRef<number | null>(null);
  const quickAddCanDragRef = useRef(false);
  const quickAddCloseTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const quickAddScrollRef = useRef<HTMLDivElement | null>(null);
  const taskDataService = useMemo(() => (supabase ? new TaskDataService(supabase, APP_USER_ID) : null), []);
  const notificationServiceRef = useRef(new TaskNotificationService());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() =>
    notificationServiceRef.current.getPermission(),
  );

  function clearFormError(field: FormErrorKey): void {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    const sync = () => setNotificationPermission(notificationServiceRef.current.getPermission());
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (quickAddCloseTimerRef.current) window.clearTimeout(quickAddCloseTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(next: Exclude<ToastState, null>): void {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  }

  function redirectToHomeAfterSubmit(): void {
    setActiveTab("today");
    resetForm({ closeQuickAdd: true });
  }

  function buildReminderToastDescription(taskTitle: string, taskDueDate: string, taskReminderAt: string): string {
    const dueLabel = TaskDateService.formatPickerDate(taskDueDate);
    const timeLabel = taskReminderAt
      ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" }).format(new Date(taskReminderAt))
      : "no reminder time";
    return `${taskTitle} • ${dueLabel} • ${timeLabel}`;
  }

  function buildErrorToastDescription(message: string): string {
    const compact = message.replace(/\s+/g, " ").trim();
    const clipped = compact.length > 130 ? `${compact.slice(0, 127)}...` : compact;
    return `${clipped} Please try again.`;
  }

  useEffect(() => {
    if (selectedPreset === "custom") return;
    setDueDate(TaskDateService.dateForPreset(selectedPreset));
    clearFormError("dueDate");
  }, [selectedPreset]);

  useEffect(() => {
    const parsed = TaskDateService.parseDateOnly(dueDate);
    if (!parsed) return;
    setDueDateMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [dueDate]);

  useEffect(() => {
    if (isQuickAddOpen) return;
    setIsDueDateModalOpen(false);
    setIsReminderTimeModalOpen(false);
  }, [isQuickAddOpen]);

  useEffect(() => {
    if (!hasSupabaseEnv) setIsLoadingTasks(false);
  }, []);

  const loadTasks = useCallback(async (showLoadingState: boolean): Promise<void> => {
    if (!taskDataService) return;
    if (showLoadingState) setIsLoadingTasks(true);
    setErrorMessage("");
    try {
      const { data, error } = await taskDataService.listTasks();

      if (error) {
        setErrorMessage(error.message || "Failed to load tasks.");
        setTasks([]);
      } else {
        setTasks((data ?? []).map(TaskPresenterService.fromTaskRow));
      }
    } catch {
      setErrorMessage("Failed to load tasks.");
      setTasks([]);
    } finally {
      if (showLoadingState) setIsLoadingTasks(false);
    }
  }, [taskDataService]);

  useEffect(() => {
    void loadTasks(true);
  }, [loadTasks]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const notify = () => notificationServiceRef.current.notifyPendingTasks(tasks);
    notify();
    const id = window.setInterval(notify, reminderScanIntervalMs);
    return () => window.clearInterval(id);
  }, [tasks, notificationPermission]);

  const todayKey = TaskDateService.toDateOnly(new Date());

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate <= todayKey).sort(TaskPresenterService.sortTasks),
    [tasks, todayKey],
  );
  const upcomingTasks = useMemo(
    () => tasks.filter((t) => t.dueDate > todayKey).sort(TaskPresenterService.sortTasks).slice(0, 20),
    [tasks, todayKey],
  );
  const deleteCandidateTask = useMemo(
    () => tasks.find((t) => t.id === deleteCandidateId) || null,
    [tasks, deleteCandidateId],
  );
  const completeCandidateTask = useMemo(
    () => tasks.find((t) => t.id === completeCandidateId) || null,
    [tasks, completeCandidateId],
  );
  const hasPendingReminders = useMemo(() => TaskPresenterService.hasPendingReminders(tasks), [tasks]);
  const completedToday = useMemo(() => todayTasks.filter((t) => t.completed).length, [todayTasks]);

  useEffect(() => {
    if (deleteCandidateId && !tasks.some((t) => t.id === deleteCandidateId)) setDeleteCandidateId(null);
  }, [tasks, deleteCandidateId]);

  useEffect(() => {
    if (completeCandidateId && !tasks.some((t) => t.id === completeCandidateId)) setCompleteCandidateId(null);
  }, [tasks, completeCandidateId]);

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
    if (isQuickAddOpen || deleteCandidateId || completeCandidateId || isMutating || isLoadingTasks || isRefreshing) {
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
    setPullDistance(Math.min(pullRefreshMaxPx, delta * 0.45));
    event.preventDefault();
  }

  function handleRootTouchEnd(): void {
    if (pullStartRef.current === null) return;
    if (pullDistance >= pullRefreshTriggerPx) void refreshTasks();
    setPullDistance(0);
    pullStartRef.current = null;
  }

  function handleQuickAddTouchStart(event: ReactTouchEvent<HTMLDivElement>): void {
    if (isQuickAddClosing) return;
    const target = event.target as HTMLElement;
    quickAddTouchStartRef.current = event.touches[0]?.clientY ?? null;
    quickAddCanDragRef.current =
      Boolean(target.closest("[data-sheet-grab='true']")) || (quickAddScrollRef.current?.scrollTop ?? 0) <= 0;
    setIsQuickAddDragging(false);
  }

  function handleQuickAddTouchMove(event: ReactTouchEvent<HTMLDivElement>): void {
    if (!quickAddCanDragRef.current || quickAddTouchStartRef.current === null || isQuickAddClosing) return;
    const delta = (event.touches[0]?.clientY ?? quickAddTouchStartRef.current) - quickAddTouchStartRef.current;
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
    const timePart = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    setReminderAt(`${dueDate}T${timePart}`);
    clearFormError("reminderAt");
  }

  function changeReminderTime(value: string): void {
    if (!value) {
      setReminderAt("");
      clearFormError("reminderAt");
      return;
    }

    setReminderAt(`${dueDate}T${value}`);
    clearFormError("reminderAt");
  }

  function changeReminderHour(hour: string): void {
    if (!hour) return;
    const current = reminderAt?.includes("T") ? reminderAt.slice(11, 16) : "09:00";
    changeReminderTime(`${hour}:${current.split(":")[1] ?? "00"}`);
  }

  function changeReminderMinute(minute: string): void {
    if (!minute) return;
    const current = reminderAt?.includes("T") ? reminderAt.slice(11, 16) : "09:00";
    changeReminderTime(`${current.split(":")[0] ?? "09"}:${minute}`);
  }

  const selectedDueDate = useMemo(() => TaskDateService.parseDateOnly(dueDate), [dueDate]);
  const calendarCells = useMemo(() => TaskDateService.buildCalendarGrid(dueDateMonth), [dueDateMonth]);

  useEffect(() => {
    if (!reminderAt || !reminderAt.includes("T")) return;
    if (reminderAt.slice(0, 10) === dueDate) return;

    setReminderAt(`${dueDate}T${reminderAt.slice(11, 16)}`);
  }, [dueDate, reminderAt]);

  function moveDueDateMonth(delta: number): void {
    setDueDateMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function pickDueDate(date: Date): void {
    const next = TaskDateService.toDateOnly(date);
    setDueDate(next);
    setSelectedPreset(TaskDateService.detectPreset(next));
    clearFormError("dueDate");
    setIsDueDateModalOpen(false);
  }

  function openDueDateModal(): void {
    const parsed = TaskDateService.parseDateOnly(dueDate);
    if (parsed) setDueDateMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setIsDueDateModalOpen(true);
  }

  function resetFormFields(): void {
    setEditingTaskId(null);
    setTitle("");
    setPriority("medium");
    setReminderAt("");
    setNotes("");
    setSelectedPreset("today");
    setDueDate(TaskDateService.dateForPreset("today"));
    setIsDueDateModalOpen(false);
    setIsReminderTimeModalOpen(false);
    setFormErrors({});
  }

  function presentQuickAddSheet(): void {
    if (quickAddCloseTimerRef.current) {
      window.clearTimeout(quickAddCloseTimerRef.current);
      quickAddCloseTimerRef.current = null;
    }
    setIsQuickAddOpen(true);
    setIsQuickAddClosing(false);
    setIsQuickAddDragging(false);
    setQuickAddDragY(window.innerHeight);
    window.requestAnimationFrame(() => setQuickAddDragY(0));
  }

  function requestCloseQuickAddSheet(): void {
    if (!isQuickAddOpen || isQuickAddClosing) return;
    setIsQuickAddClosing(true);
    setIsQuickAddDragging(false);
    setQuickAddDragY(window.innerHeight);
    if (quickAddCloseTimerRef.current) window.clearTimeout(quickAddCloseTimerRef.current);
    quickAddCloseTimerRef.current = window.setTimeout(() => {
      setIsQuickAddOpen(false);
      setIsQuickAddClosing(false);
      setQuickAddDragY(0);
      resetFormFields();
      quickAddCloseTimerRef.current = null;
    }, 220);
  }

  function resetForm({ closeQuickAdd = false }: { closeQuickAdd?: boolean } = {}): void {
    if (closeQuickAdd && isQuickAddOpen) {
      requestCloseQuickAddSheet();
      return;
    }
    resetFormFields();
  }

  function openQuickAddForCreate(): void {
    resetFormFields();
    setIsQuickAddOpen(false);
    setActiveTab("add");
  }

  function closeQuickAdd(): void {
    if (!isQuickAddOpen) {
      resetFormFields();
      return;
    }
    requestCloseQuickAddSheet();
  }

  async function requestNotificationPermission(): Promise<void> {
    setNotificationPermission(await notificationServiceRef.current.requestPermission());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!taskDataService) return;
    const isEditingMode = Boolean(editingTaskId);

    const parsed = TaskFormService.schema.safeParse({ title, dueDate, priority, reminderAt, notes });
    if (!parsed.success) {
      setFormErrors(TaskFormService.mapZodErrors(parsed.error));
      return;
    }

    setFormErrors({});
    setIsMutating(true);
    setErrorMessage("");

    const payload = {
      title: parsed.data.title,
      due_date: parsed.data.dueDate,
      priority: parsed.data.priority,
      reminder_at: TaskDateService.toIsoStringOrNull(parsed.data.reminderAt),
      notes: parsed.data.notes,
    };

    if (editingTaskId) {
      const { data, error } = await taskDataService.updateTask(editingTaskId, payload);
      if (error || !data) {
        const message = error?.message || "Failed to update task.";
        setErrorMessage(message);
        showToast({
          variant: "error",
          title: "Update failed",
          description: buildErrorToastDescription(message),
        });
        setIsMutating(false);
        redirectToHomeAfterSubmit();
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === editingTaskId ? TaskPresenterService.fromTaskRow(data) : t)));
    } else {
      const { data, error } = await taskDataService.createTask(payload);
      if (error || !data) {
        const message = error?.message || "Failed to create task.";
        setErrorMessage(message);
        showToast({
          variant: "error",
          title: "Add failed",
          description: buildErrorToastDescription(message),
        });
        setIsMutating(false);
        redirectToHomeAfterSubmit();
        return;
      }
      setTasks((prev) => [...prev, TaskPresenterService.fromTaskRow(data)]);
    }

    setIsMutating(false);
    showToast({
      variant: "success",
      title: isEditingMode ? "Reminder updated" : "Reminder added",
      description: buildReminderToastDescription(
        parsed.data.title,
        parsed.data.dueDate,
        parsed.data.reminderAt,
      ),
    });
    redirectToHomeAfterSubmit();
  }

  function startEdit(id: string): void {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setReminderAt(task.reminderAt);
    setNotes(task.notes);
    setSelectedPreset(TaskDateService.detectPreset(task.dueDate));
    setIsDueDateModalOpen(false);
    setIsReminderTimeModalOpen(false);
    setFormErrors({});
    setIsQuickAddOpen(false);
    setActiveTab("add");
  }

  async function toggleTask(id: string): Promise<boolean> {
    if (!taskDataService) return false;
    const current = tasks.find((t) => t.id === id);
    if (!current) return false;
    setIsMutating(true);
    setErrorMessage("");

    const { data, error } = await taskDataService.setTaskCompleted(id, !current.completed);

    if (error || !data) {
      setErrorMessage(error?.message || "Failed to update task.");
      setIsMutating(false);
      return false;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? TaskPresenterService.fromTaskRow(data) : t)));
    setIsMutating(false);
    return true;
  }

  function requestToggleTask(id: string): void {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    if (current.completed) {
      void toggleTask(id);
      return;
    }
    setCompleteCandidateId(id);
  }

  async function confirmMarkDone(): Promise<void> {
    if (!completeCandidateId) return;
    const ok = await toggleTask(completeCandidateId);
    if (ok) setCompleteCandidateId(null);
  }

  function cancelMarkDone(): void {
    setCompleteCandidateId(null);
  }

  function requestDelete(id: string): void {
    setDeleteCandidateId(id);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteCandidateId || !taskDataService) return;
    setIsMutating(true);
    setErrorMessage("");

    const { error } = await taskDataService.deleteTask(deleteCandidateId);

    if (error) {
      setErrorMessage(error.message || "Failed to delete task.");
      setIsMutating(false);
      return;
    }
    if (editingTaskId === deleteCandidateId) resetForm({ closeQuickAdd: true });
    setTasks((prev) => prev.filter((t) => t.id !== deleteCandidateId));
    setDeleteCandidateId(null);
    setIsMutating(false);
  }

  function cancelDelete(): void {
    setDeleteCandidateId(null);
  }

  async function clearCompleted(): Promise<void> {
    if (!taskDataService) return;
    const ids = tasks.filter((t) => t.completed).map((t) => t.id);
    if (!ids.length) return;
    setIsMutating(true);
    setErrorMessage("");

    const { error } = await taskDataService.deleteTasksByIds(ids);

    if (error) {
      setErrorMessage(error.message || "Failed to clear completed tasks.");
      setIsMutating(false);
      return;
    }
    if (editingTaskId && ids.includes(editingTaskId)) resetForm({ closeQuickAdd: true });
    setTasks((prev) => prev.filter((t) => !t.completed));
    setIsMutating(false);
  }

  function renderQuickAddForm({ inline = false }: { inline?: boolean } = {}): JSX.Element {
    const sectionCardClass = inline ? "rounded-2xl border border-gray-300 bg-white p-4" : "";
    const whenHintByPreset: Record<Exclude<DatePreset, "custom">, string> = {
      today: "Due today",
      tomorrow: "Plan ahead",
      "next-week": "7 days later",
      "next-month": "Long-term",
    };
    const reminderQuickCards: Array<{ label: string; hour: number; minute: number; Icon: LucideIcon }> = [
      { label: "Morning", hour: 9, minute: 0, Icon: Sunrise },
      { label: "Afternoon", hour: 13, minute: 0, Icon: Sun },
      { label: "Evening", hour: 18, minute: 0, Icon: Moon },
    ];
    const priorityCards: Array<{ value: Priority; label: string; Icon: LucideIcon }> = [
      { value: "low", label: "Low", Icon: Leaf },
      { value: "medium", label: "Medium", Icon: CircleDot },
      { value: "high", label: "High", Icon: Shield },
    ];
    const reminderTimeDisplay = reminderAt
      ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" }).format(new Date(reminderAt))
      : "Pick reminder time";

    return (
      <form
        className={cn(
          "grid gap-3",
          inline ? "gap-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(6rem+env(safe-area-inset-bottom))]",
        )}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className={cn("grid gap-1.5", sectionCardClass)}>
          <Label htmlFor="task-title">Task</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFormError("title");
            }}
            placeholder="Pay electricity bill"
            aria-invalid={Boolean(formErrors.title)}
            disabled={isMutating}
          />
          {formErrors.title ? <p className="text-xs font-medium text-red-600">{formErrors.title}</p> : null}
        </div>

        <div className={cn("grid gap-1.5", sectionCardClass)}>
          <Label>Schedule</Label>
          <div className="grid grid-cols-2 gap-2">
            {TaskDateService.presetOptions.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedPreset(preset.value);
                  setIsDueDateModalOpen(false);
                }}
                disabled={isMutating}
                className={cn(
                  "h-20 flex-col items-start justify-center rounded-xl border px-3 text-left",
                  selectedPreset === preset.value
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                )}
              >
                <span className="text-base font-semibold leading-none">{preset.label}</span>
                <span className={cn("mt-1 text-xs", selectedPreset === preset.value ? "text-red-500" : "text-gray-500")}>
                  {whenHintByPreset[preset.value]}
                </span>
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-between rounded-xl border-gray-300 px-3 text-left font-medium"
            aria-haspopup="dialog"
            onClick={openDueDateModal}
            disabled={isMutating}
          >
            <span>{TaskDateService.formatPickerDate(dueDate)}</span>
            <Calendar className="h-4 w-4 text-gray-400" />
          </Button>
          {formErrors.dueDate ? <p className="text-xs font-medium text-red-600">{formErrors.dueDate}</p> : null}

          <div className="mt-2">
            <div className="grid grid-cols-3 gap-2">
              {reminderQuickCards.map((opt) => {
                const optionTime = `${String(opt.hour).padStart(2, "0")}:${String(opt.minute).padStart(2, "0")}`;
                const selected = reminderAt.slice(11, 16) === optionTime;

                return (
                  <Button
                    key={opt.label}
                    type="button"
                    variant="ghost"
                    disabled={isMutating}
                    onClick={() => applyReminderPreset(opt.hour, opt.minute)}
                    className={cn(
                      "h-20 flex-col items-start justify-center rounded-xl border px-3 text-left",
                      selected
                        ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                    )}
                  >
                    <opt.Icon className={cn("h-4 w-4", selected ? "text-red-500" : "text-gray-500")} />
                    <span className="mt-2 text-sm font-semibold leading-none">{opt.label}</span>
                  </Button>
                );
              })}
            </div>
            <div className="mt-1">
              <Button type="button" variant="ghost" size="sm" disabled={isMutating || !reminderAt}
                onClick={() => { setReminderAt(""); clearFormError("reminderAt"); }}>
                Clear
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-12 w-full justify-between rounded-xl border-gray-300 px-3 text-left"
              aria-haspopup="dialog"
              onClick={() => setIsReminderTimeModalOpen(true)}
              disabled={isMutating}
            >
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-gray-800">{reminderTimeDisplay}</span>
                <span className="text-xs text-gray-500">for {TaskDateService.formatPickerDate(dueDate)}</span>
              </span>
              <Clock3 className="h-4 w-4 text-gray-400" />
            </Button>
            {formErrors.reminderAt ? <p className="mt-1 text-xs font-medium text-red-600">{formErrors.reminderAt}</p> : null}
          </div>
        </div>

        <div className={cn("grid gap-1.5", sectionCardClass)}>
          <Label>Priority</Label>
          <div className="grid grid-cols-3 gap-2">
            {priorityCards.map((option) => {
              const selected = priority === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  disabled={isMutating}
                  onClick={() => setPriority(option.value)}
                  className={cn(
                    "h-14 items-center justify-start gap-2 rounded-xl border px-3 text-left",
                    selected
                      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      selected ? "bg-red-100" : "bg-gray-100",
                    )}
                  >
                    <option.Icon className={cn("h-4 w-4", selected ? "text-red-500" : "text-gray-600")} strokeWidth={2.1} />
                  </span>
                  <span className="text-sm font-semibold leading-none">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className={cn("grid gap-1.5", sectionCardClass)}>
          <Label htmlFor="task-notes">Notes (optional)</Label>
          <Textarea
            id="task-notes"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); clearFormError("notes"); }}
            placeholder="Any extra context"
            disabled={isMutating}
          />
          {formErrors.notes ? <p className="text-xs font-medium text-red-600">{formErrors.notes}</p> : null}
        </div>

        <div
          className={cn(
            "flex justify-end gap-2",
            inline
              ? "fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-gray-300 bg-white px-4 pb-3 pt-2 shadow-[0_-8px_18px_rgba(15,23,42,0.06)]"
              : "fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={closeQuickAdd}
            disabled={isMutating}
            className={cn("h-11 px-4", inline && "w-1/3")}
          >
            {inline ? "Reset" : "Cancel"}
          </Button>
          <Button type="submit" disabled={isMutating} className={cn("h-11 px-5", inline && "flex-1")}>
            {isMutating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              : editingTaskId ? "Save changes" : "Add reminder"}
          </Button>
        </div>
      </form>
    );
  }

  const isReadyToRefresh = pullDistance >= pullRefreshTriggerPx;

  const taskListProps = {
    swipeEnabled: true as const,
    disabled: isMutating || !hasSupabaseEnv,
    onToggle: requestToggleTask,
    onEdit: startEdit,
    onDelete: requestDelete,
  };

  function renderContent(): JSX.Element {
    if (activeTab === "settings") {
      return (
        <SettingsPage
          profileName={profileName}
          profileRole={profileRole}
          onLogout={onLogout}
          hasPendingReminders={hasPendingReminders}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={() => void requestNotificationPermission()}
          hasSupabaseEnv={hasSupabaseEnv}
        />
      );
    }

    if (activeTab === "upcoming") {
      return (
        <UpcomingPage
          errorMessage={errorMessage}
          isLoadingTasks={isLoadingTasks}
          upcomingTasks={upcomingTasks}
          editingTaskId={editingTaskId}
          taskRowActionProps={taskListProps}
        />
      );
    }

    if (activeTab === "add") {
      return (
        <AddReminderPage isEditing={Boolean(editingTaskId)} form={renderQuickAddForm({ inline: true })} />
      );
    }

    // today tab
    return (
      <TodayPage
        headerDescription={TaskDateService.formatFullDate()}
        todayTasks={todayTasks}
        completedToday={completedToday}
        isLoadingTasks={isLoadingTasks}
        errorMessage={errorMessage}
        isMutating={isMutating}
        editingTaskId={editingTaskId}
        hasCompletedTasks={tasks.some((t) => t.completed)}
        onClearCompleted={() => void clearCompleted()}
        taskRowActionProps={taskListProps}
      />
    );
  }

  return (
    <div
      className="min-h-screen touch-pan-y bg-gray-50"
      onTouchStart={handleRootTouchStart}
      onTouchMove={handleRootTouchMove}
      onTouchEnd={handleRootTouchEnd}
      onTouchCancel={handleRootTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className={cn(
          "pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 transition-all duration-150",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0",
        )}
        style={{ top: `${8 + Math.min(pullDistance, 42)}px` }}
      >
        <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 shadow-sm">
          <Loader2 className={cn("h-3.5 w-3.5", (isRefreshing || isReadyToRefresh) && "animate-spin")} />
          <span>{isRefreshing ? "Refreshing..." : isReadyToRefresh ? "Release to refresh" : "Pull to refresh"}</span>
        </div>
      </div>

      {/* Global toast */}
      {toast ? (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[70] w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2">
          <div
            className={cn(
              "rounded-xl border px-3 py-2 shadow-md",
              toast.variant === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700",
            )}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className={cn("mt-0.5 text-xs", toast.variant === "success" ? "text-green-700" : "text-red-600")}>
              {toast.description}
            </p>
          </div>
        </div>
      ) : null}

      {/* Main content — centered at 430px */}
      <div className="mx-auto w-full max-w-[430px]">{renderContent()}</div>

      {/* Bottom sheet (Quick Add) */}
      {isQuickAddOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={closeQuickAdd}>
          <div
            className="absolute inset-x-0 bottom-0 h-[100dvh] overflow-hidden rounded-t-[1.6rem] border border-gray-300 bg-white shadow-xl transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${quickAddDragY}px)`, transition: isQuickAddDragging ? "none" : undefined }}
            onTouchStart={handleQuickAddTouchStart}
            onTouchMove={handleQuickAddTouchMove}
            onTouchEnd={handleQuickAddTouchEnd}
            onTouchCancel={handleQuickAddTouchEnd}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex justify-center pt-2" data-sheet-grab="true">
                <span className="h-1.5 w-12 rounded-full bg-gray-300" />
              </div>

              <div className="border-b border-gray-300 px-4 pb-3 pt-2" data-sheet-grab="true">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{editingTaskId ? "Edit Reminder" : "New Reminder"}</h2>
                    <p className="text-sm text-gray-400">Add and manage your reminders.</p>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                    onClick={closeQuickAdd}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div ref={quickAddScrollRef} className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                {renderQuickAddForm()}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Due date modal */}
      {isDueDateModalOpen ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-4"
          onClick={() => setIsDueDateModalOpen(false)}
        >
          <Card className="mx-auto w-full max-w-[390px] rounded-2xl border-gray-300 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="max-h-[85vh] overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Pick due date</p>
                  <p className="text-sm text-gray-500">{TaskDateService.formatMonthHeading(dueDateMonth)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDueDateModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-300 bg-gray-50 px-2 py-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveDueDateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold text-gray-800">{TaskDateService.formatMonthHeading(dueDateMonth)}</p>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveDueDateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-gray-400">
                {TaskDateService.calendarWeekdays.map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell) => {
                  const isSelected = selectedDueDate ? TaskDateService.isSameDay(cell.date, selectedDueDate) : false;
                  const isToday = TaskDateService.isSameDay(cell.date, new Date());
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={cn(
                        "h-9 rounded-lg text-sm font-medium transition-colors",
                        cell.inMonth ? "text-gray-800" : "text-gray-300",
                        !isSelected && "hover:bg-gray-100",
                        isToday && !isSelected && "border border-gray-300",
                        isSelected && "bg-gray-900 text-white shadow-sm",
                      )}
                      onClick={() => pickDueDate(cell.date)}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => pickDueDate(new Date())}>Today</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    const d = TaskDateService.parseDateOnly(TaskDateService.dateForPreset("tomorrow")) ?? new Date();
                    pickDueDate(d);
                  }}
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    const d = TaskDateService.parseDateOnly(TaskDateService.dateForPreset("next-week")) ?? new Date();
                    pickDueDate(d);
                  }}
                >
                  Next Week
                </Button>
                <Button type="button" className="ml-auto rounded-lg px-4" size="sm" onClick={() => setIsDueDateModalOpen(false)}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Reminder time modal */}
      {isReminderTimeModalOpen ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-4"
          onClick={() => setIsReminderTimeModalOpen(false)}
        >
          <Card className="mx-auto w-full max-w-[390px] rounded-2xl border-gray-300 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="max-h-[85vh] overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Pick reminder time</p>
                  <p className="mt-0.5 text-sm text-gray-500">for {TaskDateService.formatPickerDate(dueDate)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsReminderTimeModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <input
                type="time"
                className="mt-3 h-11 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={reminderAt ? reminderAt.slice(11, 16) : ""}
                onChange={(e) => changeReminderTime(e.target.value)}
              />

              <div className="mt-3 grid grid-cols-3 gap-2">
                {["07", "09", "12", "15", "18", "21"].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={reminderAt.slice(11, 13) === h ? "default" : "outline"}
                    onClick={() => changeReminderHour(h)}
                    size="sm"
                    className="h-9 rounded-lg text-sm"
                  >
                    {`${h}:00`}
                  </Button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-4 gap-2">
                {["00", "15", "30", "45"].map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={reminderAt.slice(14, 16) === m ? "default" : "outline"}
                    onClick={() => changeReminderMinute(m)}
                    size="sm"
                    className="h-9 rounded-lg text-sm"
                  >
                    :{m}
                  </Button>
                ))}
              </div>

              <div className="mt-4 flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    setReminderAt("");
                    clearFormError("reminderAt");
                  }}
                >
                  Clear
                </Button>
                <Button type="button" className="rounded-lg px-4" onClick={() => setIsReminderTimeModalOpen(false)}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {completeCandidateTask ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" onClick={cancelMarkDone}>
          <Card
            className="mx-auto w-full max-w-[390px] rounded-2xl border-gray-300 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Mark as done?</p>
                  <p className="mt-1 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{completeCandidateTask.title}</span> will move to completed tasks.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={cancelMarkDone} disabled={isMutating}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="h-10 flex-1 rounded-lg" onClick={cancelMarkDone} disabled={isMutating}>
                  Cancel
                </Button>
                <Button type="button" className="h-10 flex-1 rounded-lg" onClick={() => void confirmMarkDone()} disabled={isMutating}>
                  Mark done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {deleteCandidateTask ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" onClick={cancelDelete}>
          <Card
            className="mx-auto w-full max-w-[390px] rounded-2xl border-gray-300 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Delete reminder?</p>
                  <p className="mt-1 text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{deleteCandidateTask.title}</span> will be permanently removed.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={cancelDelete} disabled={isMutating}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="h-10 flex-1 rounded-lg" onClick={cancelDelete} disabled={isMutating}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10 flex-1 rounded-lg"
                  onClick={() => void confirmDelete()}
                  disabled={isMutating}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Bottom tab bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-300 bg-white">
        <div className="mx-auto flex w-full max-w-[430px] pb-[env(safe-area-inset-bottom)]">
          {(
            [
              { id: "today", label: "Today", Icon: Home },
              { id: "upcoming", label: "Upcoming", Icon: CalendarDays },
              { id: "add", label: "Add", Icon: Plus },
              { id: "settings", label: "Settings", Icon: Settings },
            ] as const
          ).map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                className="flex flex-1 flex-col items-center gap-1 py-3"
                onClick={() => {
                  if (id === "add") {
                    openQuickAddForCreate();
                    return;
                  }
                  setActiveTab(id);
                }}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-red-500" : "text-gray-400")} />
                <span className={cn("text-[10px] font-semibold", isActive ? "text-red-500" : "text-gray-400")}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem(AUTH_KEY) === "true");

  if (!isAuthenticated) {
    return <LoginView appPassword={APP_PASSWORD} authStorageKey={AUTH_KEY} onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <MainApp
      onLogout={() => {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
      }}
    />
  );
}
