import { formatDuration } from "../api";

type TravelingContext = "home" | "work" | "city";

const CONTEXT_LINES: Record<TravelingContext, string | null> = {
  home: "Дом после прибытия",
  work: "Работа после прибытия",
  city: "Город после прибытия",
};

export function TravelingCard({
  remainingMs,
  context = "city",
}: {
  remainingMs: number;
  context?: TravelingContext;
}) {
  const line = CONTEXT_LINES[context];

  return (
    <div className="card traveling-card">
      <h2>В пути</h2>
      <p>До прибытия: {formatDuration(remainingMs)}</p>
      {line ? <p className="traveling-card-muted">{line}</p> : null}
    </div>
  );
}
