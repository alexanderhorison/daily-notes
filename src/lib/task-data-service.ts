import type { AppSupabaseClient, DbTaskRow, Priority } from "@/lib/supabase";

type SupabaseErrorLike = { message?: string } | null;

export type TaskWritePayload = {
  title: string;
  due_date: string;
  priority: Priority;
  reminder_at: string | null;
  notes: string;
};

export class TaskDataService {
  private readonly taskSelectColumns = "id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at";

  constructor(
    private readonly client: AppSupabaseClient,
    private readonly appUserId: string,
  ) {}

  async listTasks(): Promise<{ data: DbTaskRow[] | null; error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .select(this.taskSelectColumns)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });
    return response;
  }

  async createTask(payload: TaskWritePayload): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .insert({ user_id: this.appUserId, ...payload })
      .select(this.taskSelectColumns)
      .single();
    return response;
  }

  async updateTask(id: string, payload: TaskWritePayload): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .update(payload)
      .eq("id", id)
      .select(this.taskSelectColumns)
      .single();
    return response;
  }

  async setTaskCompleted(id: string, completed: boolean): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .update({ completed })
      .eq("id", id)
      .select(this.taskSelectColumns)
      .single();
    return response;
  }

  async deleteTask(id: string): Promise<{ error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .delete()
      .eq("id", id);
    return response;
  }

  async deleteTasksByIds(ids: string[]): Promise<{ error: SupabaseErrorLike }> {
    const response = await this.client
      .from("tasks")
      .delete()
      .in("id", ids);
    return response;
  }
}
