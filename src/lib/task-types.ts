import type { Priority } from "@/lib/supabase";

export type DatePreset = "today" | "tomorrow" | "next-week" | "next-month" | "custom";

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  reminderAt: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
};

export const formErrorKeys = ["title", "dueDate", "reminderAt", "notes"] as const;

export type FormErrorKey = (typeof formErrorKeys)[number];

export type FormErrors = Partial<Record<FormErrorKey, string>>;
