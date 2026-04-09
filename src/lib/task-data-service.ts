import type { AppSupabaseClient, DbTaskRow, Priority } from "@/lib/supabase";

type OwnerIdColumn = "user_id" | "clerk_user_id";
type SupabaseErrorLike = { message?: string } | null;

export type TaskWritePayload = {
  title: string;
  due_date: string;
  priority: Priority;
  reminder_at: string | null;
  notes: string;
};

export class TaskDataService {
  private ownerIdColumn: OwnerIdColumn = "user_id";
  private readonly taskSelectColumns = "id, title, notes, due_date, reminder_at, priority, completed, created_at, updated_at";

  constructor(
    private readonly client: AppSupabaseClient,
    private readonly appUserId: string,
  ) {}

  async listTasks(): Promise<{ data: DbTaskRow[] | null; error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetry<DbTaskRow[] | null>(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .select(this.taskSelectColumns)
        .eq(ownerColumn, this.appUserId)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: true });
      return response;
    });
  }

  async createTask(payload: TaskWritePayload): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetry<DbTaskRow | null>(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .insert({ [ownerColumn]: this.appUserId, ...payload })
        .select(this.taskSelectColumns)
        .single();
      return response;
    });
  }

  async updateTask(id: string, payload: TaskWritePayload): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetry<DbTaskRow | null>(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .update(payload)
        .eq("id", id)
        .eq(ownerColumn, this.appUserId)
        .select(this.taskSelectColumns)
        .single();
      return response;
    });
  }

  async setTaskCompleted(id: string, completed: boolean): Promise<{ data: DbTaskRow | null; error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetry<DbTaskRow | null>(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .update({ completed })
        .eq("id", id)
        .eq(ownerColumn, this.appUserId)
        .select(this.taskSelectColumns)
        .single();
      return response;
    });
  }

  async deleteTask(id: string): Promise<{ error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetryNoData(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq(ownerColumn, this.appUserId);
      return response;
    });
  }

  async deleteTasksByIds(ids: string[]): Promise<{ error: SupabaseErrorLike }> {
    return this.withOwnerColumnRetryNoData(async (ownerColumn) => {
      const response = await this.client
        .from("tasks")
        .delete()
        .in("id", ids)
        .eq(ownerColumn, this.appUserId);
      return response;
    });
  }

  private isMissingUserIdColumnError(error: SupabaseErrorLike): boolean {
    const message = (error?.message ?? "").toLowerCase();
    return message.includes("column tasks.user_id does not exist") || message.includes('column "user_id" does not exist');
  }

  private async withOwnerColumnRetry<T>(
    operation: (ownerColumn: OwnerIdColumn) => Promise<{ data: T; error: SupabaseErrorLike }>,
  ): Promise<{ data: T; error: SupabaseErrorLike }> {
    let result = await operation(this.ownerIdColumn);

    if (this.ownerIdColumn === "user_id" && this.isMissingUserIdColumnError(result.error)) {
      this.ownerIdColumn = "clerk_user_id";
      result = await operation(this.ownerIdColumn);
    }

    return result;
  }

  private async withOwnerColumnRetryNoData(
    operation: (ownerColumn: OwnerIdColumn) => Promise<{ error: SupabaseErrorLike }>,
  ): Promise<{ error: SupabaseErrorLike }> {
    let result = await operation(this.ownerIdColumn);

    if (this.ownerIdColumn === "user_id" && this.isMissingUserIdColumnError(result.error)) {
      this.ownerIdColumn = "clerk_user_id";
      result = await operation(this.ownerIdColumn);
    }

    return result;
  }
}
