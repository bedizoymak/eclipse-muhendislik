import { describe, it, expect } from "vitest";
import { isValidParasutId } from "@/lib/parasutId";

// Phase 13.6: unit tests for the shared route-ID guard used by
// ParasutIdRoute.tsx across every `/:parasutId`-style demo detail route.
describe("isValidParasutId", () => {
  it("accepts a simple positive integer string", () => {
    expect(isValidParasutId("1")).toBe(true);
  });

  it("accepts a real long Parasut ID string (kept as string, no precision loss)", () => {
    expect(isValidParasutId("19281928192819281")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidParasutId("0")).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(isValidParasutId("-1")).toBe(false);
  });

  it("rejects decimals", () => {
    expect(isValidParasutId("1.5")).toBe(false);
  });

  it("rejects a trailing-alpha partial match (parseInt would accept this)", () => {
    expect(isValidParasutId("123abc")).toBe(false);
  });

  it("rejects a leading-alpha value", () => {
    expect(isValidParasutId("abc123")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidParasutId("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidParasutId("   ")).toBe(false);
  });

  it("rejects whitespace-padded numeric string", () => {
    expect(isValidParasutId(" 123 ")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidParasutId(undefined)).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidParasutId(null)).toBe(false);
  });

  it("rejects a leading-zero numeric string", () => {
    expect(isValidParasutId("007")).toBe(false);
  });

  it("rejects the known malformed-request-triggering static segments", () => {
    expect(isValidParasutId("etiketler")).toBe(false);
    expect(isValidParasutId("kategoriler")).toBe(false);
  });
});
