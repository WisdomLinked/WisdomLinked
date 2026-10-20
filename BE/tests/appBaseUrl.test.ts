import test from "node:test";
import assert from "node:assert/strict";
import {
    resolveAppBaseUrl,
    appAssetUrl,
    expertRequestReviewUrl,
    seminarStudentDashboardUrl,
    seminarExpertDashboardUrl,
} from "../utils/appBaseUrl";

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

test("the review-request link opens the expert dashboard on that request", () => {
    assert.equal(
        expertRequestReviewUrl("abc123", { FE_URL: "https://staging.wisdomlinked.com/" }),
        "https://staging.wisdomlinked.com/user/expertdashboard?review_request=abc123",
    );
    assert.equal(
        new URL(expertRequestReviewUrl("a b&c", {})).searchParams.get("review_request"),
        "a b&c",
    );
});

test("seminar waitlist offer link deep-links to the student dashboard seminar", () => {
    assert.equal(
        seminarStudentDashboardUrl("sem-7", { FE_URL: "https://staging.wisdomlinked.com/" }),
        "https://staging.wisdomlinked.com/user/studentdashboard?seminar=sem-7",
    );
    assert.equal(
        new URL(seminarStudentDashboardUrl("a&b", {})).searchParams.get("seminar"),
        "a&b",
    );
});

test("expert waitlist notification CTA lands on the expert dashboard", () => {
    assert.equal(
        seminarExpertDashboardUrl({ FE_URL: "https://staging.wisdomlinked.com/" }),
        "https://staging.wisdomlinked.com/user/expertdashboard",
    );
});
