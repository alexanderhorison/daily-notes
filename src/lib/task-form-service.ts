import { z } from "zod";

import type { Priority } from "@/lib/supabase";
import { formErrorKeys, type FormErrorKey, type FormErrors } from "@/lib/task-types";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export class TaskFormService {
  static readonly schema = z
    .object({
      title: z.string().trim().min(1, "Task is required").max(160, "Task title is too long"),
      dueDate: z
        .string()
        .regex(dateOnlyRegex, "Choose a valid due date")
        .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00`).getTime()), "Choose a valid due date"),
      priority: z.enum(["low", "medium", "high"]),
      reminderAt: z
        .string()
        .trim()
        .min(1, "Reminder time is required")
        .refine((value) => !Number.isNaN(new Date(value).getTime()), "Choose a valid reminder time"),
      notes: z.string().trim().max(1000, "Notes are too long"),
    })
    .superRefine((data, ctx) => {
      const reminderTime = new Date(data.reminderAt).getTime();
      if (Number.isNaN(reminderTime)) return;
      const dueBoundary = new Date(`${data.dueDate}T23:59:59`).getTime();

      if (reminderTime > dueBoundary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reminderAt"],
          message: "Reminder should be on or before the due date",
        });
      }
    });

  static mapZodErrors(error: z.ZodError): FormErrors {
    const next: FormErrors = {};

    for (const issue of error.issues) {
      const field = issue.path[0];

      if (typeof field !== "string" || !TaskFormService.isFormErrorKey(field) || next[field]) {
        continue;
      }

      next[field] = issue.message;
    }

    return next;
  }

  static isPriority(value: string): value is Priority {
    return value === "low" || value === "medium" || value === "high";
  }

  private static isFormErrorKey(value: string): value is FormErrorKey {
    return formErrorKeys.includes(value as FormErrorKey);
  }
}
