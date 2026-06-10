import { getBalanceBible } from "./balanceBible.js";
import { formatRub } from "./formatRub.js";
import { randInt } from "./random.js";

type TaxiTripEventDef = {
  chance: number;
  bonusMin?: number;
  bonusMax?: number;
  payMult?: number;
  extraMinMin?: number;
  extraMinMax?: number;
  reputationDelta?: number;
};

export type TaxiTripEventResult = {
  payoutRub: number;
  extraMinutes: number;
  reputationDelta: number;
  notes: string[];
  payoutNotes: string[];
};

function taxiEventsConfig(): Record<string, TaxiTripEventDef> {
  return (getBalanceBible().taxi as { events: Record<string, TaxiTripEventDef> }).events;
}

/** Случайные события по завершении поездки (чаевые, пробки, жалобы и т.д.). */
export function rollTaxiTripEvents(basePayout: number): TaxiTripEventResult {
  const events = taxiEventsConfig();
  let payoutRub = basePayout;
  let extraMinutes = 0;
  let reputationDelta = 0;
  const notes: string[] = [];
  const payoutNotes: string[] = [];

  if (Math.random() < events.tips.chance) {
    const tip = randInt(events.tips.bonusMin!, events.tips.bonusMax!);
    payoutRub += tip;
    const line = `+${formatRub(tip)} чаевые`;
    notes.push(line);
    payoutNotes.push(line);
  }
  if (Math.random() < events.smoothRide.chance) {
    payoutRub = Math.round(payoutRub * events.smoothRide.payMult!);
    const line = "Без пробок +20%";
    notes.push(line);
    payoutNotes.push(line);
  }
  if (Math.random() < events.passengerLate.chance) {
    extraMinutes += randInt(events.passengerLate.extraMinMin!, events.passengerLate.extraMinMax!);
    notes.push("Пассажир задержался");
  }
  if (Math.random() < events.trafficJam.chance) {
    extraMinutes += randInt(events.trafficJam.extraMinMin!, events.trafficJam.extraMinMax!);
    notes.push("Пробка");
  }
  if (Math.random() < events.rudePassenger.chance) {
    payoutRub = Math.round(payoutRub * events.rudePassenger.payMult!);
    const line = "Конфликт с пассажиром −15%";
    notes.push(line);
    payoutNotes.push(line);
  }
  if (Math.random() < events.complaint.chance) {
    payoutRub = Math.round(payoutRub * events.complaint.payMult!);
    reputationDelta += events.complaint.reputationDelta ?? 0;
    const line = "Жалоба −50%";
    notes.push(line);
    payoutNotes.push(line);
  }
  return { payoutRub, extraMinutes, reputationDelta, notes, payoutNotes };
}
