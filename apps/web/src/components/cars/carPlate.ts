import type { VehiclePlateParts } from "../../api";
import { parseVehiclePlateText } from "../../vehiclePlate";

export function resolveVehiclePlateParts(
  parts?: VehiclePlateParts | null,
  plateText?: string | null,
): VehiclePlateParts | null {
  if (parts) return parts;
  return parseVehiclePlateText(plateText);
}
