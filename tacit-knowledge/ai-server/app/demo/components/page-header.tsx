import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Compact mode for chat-based pages (inline header bar) */
  compact?: boolean;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  children,
  compact = false,
}: PageHeaderProps) {
  if (compact) {
    return (
      <div className="bg-white border-b border-gray-200/80 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100">
            <Icon className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-gray-400 leading-tight">
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
