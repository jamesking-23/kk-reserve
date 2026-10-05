export type Status = "On Track" | "At Risk" | "Over Budget";
// Same rules as the original app: over if planned > starting or remaining < 0; at risk above 85% of plan.
export const statusOf = (planned: number, start: number, spent: number): Status =>
  planned > start || start - spent < 0 ? "Over Budget" : spent > planned * 0.85 ? "At Risk" : "On Track";
