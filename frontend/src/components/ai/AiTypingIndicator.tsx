type AiTypingIndicatorProps = {
  className?: string;
};

export function AiTypingIndicator({ className = '' }: AiTypingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1 ${className}`}
    >
      <span className="sr-only">El asistente está escribiendo</span>
      <span className="ai-wave-dot h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-200" />
      <span
        className="ai-wave-dot h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-200"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="ai-wave-dot h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-200"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}
