import { type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Trash2 } from "lucide-react";

import { TaskDateService } from "@/lib/task-date-service";
import type { Task } from "@/lib/task-types";
import { cn } from "@/lib/utils";

export type TaskRowProps = {
  task: Task;
  isEditing?: boolean;
  swipeEnabled?: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export type TaskRowActionProps = Pick<TaskRowProps, "swipeEnabled" | "disabled" | "onToggle" | "onEdit" | "onDelete">;

export function TaskRow({
  task,
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
    if (!swipeEnabled && swipeOffset !== 0) setSwipeOffset(0);
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

  const iconBg = task.completed
    ? "bg-green-50"
    : task.priority === "high"
      ? "bg-red-50"
      : task.priority === "medium"
        ? "bg-amber-50"
        : "bg-gray-50";

  const iconColor = task.completed
    ? "text-green-500"
    : task.priority === "high"
      ? "text-red-500"
      : task.priority === "medium"
        ? "text-amber-500"
        : "text-gray-400";
  const notePreview = task.notes.trim();
  const statusActionLabel = task.completed ? "Mark active" : "Mark done";
  const nowMs = Date.now();
  const reminderMs = task.reminderAt ? new Date(task.reminderAt).getTime() : Number.NaN;
  const isDateOverdue = !task.completed && task.dueDate < TaskDateService.toDateOnly(new Date());
  const isReminderDue = !task.completed && !Number.isNaN(reminderMs) && reminderMs <= nowMs;
  const isOverdue = isDateOverdue || isReminderDue;
  const overdueLabel = isDateOverdue ? "Overdue" : "Due now";

  function handleCardClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (disabled) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    if (closeSwipeIfOpen()) return;
    onEdit(task.id);
  }

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-gray-300 bg-white p-4",
        isEditing && "border-gray-900 ring-1 ring-gray-900/10",
      )}
      onClick={handleCardClick}
    >
      <button
        type="button"
        className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          if (closeSwipeIfOpen()) return;
          onToggle(task.id);
        }}
        aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
        disabled={disabled}
      >
        {task.completed ? (
          <CheckCircle2 className={cn("h-5 w-5", iconColor)} />
        ) : (
          <BellRing className={cn("h-5 w-5", iconColor)} strokeWidth={1.75} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate font-semibold text-gray-900", task.completed && "text-gray-400 line-through")}>
            {task.title}
          </p>
          {isOverdue ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {overdueLabel}
            </span>
          ) : null}
        </div>
        <p className={cn("mt-0.5 text-xs", isOverdue ? "text-red-600" : "text-gray-400")}>
          {TaskDateService.formatDueDate(task.dueDate)} · {task.priority}
          {task.reminderAt ? ` · ${TaskDateService.formatReminder(task.reminderAt)}` : ""}
        </p>
        {notePreview ? <p className="mt-1 truncate text-xs text-gray-500">{notePreview}</p> : null}
      </div>

      <div className={cn("flex items-center gap-1.5 transition-all duration-150", isSwipeOpen && "pointer-events-none opacity-0")}>
        <button
          type="button"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg border",
            task.completed
              ? "border-gray-300 text-gray-500 active:bg-gray-100"
              : "border-green-300 text-green-700 active:bg-green-50",
          )}
          onClick={(event) => {
            event.stopPropagation();
            if (disabled) return;
            if (closeSwipeIfOpen()) return;
            onToggle(task.id);
          }}
          aria-label={`${statusActionLabel} for ${task.title}`}
          title="Tap to change status"
          disabled={disabled}
        >
          {task.completed ? <BellRing className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 text-red-500 active:bg-red-50"
          onClick={(event) => {
            event.stopPropagation();
            if (disabled) return;
            onDelete(task.id);
          }}
          aria-label={`Delete ${task.title}`}
          title="Delete reminder"
          disabled={disabled}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  if (!swipeEnabled) {
    return <li>{content}</li>;
  }

  return (
    <li className="relative overflow-hidden rounded-2xl">
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-r-2xl bg-red-500 transition-opacity duration-150",
          isSwipeOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          className="flex h-full w-full items-center justify-center text-white"
          onClick={() => {
            if (disabled) return;
            onDelete(task.id);
          }}
          aria-label={`Delete ${task.title}`}
          disabled={disabled}
        >
          <Trash2 className="h-5 w-5" />
        </button>
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
