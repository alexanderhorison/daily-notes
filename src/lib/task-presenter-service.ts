import { TaskDateService } from "@/lib/task-date-service";
import type { DbTaskRow, Priority } from "@/lib/supabase";
import type { Task } from "@/lib/task-types";

const priorityRank: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class TaskPresenterService {
  static sortTasks(a: Task, b: Task): number {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    const aTime = TaskPresenterService.getTaskSortTime(a);
    const bTime = TaskPresenterService.getTaskSortTime(b);
    if (aTime !== bTime) return aTime - bTime;

    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }

    return a.createdAt.localeCompare(b.createdAt);
  }

  static priorityStyle(priority: Priority): string {
    if (priority === "high") return "border-red-300 text-red-800 bg-red-50";
    if (priority === "medium") return "border-amber-300 text-amber-800 bg-amber-50";

    return "border-stone-300 text-stone-700 bg-stone-100";
  }

  static fromTaskRow(row: DbTaskRow): Task {
    return {
      id: row.id,
      title: row.title,
      notes: row.notes || "",
      dueDate: row.due_date,
      reminderAt: TaskDateService.toDateTimeLocalValue(row.reminder_at),
      priority: row.priority,
      completed: row.completed,
      createdAt: row.created_at,
    };
  }

  static hasPendingReminders(tasks: Task[]): boolean {
    return tasks.some((task) => {
      if (task.completed || !task.reminderAt) return false;
      return !Number.isNaN(new Date(task.reminderAt).getTime());
    });
  }

  private static getTaskSortTime(task: Task): number {
    if (task.reminderAt) {
      const reminderTime = new Date(task.reminderAt).getTime();
      if (!Number.isNaN(reminderTime)) return reminderTime;
    }

    const dueBoundaryTime = new Date(`${task.dueDate}T23:59:59`).getTime();
    if (!Number.isNaN(dueBoundaryTime)) return dueBoundaryTime;

    return Number.MAX_SAFE_INTEGER;
  }
}
