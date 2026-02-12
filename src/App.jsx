import { useEffect, useMemo, useRef, useState } from "react";
import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { CalendarDays, Loader2, PenLine, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClerkSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const priorityRank = {
  high: 0,
  medium: 1,
  low: 2,
};

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(value) {
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

function toIsoStringOrNull(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function dateForPreset(preset) {
  const base = new Date();

  if (preset === "today") return toDateOnly(base);

  if (preset === "tomorrow") {
    base.setDate(base.getDate() + 1);
    return toDateOnly(base);
  }

  if (preset === "next-month") {
    base.setMonth(base.getMonth() + 1);
    return toDateOnly(base);
  }

  return "";
}

function detectPreset(dateOnly) {
  for (const preset of ["today", "tomorrow", "next-month"]) {
    if (dateForPreset(preset) === dateOnly) {
      return preset;
    }
  }

  return "custom";
}

function formatFullDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDueDate(dateOnly) {
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

function formatReminder(dateTime) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

function sortTasks(a, b) {
  if (a.completed !== b.completed) {
    return Number(a.completed) - Number(b.completed);
  }

  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }

  return a.createdAt.localeCompare(b.createdAt);
}

function priorityStyle(priority) {
  if (priority === "high") return "border-red-200 text-red-700 bg-red-50";
  if (priority === "medium") return "border-amber-200 text-amber-700 bg-amber-50";

  return "border-teal-200 text-teal-700 bg-teal-50";
}

function fromTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes || "",
    dueDate: row.due_date,
    reminderAt: row.reminder_at ? toDateTimeLocalValue(row.reminder_at) : "",
    priority: row.priority,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

function TaskRow({
  task,
  compact = false,
  isEditing = false,
  swipeEnabled = false,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
}) {
  const actionWidth = 96;
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const dragBaseRef = useRef(0);
  const isSwipingRef = useRef(false);

  useEffect(() => {
    if (!swipeEnabled && swipeOffset !== 0) {
      setSwipeOffset(0);
    }
  }, [swipeEnabled, swipeOffset]);

  function closeSwipeIfOpen() {
    if (swipeOffset > 0) {
      setSwipeOffset(0);
      return true;
    }

    return false;
  }

  function handleTouchStart(event) {
    if (!swipeEnabled || disabled) return;

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    dragBaseRef.current = swipeOffset;
    isSwipingRef.current = false;
    setIsDragging(true);
  }

  function handleTouchMove(event) {
    if (!swipeEnabled || disabled) return;

    const touch = event.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (!isSwipingRef.current) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        setIsDragging(false);
        return;
      }
      isSwipingRef.current = true;
    }

    event.preventDefault();
    const next = Math.min(actionWidth, Math.max(0, dragBaseRef.current - dx));
    setSwipeOffset(next);
  }

  function handleTouchEnd() {
    if (!swipeEnabled || disabled) return;

    setIsDragging(false);

    if (!isSwipingRef.current) return;

    setSwipeOffset((prev) => (prev > actionWidth * 0.45 ? actionWidth : 0));
    isSwipingRef.current = false;
  }

  const content = (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-sm",
        compact ? "grid-cols-[1fr_auto] items-center" : "grid-cols-[auto_1fr_auto] items-start",
        task.completed && "opacity-65",
        isEditing && "border-sky-300 shadow-[inset_0_0_0_2px_rgba(186,230,253,0.7)]",
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
        <p className={cn("text-sm font-semibold text-slate-900", task.completed && "line-through")}>{task.title}</p>
        {!compact && task.notes ? <p className="mt-1 text-sm text-slate-500">{task.notes}</p> : null}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline">{formatDueDate(task.dueDate)}</Badge>
          <Badge variant="outline" className={priorityStyle(task.priority)}>
            {task.priority[0].toUpperCase() + task.priority.slice(1)}
          </Badge>
          {task.reminderAt ? <Badge variant="outline">Reminder {formatReminder(task.reminderAt)}</Badge> : null}
        </div>
      </div>

      <div className="flex gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 rounded-xl"
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
            className="h-11 w-11 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
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
    <li className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-lg bg-red-600">
        <Button
          variant="ghost"
          className="h-full w-full rounded-none text-white hover:bg-red-700 hover:text-white"
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

function SignedOutView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_10%_8%,#dbeafe_0%,transparent_32%),radial-gradient(circle_at_90%_12%,#fce7f3_0%,transparent_28%),#f8fafc] p-4">
      <SignIn routing="virtual" />
    </div>
  );
}

function SignedInView() {
  const { userId, getToken, isLoaded } = useAuth();

  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);

  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isMobile, setIsMobile] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [editingTaskId, setEditingTaskId] = useState(null);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(dateForPreset("today"));
  const [priority, setPriority] = useState("medium");
  const [reminderAt, setReminderAt] = useState("");
  const [notes, setNotes] = useState("");

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
    }
  }, [isMobile]);

  useEffect(() => {
    if (selectedPreset === "custom") return;
    setDueDate(dateForPreset(selectedPreset));
  }, [selectedPreset]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !userId || !supabase) return;

    let active = true;

    async function loadTasks() {
      setIsLoadingTasks(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, notes, due_date, reminder_at, priority, completed, created_at")
        .eq("clerk_user_id", userId)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setErrorMessage(error.message || "Failed to load tasks.");
        setTasks([]);
      } else {
        setTasks((data || []).map(fromTaskRow));
      }

      setIsLoadingTasks(false);
    }

    loadTasks();

    return () => {
      active = false;
    };
  }, [isLoaded, userId, supabase]);

  const todayKey = toDateOnly(new Date());

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.dueDate <= todayKey).sort(sortTasks),
    [tasks, todayKey],
  );

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

  function resetForm({ closeQuickAdd = false } = {}) {
    setEditingTaskId(null);
    setTitle("");
    setPriority("medium");
    setReminderAt("");
    setNotes("");
    setSelectedPreset("today");
    setDueDate(dateForPreset("today"));

    if (closeQuickAdd) {
      setIsQuickAddOpen(false);
    }
  }

  function openQuickAddForCreate() {
    resetForm();
    setIsQuickAddOpen(true);
  }

  function closeQuickAdd() {
    resetForm({ closeQuickAdd: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();

    if (!cleanTitle || !userId || !supabase) return;

    setIsMutating(true);
    setErrorMessage("");

    if (editingTaskId) {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: cleanTitle,
          due_date: dueDate,
          priority,
          reminder_at: toIsoStringOrNull(reminderAt),
          notes: notes.trim(),
        })
        .eq("id", editingTaskId)
        .eq("clerk_user_id", userId)
        .select("id, title, notes, due_date, reminder_at, priority, completed, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message || "Failed to update task.");
        setIsMutating(false);
        return;
      }

      setTasks((prev) => prev.map((task) => (task.id === editingTaskId ? fromTaskRow(data) : task)));
    } else {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          clerk_user_id: userId,
          title: cleanTitle,
          due_date: dueDate,
          priority,
          reminder_at: toIsoStringOrNull(reminderAt),
          notes: notes.trim(),
        })
        .select("id, title, notes, due_date, reminder_at, priority, completed, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message || "Failed to create task.");
        setIsMutating(false);
        return;
      }

      setTasks((prev) => [...prev, fromTaskRow(data)]);
    }

    setIsMutating(false);
    resetForm({ closeQuickAdd: isMobile });
  }

  function startEdit(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    setEditingTaskId(task.id);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setReminderAt(task.reminderAt || "");
    setNotes(task.notes || "");
    setSelectedPreset(detectPreset(task.dueDate));

    if (isMobile) {
      setIsQuickAddOpen(true);
    }
  }

  async function toggleTask(id) {
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
      .select("id, title, notes, due_date, reminder_at, priority, completed, created_at")
      .single();

    if (error) {
      setErrorMessage(error.message || "Failed to update task status.");
      setIsMutating(false);
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === id ? fromTaskRow(data) : task)));
    setIsMutating(false);
  }

  function requestDelete(id) {
    setDeleteCandidateId(id);
  }

  async function confirmDelete() {
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

  function cancelDelete() {
    setDeleteCandidateId(null);
  }

  async function clearCompleted() {
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

  function renderQuickAddForm(idPrefix) {
    return (
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-task-title`}>Task</Label>
          <Input
            id={`${idPrefix}-task-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Pay electricity bill"
            required
            disabled={isMutating}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>When</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "next-month", label: "Next Month" },
            ].map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={selectedPreset === preset.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedPreset(preset.value)}
                disabled={isMutating}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setSelectedPreset("custom");
            }}
            min={toDateOnly(new Date(2000, 0, 1))}
            disabled={isMutating}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select value={priority} onValueChange={setPriority} disabled={isMutating}>
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
          <Input
            id={`${idPrefix}-reminder-at`}
            type="datetime-local"
            value={reminderAt}
            onChange={(event) => setReminderAt(event.target.value)}
            disabled={isMutating}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
          <Textarea
            id={`${idPrefix}-notes`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any extra context"
            disabled={isMutating}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={isMutating}>
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
          {editingTaskId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => resetForm({ closeQuickAdd: isMobile })}
              disabled={isMutating}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  const completedToday = todayTasks.filter((task) => task.completed).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_8%,#dbeafe_0%,transparent_32%),radial-gradient(circle_at_90%_12%,#fce7f3_0%,transparent_28%),#f8fafc]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6">
        <header className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Reminders</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Today</h1>
            <p className="mt-1 text-sm text-slate-500">{formatFullDate()}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-white/90 px-3 py-1 text-sm font-bold text-slate-700">
              Total {tasks.length}
            </Badge>
            <Badge variant="outline" className="bg-white/90 px-3 py-1 text-sm font-bold text-slate-700">
              Today {todayTasks.length}
            </Badge>
            <Badge variant="outline" className="bg-white/90 px-3 py-1 text-sm font-bold text-slate-700">
              Done {completedToday}
            </Badge>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {!hasSupabaseEnv ? (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-sm text-amber-800">
              Supabase env vars are missing. Set <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or legacy <code>VITE_SUPABASE_ANON_KEY</code>).
            </CardContent>
          </Card>
        ) : null}

        {errorMessage ? (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <div className="mb-4 lg:hidden">
          <Button onClick={openQuickAddForCreate} className="w-full" disabled={isMutating || !hasSupabaseEnv}>
            <Plus className="mr-1 h-4 w-4" />
            Quick Add
          </Button>
        </div>

        <main className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-200/90 bg-white/95 shadow-xl shadow-slate-900/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Today Focus</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompleted}
                  disabled={isMutating || !tasks.some((task) => task.completed)}
                >
                  Clear completed
                </Button>
              </div>
              <CardDescription>Your day at a glance. Finish these first.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTasks ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading reminders...
                </div>
              ) : todayTasks.length ? (
                <ul className="grid gap-2.5">
                  {todayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      swipeEnabled={isMobile}
                      onToggle={toggleTask}
                      onEdit={startEdit}
                      onDelete={requestDelete}
                      isEditing={editingTaskId === task.id}
                      disabled={isMutating || !hasSupabaseEnv}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">No tasks for today</p>
                  <p className="mt-1 text-sm text-slate-500">Tap Quick Add to create your first reminder.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="grid content-start gap-4">
            {!isMobile ? (
              <Card className="border-slate-200/90 bg-white/95 shadow-xl shadow-slate-900/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{editingTaskId ? "Edit Reminder" : "Quick Add"}</CardTitle>
                </CardHeader>
                <CardContent>{renderQuickAddForm("desktop")}</CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200/90 bg-white/95 shadow-xl shadow-slate-900/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTasks ? (
                  <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                    Loading upcoming tasks...
                  </div>
                ) : upcomingTasks.length ? (
                  <ul className="grid gap-2.5">
                    {upcomingTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        compact
                        swipeEnabled={isMobile}
                        onToggle={toggleTask}
                        onEdit={startEdit}
                        onDelete={requestDelete}
                        isEditing={editingTaskId === task.id}
                        disabled={isMutating || !hasSupabaseEnv}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                    Nothing upcoming yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </main>
      </div>

      {isMobile && isQuickAddOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 pt-10" onClick={closeQuickAdd}>
          <Card
            className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto border-slate-200 bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{editingTaskId ? "Edit Reminder" : "Quick Add"}</CardTitle>
                <Button size="icon" variant="ghost" onClick={closeQuickAdd} aria-label="Close quick add">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Add and edit tasks without leaving Today Focus.</CardDescription>
            </CardHeader>
            <CardContent>{renderQuickAddForm("mobile")}</CardContent>
          </Card>
        </div>
      ) : null}

      {deleteCandidateTask ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/45 p-4 pt-16" onClick={cancelDelete}>
          <Card
            className="mx-auto w-full max-w-md border-slate-200 bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Delete this task?</CardTitle>
              <CardDescription>
                This will permanently remove <span className="font-semibold text-slate-700">{deleteCandidateTask.title}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelDelete} disabled={isMutating}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isMutating}>
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Button
        size="icon"
        className={cn(
          "fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-xl shadow-slate-900/25 lg:hidden",
          isQuickAddOpen && "hidden",
        )}
        onClick={openQuickAddForCreate}
        aria-label="Open quick add"
        disabled={isMutating || !hasSupabaseEnv}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}

export default function App() {
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
