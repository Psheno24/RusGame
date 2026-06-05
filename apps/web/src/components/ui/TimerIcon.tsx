export function TimerIcon({ className = "ui-timer-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 10v3.5l2.25 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 3h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 3v2.25" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
