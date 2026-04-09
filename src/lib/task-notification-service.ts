import type { Task } from "@/lib/task-types";

const defaultRepeatIntervalMs = 10 * 60 * 1000;

export type NotificationPermissionState = NotificationPermission | "unsupported";

export class TaskNotificationService {
  private readonly lastNotifiedByTaskId = new Map<string, number>();

  constructor(private readonly repeatIntervalMs: number = defaultRepeatIntervalMs) {}

  getPermission(): NotificationPermissionState {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return Notification.requestPermission();
  }

  notifyPendingTasks(tasks: Task[], nowMs: number = Date.now()): void {
    const activeReminderIds = new Set<string>();

    for (const task of tasks) {
      if (task.completed || !task.reminderAt) continue;

      const reminderTime = new Date(task.reminderAt).getTime();
      if (Number.isNaN(reminderTime)) continue;

      activeReminderIds.add(task.id);

      if (reminderTime > nowMs) {
        this.lastNotifiedByTaskId.delete(task.id);
        continue;
      }

      const lastNotifiedAt = this.lastNotifiedByTaskId.get(task.id);
      if (lastNotifiedAt && nowMs - lastNotifiedAt < this.repeatIntervalMs) {
        continue;
      }

      try {
        new Notification(task.title, {
          body: "Reminder still pending. Alerts repeat every 10 minutes until you check it.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
        });
        this.lastNotifiedByTaskId.set(task.id, nowMs);
      } catch {
        // Ignore notification failures from unsupported browser states.
      }
    }

    this.lastNotifiedByTaskId.forEach((_, taskId) => {
      if (!activeReminderIds.has(taskId)) {
        this.lastNotifiedByTaskId.delete(taskId);
      }
    });
  }
}
