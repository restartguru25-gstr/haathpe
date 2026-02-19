import { describe, it, expect } from "vitest";
import { normalizePhoneDigits, toE164Indian } from "./phoneUtils";

describe("phoneUtils", () => {
  describe("normalizePhoneDigits", () => {
    it("strips non-digits and limits to 10", () => {
      expect(normalizePhoneDigits("7416925695")).toBe("7416925695");
      expect(normalizePhoneDigits("741 692 5695")).toBe("7416925695");
      expect(normalizePhoneDigits("74169256951234")).toBe("7416925695");
    });

    it("removes leading 91", () => {
      expect(normalizePhoneDigits("917416925695")).toBe("7416925695");
      expect(normalizePhoneDigits("91 7416925695")).toBe("7416925695");
    });

    it("removes leading 0", () => {
      expect(normalizePhoneDigits("07416925695")).toBe("7416925695");
    });

    it("allows backspace (shortens string)", () => {
      expect(normalizePhoneDigits("741692569")).toBe("741692569");
      expect(normalizePhoneDigits("74169256")).toBe("74169256");
      expect(normalizePhoneDigits("")).toBe("");
    });

    it("no double 91 in value", () => {
      expect(normalizePhoneDigits("91917416925695")).toBe("7416925695");
    });
  });

  describe("toE164Indian", () => {
    it("returns +91 + 10 digits when length is 10", () => {
      expect(toE164Indian("7416925695")).toBe("+917416925695");
    });

    it("returns empty when not 10 digits", () => {
      expect(toE164Indian("741692569")).toBe("");
      expect(toE164Indian("")).toBe("");
    });
  });
});
