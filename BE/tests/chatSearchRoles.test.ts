import test from "node:test";
import assert from "node:assert/strict";
import { searchableRolesFor } from "../utils/chatSearchRoles";

test("a student searching only ever gets other students back", () => {
    assert.deepEqual(searchableRolesFor("customer"), ["customer"]);
});

test("an expert keeps the cross-role search", () => {
    assert.deepEqual(searchableRolesFor("expert"), ["expert", "customer"]);
});

test("an admin keeps the cross-role search", () => {
    assert.deepEqual(searchableRolesFor("admin"), ["expert", "customer"]);
});

test("role matching ignores case and surrounding spaces", () => {
    assert.deepEqual(searchableRolesFor("Customer"), ["customer"]);
    assert.deepEqual(searchableRolesFor("  CUSTOMER  "), ["customer"]);
});

test("an unknown or missing role falls back to the original behaviour", () => {
    assert.deepEqual(searchableRolesFor(undefined), ["expert", "customer"]);
    assert.deepEqual(searchableRolesFor(null), ["expert", "customer"]);
    assert.deepEqual(searchableRolesFor(""), ["expert", "customer"]);
    assert.deepEqual(searchableRolesFor("moderator"), ["expert", "customer"]);
});

test("no role can ever search for an admin", () => {
    for (const role of ["customer", "expert", "admin", "", undefined, "moderator"]) {
        assert.ok(!searchableRolesFor(role).includes("admin"), `role ${String(role)} must not find admins`);
    }
});

test("callers cannot mutate the shared role list", () => {
    const first = searchableRolesFor("expert");
    first.push("admin");
    assert.deepEqual(searchableRolesFor("expert"), ["expert", "customer"]);
});
