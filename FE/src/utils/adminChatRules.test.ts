import { describe, expect, it } from "vitest";
import { canAdminInitiateDmWithRole } from "./adminChatRules";

describe("adminChatRules", () => {
  it("allows admin-initiated DM only for experts", () => {
    expect(canAdminInitiateDmWithRole("expert")).toBe(true);
    expect(canAdminInitiateDmWithRole("EXPERT")).toBe(true);
  });

  it("blocks admin-initiated DM for non-expert roles", () => {
    expect(canAdminInitiateDmWithRole("customer")).toBe(false);
    expect(canAdminInitiateDmWithRole("admin")).toBe(false);
    expect(canAdminInitiateDmWithRole("")).toBe(false);
  });
});

