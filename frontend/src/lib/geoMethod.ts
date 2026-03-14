"use client";

export function describeGeoMethod(method?: string): string {
  switch (method) {
    case "blended-structural-and-manifest-alignment":
    case "alignment_blended":
      return "Structural + manifest alignment";
    case "structural-readiness":
      return "Structural readiness only";
    default:
      return method || "Not available";
  }
}
