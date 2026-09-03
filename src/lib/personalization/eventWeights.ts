import type { PersonalizationEventType } from "./types";

export const personalizationEventWeights: Record<
  PersonalizationEventType,
  number
> = {
  search: 0.5,
  impression: 0.1,
  view: 1,
  compare: 1.5,
  add_to_cart: 3,
  remove_from_cart: -1,
  purchase: 5,
};

export function isPersonalizationEventType(
  value: unknown,
): value is PersonalizationEventType {
  return (
    typeof value === "string" &&
    Object.hasOwn(personalizationEventWeights, value)
  );
}

