import type { CSSProperties } from "react";
import {
  parseVehiclePlateText,
  vehiclePlateAriaLabel,
  type VehiclePlateParts,
} from "../vehiclePlate";
import { buildPlateSvgMarkup } from "../plateSvgMarkup";
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
      dangerouslySetInnerHTML={{ __html: buildPlateSvgMarkup(parts) }}
    />
  );
}
