import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export function PageHeader({ title, description, Icon }: PageHeaderProps): JSX.Element {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-sm text-gray-400">{description}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-5 w-5 text-gray-500" />
      </div>
    </div>
  );
}
