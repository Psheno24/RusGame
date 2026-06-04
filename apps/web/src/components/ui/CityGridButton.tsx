import type { ReactNode } from "react";

type Props = {
  title: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

export function CityGridButton({
  title,
  hint,
  onClick,
  disabled,
  className = "",
  children,
}: Props) {
  return (
    <button
      type="button"
      className={`city-grid-btn${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="city-grid-title">{title}</span>
      {hint ? <span className="city-grid-hint">{hint}</span> : null}
      {children}
    </button>
  );
}
