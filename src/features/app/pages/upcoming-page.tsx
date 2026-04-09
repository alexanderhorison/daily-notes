import { CalendarDays, Loader2 } from "lucide-react";

import { TaskRow, type TaskRowActionProps } from "@/features/app/components/task-row";
import { PageHeader } from "@/features/app/components/page-header";
import type { Task } from "@/lib/task-types";

type UpcomingPageProps = {
  errorMessage: string;
  isLoadingTasks: boolean;
  upcomingTasks: Task[];
  editingTaskId: string | null;
  taskRowActionProps: TaskRowActionProps;
};

export function UpcomingPage({
  errorMessage,
  isLoadingTasks,
  upcomingTasks,
  editingTaskId,
  taskRowActionProps,
}: UpcomingPageProps): JSX.Element {
  return (
    <div className="px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <PageHeader title="Upcoming" description="Tasks due after today" Icon={CalendarDays} />

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      {isLoadingTasks ? (
        <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : upcomingTasks.length ? (
        <ul className="grid gap-2">
          {upcomingTasks.map((task) => (
            <TaskRow key={task.id} task={task} isEditing={editingTaskId === task.id} {...taskRowActionProps} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="font-semibold text-gray-500">Nothing upcoming</p>
          <p className="mt-1 text-sm text-gray-400">Tap Add to schedule future reminders.</p>
        </div>
      )}
    </div>
  );
}
