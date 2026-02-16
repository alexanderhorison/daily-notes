import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => {
    const isDateLike = type === "date" || type === "datetime-local";

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 ring-offset-stone-50 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50",
          isDateLike && "date-input-clean",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
