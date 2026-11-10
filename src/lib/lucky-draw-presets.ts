import type { Prize } from "./lucky-draw";
export const DRAW_AUDIENCES = [
  {
    id: "all",
    label: "All players / public",
    description: "Open to all signed-in Torn players.",
    items: [
      "Feathery Hotel Coupon",
      "Erotic DVD",
      "Lottery Voucher",
      "ArmaLite M-15A4",
      "Combat Vest",
    ],
  },
  {
    id: "new_players",
    label: "New players (level 1–15)",
    description: "Level 1–15 verified when entering.",
    items: ["Donator Pack", "Xanax", "First Aid Kit", "Morphine", "Points"],
  },
  {
    id: "faction",
    label: "Faction members only",
    description:
      "Your faction is locked at publication; membership is verified when entering.",
    items: [
      "Drug Pack",
      "Box of Medical Supplies",
      "Combat Vest",
      "Can of Munster",
      "Can of Santa Shooters",
      "Vicodin",
    ],
  },
] as const;
export type DrawAudience = (typeof DRAW_AUDIENCES)[number]["id"];
export const PRIZE_SPLITS = [
  { id: "single", label: "Single winner · 75%", percentages: [75] },
  {
    id: "tiered",
    label: "Three winners · 45% / 20% / 10%",
    percentages: [45, 20, 10],
  },
] as const;
export function splitPrizes(id: (typeof PRIZE_SPLITS)[number]["id"]): Prize[] {
  return PRIZE_SPLITS.find((p) => p.id === id)!.percentages.map(
    (percentage) => ({ percentage }),
  );
}
export const audienceLabel = (id: string) =>
  DRAW_AUDIENCES.find((a) => a.id === id)?.label ?? "All players / public";
