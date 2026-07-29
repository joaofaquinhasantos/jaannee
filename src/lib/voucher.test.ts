import { describe, expect, it } from "vitest";
import { generateVoucherNumber } from "@/lib/voucher";

describe("voucher security numbers", () => {
  it("formats a non-sequential random identifier", () => {
    expect(generateVoucherNumber("123e4567-e89b-12d3-a456-426614174000"))
      .toBe("JN-123E-4567-E89B");
  });

  it("rejects identifiers with too little entropy", () => {
    expect(() => generateVoucherNumber("1234")).toThrow();
  });
});

