type Props = {
  title: string;
  onBack: () => void;
  /** Для aria-label, без видимого текста */
  backLabel?: string;
};

export function CitySectionHeader({ title, onBack, backLabel }: Props) {
  return (
    <header className="city-section-header">
      <button
        type="button"
        className="city-section-back"
        onClick={onBack}
        aria-label={backLabel ? `К ${backLabel}` : "Назад"}
      >
        <span className="city-section-back-icon" aria-hidden>
          ‹
        </span>
      </button>
      <h2 className="city-section-title">{title}</h2>
    </header>
  );
}
