import type { CSSProperties } from "react";
import {
  displayPlateParts,
  parseVehiclePlateText,
  vehiclePlateAriaLabel,
  type VehiclePlateParts,
} from "../vehiclePlate";
import "./VehiclePlate.css";

const PLACEHOLDER: VehiclePlateParts = {
  l1: "·",
  digits: "···",
  l2: "··",
  region: "··",
};

const WIDTH_PX = { sm: 132, md: 188, lg: 260 } as const;

type Props = {
  parts?: VehiclePlateParts | null;
  plateText?: string | null;
  size?: "sm" | "md" | "lg";
  spinning?: boolean;
  className?: string;
};

export function VehiclePlate({
  parts: partsProp,
  plateText,
  size = "md",
  spinning = false,
  className = "",
}: Props) {
  const resolved = partsProp ?? parseVehiclePlateText(plateText);
  const parts = resolved ?? (spinning || !plateText ? PLACEHOLDER : null);
  if (!parts) return null;

  const show = resolved ? displayPlateParts(parts) : parts;
  const label = resolved ? vehiclePlateAriaLabel(resolved) : "Госномер";
  const rootClass = [
    "gost-plate",
    `gost-plate--${size}`,
    spinning ? "gost-plate--spin" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const width = WIDTH_PX[size];
  const height = Math.round((width * 112) / 520);
  const mainText = `${show.l1}${show.digits}${show.l2}`;

  return (
    <div
      className={rootClass}
      role="img"
      aria-label={label}
      style={
        {
          width,
          minWidth: 0,
          maxWidth: size === "lg" ? "100%" : width,
          "--plate-h": `${height}px`,
        } as CSSProperties
      }
    >
      <svg className="gost-plate__svg" viewBox="0 0 520 112" aria-hidden>
        <rect className="gost-plate__rim" x="0" y="0" width="520" height="112" rx="8" />
        <rect className="gost-plate__surface" x="4" y="4" width="512" height="104" rx="4" />
        <line className="gost-plate__divider" x1="407" y1="4" x2="407" y2="108" />
        <text
          className="gost-plate__main-text"
          x="22"
          y="86"
          textLength="360"
          lengthAdjust="spacingAndGlyphs"
        >
          {mainText}
        </text>
        <text
          className="gost-plate__region"
          x="462"
          y="61"
          textAnchor="middle"
        >
          {show.region}
        </text>
        <text className="gost-plate__rus" x="423" y="96">
          RUS
        </text>
        <g className="gost-plate__flag" transform="translate(473 77)">
          <rect className="gost-plate__flag-border" x="0" y="0" width="34" height="20" rx="1" />
          <rect className="gost-plate__flag-white" x="1" y="1" width="32" height="6" />
          <rect className="gost-plate__flag-blue" x="1" y="7" width="32" height="6" />
          <rect className="gost-plate__flag-red" x="1" y="13" width="32" height="6" />
        </g>
      </svg>
    </div>
  );
}
