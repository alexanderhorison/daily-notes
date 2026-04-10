import { Home, Loader2 } from "lucide-react";

import { TaskRow, type TaskRowActionProps } from "@/features/app/components/task-row";
import { PageHeader } from "@/features/app/components/page-header";
import type { Task } from "@/lib/task-types";

type TodayPageProps = {
  headerDescription: string;
  todayTasks: Task[];
  completedToday: number;
  isLoadingTasks: boolean;
  errorMessage: string;
  isMutating: boolean;
  editingTaskId: string | null;
  hasCompletedTasks: boolean;
  onClearCompleted: () => void;
  taskRowActionProps: TaskRowActionProps;
};

export function TodayPage({
  headerDescription,
  todayTasks,
  completedToday,
  isLoadingTasks,
  errorMessage,
  isMutating,
  editingTaskId,
  hasCompletedTasks,
  onClearCompleted,
  taskRowActionProps,
}: TodayPageProps): JSX.Element {
  return (
    <div className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <PageHeader title="Today" description={headerDescription} Icon={Home} />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-300 bg-white p-4">
          <p className="text-3xl font-bold text-gray-900">{todayTasks.length}</p>
          <p className="mt-1 text-sm text-gray-400">Today's tasks</p>
        </div>
        <div className="rounded-2xl border border-gray-300 bg-white p-4">
          <p className="text-3xl font-bold text-gray-900">{completedToday}</p>
          <p className="mt-1 text-sm text-gray-400">Completed</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Today's Reminders</h2>
        {hasCompletedTasks ? (
          <button
            type="button"
            onClick={onClearCompleted}
            disabled={isMutating}
            className="text-sm font-medium text-red-500 disabled:opacity-50"
          >
            Clear done
          </button>
        ) : null}
      </div>

      {isLoadingTasks ? (
        <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reminders...
        </div>
      ) : todayTasks.length ? (
        <ul className="grid gap-2">
          {todayTasks.map((task) => (
            <TaskRow key={task.id} task={task} isEditing={editingTaskId === task.id} {...taskRowActionProps} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="font-semibold text-gray-500">No tasks for today</p>
          <p className="mt-1 text-sm text-gray-400">Tap Add to create your first reminder.</p>
        </div>
      )}
    </div>
  );
}
