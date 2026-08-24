import { describe, expect, it } from "vitest";
import { getNameInitials } from "../lib/avatar-utils";

describe("getNameInitials", () => {
  it("uses the first English letter of every name word", () => {
    expect(getNameInitials("CHAN, KING FUNG")).toBe("CKF");
    expect(getNameInitials("FUNG, CHUN KIT")).toBe("FCK");
  });
});
