import { describe, expect, it } from "vitest";
import { canAdminInitiateDmWithRole } from "./adminChatRules";

describe("adminChatRules", () => {
  it("allows admin-initiated DM with experts", () => {
    expect(canAdminInitiateDmWithRole("expert")).toBe(true);
    expect(canAdminInitiateDmWithRole("EXPERT")).toBe(true);
  });

  it("allows admin-initiated DM with students", () => {
    expect(canAdminInitiateDmWithRole("customer")).toBe(true);
    expect(canAdminInitiateDmWithRole(" Customer ")).toBe(true);
  });

  it("blocks admin-initiated DM with other admins or unknown roles", () => {
    expect(canAdminInitiateDmWithRole("admin")).toBe(false);
    expect(canAdminInitiateDmWithRole("")).toBe(false);
    expect(canAdminInitiateDmWithRole(undefined)).toBe(false);
    expect(canAdminInitiateDmWithRole(null)).toBe(false);
  });
});
