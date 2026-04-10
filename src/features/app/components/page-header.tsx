import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export function PageHeader({ title, description, Icon }: PageHeaderProps): JSX.Element {
  return (
    <div className="-mx-4 sticky top-0 z-20 mb-4 border-b border-gray-200 bg-gray-50/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-sm text-gray-400">{description}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
      </div>
    </div>
  );
}
