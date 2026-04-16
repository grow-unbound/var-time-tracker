import { describe, expect, test } from "vitest";

import {
  createActivityLookupKey,
  createBatteryLookupKey,
  createLotLookupKey,
  parseSeedDate,
  toStageValue,
} from "./seed-helpers";

describe("seed helpers", () => {
  test("creates stable lookup keys for related entities", () => {
    expect(createActivityLookupKey("Production", "Lid Assembly")).toBe(
      "production::lid assembly",
    );
    expect(createBatteryLookupKey("VEDA", "PMBTT-1V")).toBe(
      "veda::pmbtt-1v",
    );
    expect(createLotLookupKey("VEDA", "PMBTT-1V", "Lot 1")).toBe(
      "veda::pmbtt-1v::lot 1",
    );
  });

  test("parses seed dates at UTC midnight", () => {
    expect(parseSeedDate("2025-04-16").toISOString()).toBe(
      "2025-04-16T00:00:00.000Z",
    );
  });

  test("maps stage labels to prisma enum values", () => {
    expect(toStageValue("R&D")).toBe("RnD");
    expect(toStageValue("Production")).toBe("Production");
  });
});
