import { describe, expect, it } from "vitest";
import { stamp } from "./who.ts";

describe("stamp", () => {
  it("records who and when", () => {
    expect(stamp("Julie", new Date("2030-03-15T12:00:00Z"))).toEqual({ by: "Julie", at: "2030-03-15T12:00:00.000Z" });
  });
});
