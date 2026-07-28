import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppBaseUrl, appAssetUrl } from "../utils/appBaseUrl";

test("prefers FRONTEND_BASE_URL over FE_URL", () => {
    assert.equal(
        resolveAppBaseUrl({ FRONTEND_BASE_URL: "https://staging.wisdomlinked.com", FE_URL: "https://other.example" }),
        "https://staging.wisdomlinked.com",
    );
});

test("falls back to FE_URL and strips trailing slashes", () => {
    assert.equal(resolveAppBaseUrl({ FE_URL: "https://staging.wisdomlinked.com//" }), "https://staging.wisdomlinked.com");
});

test("uses the deployed origin for asset URLs", () => {
    assert.equal(
        appAssetUrl("wisdomlinked-logo.png", { FE_URL: "https://staging.wisdomlinked.com" }),
        "https://staging.wisdomlinked.com/wisdomlinked-logo.png",
    );
    assert.equal(
        appAssetUrl("/wisdomlinked-logo.png", { FE_URL: "https://staging.wisdomlinked.com/" }),
        "https://staging.wisdomlinked.com/wisdomlinked-logo.png",
    );
});

test("keeps a usable base when nothing is configured", () => {
    assert.equal(resolveAppBaseUrl({}), "https://wisdomlinked.com");
});
