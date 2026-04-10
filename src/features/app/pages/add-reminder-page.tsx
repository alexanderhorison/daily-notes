import { Plus } from "lucide-react";

import { PageHeader } from "@/features/app/components/page-header";

type AddReminderPageProps = {
  isEditing: boolean;
  form: JSX.Element;
};

export function AddReminderPage({ isEditing, form }: AddReminderPageProps): JSX.Element {
  return (
    <div className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <PageHeader
        title={isEditing ? "Edit Reminder" : "Add Reminder"}
        description={isEditing ? "Update your reminder details" : "Create and schedule a new task"}
        Icon={Plus}
      />
      {form}
    </div>
  );
}
