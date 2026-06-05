import { formatDuration } from "../api";
import { TimerIcon } from "./ui/TimerIcon";

export function JobActionButtonLabel({
  base,
  remainingMs,
  disabledReason,
}: {
  base: string;
  remainingMs?: number;
  disabledReason?: string;
}) {
  const mins =
    remainingMs != null && remainingMs > 0
      ? formatDuration(remainingMs).replace(/ /g, "\u00A0")
      : null;

  if (!disabledReason && !mins) {
    return <span className="job-btn-text">{base}</span>;
  }

  return (
    <span className="job-btn-label job-btn-label--stack">
      <span className="job-btn-text">{base}</span>
      {disabledReason ? <span className="job-btn-reason">{disabledReason}</span> : null}
      {mins ? (
        <span className="job-btn-cooldown">
          <TimerIcon /> {mins}
        </span>
      ) : null}
    </span>
  );
}
