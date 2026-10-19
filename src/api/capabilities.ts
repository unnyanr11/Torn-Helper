import { Capability } from "./types";
import registry from "./generated-capabilities.json";
export const CAPABILITIES = registry.capabilities as Capability[];

export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

export function capabilitiesForFeature(feature: string): Capability[] {
  return CAPABILITIES.filter((c) => c.features.includes(feature));
}
