import { getPlayer } from "./db.js";
import { resolveTravel } from "./game.js";
import { syncPlayerHousing } from "./housing.js";
import { syncPlayerSimTariffBilling } from "./simTariff.js";
import { syncPlayerCarMaintenance } from "./carMaintenance.js";
import { syncPlayerSleep } from "./playerSleep.js";
import { syncTaxiForPlayer } from "./taxi.js";
import { getDeliveryStatus } from "./delivery.js";
import { findCityJob } from "./gameData.js";
import { jobCityId } from "./jobLocation.js";
import { syncEducation } from "./education.js";
import { syncPlayerVehicleRental } from "./vehicleRental.js";
import { syncEmergencyLoaderEmployment } from "./emergencyLoader.js";

/** Синхронизация состояния по серверному времени (прибытие, жильё, сим). */
export function refreshPlayerState(userId: number, now = Date.now()) {
  let player = getPlayer(userId);
  if (!player) return undefined;
  player = resolveTravel(player, now);
  player = syncPlayerSleep(player, now);
  player = syncPlayerVehicleRental(player, now);
  player = syncPlayerHousing(player, now);
  syncPlayerSimTariffBilling(userId, now);
  syncPlayerCarMaintenance(userId, now);
  syncTaxiForPlayer(player, now);
  player = syncEducation(player, now);
  if (player.job_id) {
    const job = findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id);
    if (job?.kind === "delivery_line") {
      getDeliveryStatus(player, job, now);
    }
  }
  syncEmergencyLoaderEmployment(userId, now);
  return getPlayer(userId) ?? player;
}
