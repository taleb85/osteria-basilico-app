import type { ReactNode } from 'react';

export type AdminRowProps = {
  label: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

/**
 * Riga permessi / impostazioni: altezza minima confortevole, nessuna altezza fissa da toolbar (evita sovrapposizioni testo).
 */
export default function AdminRow({
  label,
  description,
  action,
  badge,
  icon,
  className = '',
}: AdminRowProps) {
  return (
    <div
      className={`flex min-h-[64px] items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-gray-50/50 dark:border-white/10 dark:hover:bg-white/[0.04] ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
        {icon != null ? <span className="shrink-0 text-slate-500 dark:text-neutral-300 [&_svg]:block">{icon}</span> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-bold leading-tight text-gray-900 dark:text-neutral-100">{label}</span>
            {badge}
          </div>
          {description != null && description !== '' ? (
            <span className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-neutral-400">{description}</span>
          ) : null}
        </div>
      </div>
      {action != null ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}
