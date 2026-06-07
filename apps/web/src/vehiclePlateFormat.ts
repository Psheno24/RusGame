import type { VehiclePlateParts } from "../vehiclePlate";

export function formatVehiclePlate(parts: VehiclePlateParts): string {
  return `${parts.l1} ${parts.digits} ${parts.l2} | ${parts.region} RUS`;
}
