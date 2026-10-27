import { describe, expect, it } from "vitest";
import { formatMetaChanges, formatMetaValue, metaSummary } from "./auditLogMeta";

describe("metaSummary — entries written before this change read as they did", () => {
    it("keeps status, stripe mode, role and impersonation rows unchanged", () => {
        expect(metaSummary({ from: "review", to: "active", role: "customer" })).toBe(
            "from=review; to=active; role=customer",
        );
        expect(metaSummary({ from: "live", to: "test" })).toBe("from=live; to=test");
        expect(metaSummary({ role: "expert", username: "ada" })).toBe("role=expert");
        expect(metaSummary({ targetRole: "expert", targetUsername: "Ada" })).toBe("targetRole=expert");
    });

    it("keeps list values joined with commas", () => {
        expect(metaSummary({ target: "Physics", sources: ["Phys", "physics"], usersUpdated: 3 })).toBe(
            "target=Physics; sources=Phys, physics",
        );
    });

    it("falls back to the first three keys when none is preferred", () => {
        expect(metaSummary({ name: "Ada", direction: "up", a: 1, b: 2 })).toBe("name=Ada; direction=up; a=1");
        expect(metaSummary({ actioned: true })).toBe("actioned=true");
    });

    it("shows a dash for empty meta", () => {
        expect(metaSummary(undefined)).toBe("—");
        expect(metaSummary({})).toBe("—");
    });
});

describe("metaSummary — values with several parts no longer read [object Object]", () => {
    it("spells out old pricing rows", () => {
        const text = metaSummary({
            seminar: { expertCommissionPercent: 20, studentFeePercent: 3, cancellationRefund: "full" },
            oneToOne: { expertCommissionPercent: 15 },
        });
        expect(text).toBe(
            "seminar=expertCommissionPercent: 20, studentFeePercent: 3, cancellationRefund: full; oneToOne=expertCommissionPercent: 15",
        );
        expect(text).not.toContain("[object Object]");
    });

    it("spells out announcement rows", () => {
        expect(metaSummary({ from: { id: "a1", active: true }, to: { id: "a2", active: false } })).toBe(
            "from=id: a1, active: true; to=id: a2, active: false",
        );
    });
});

describe("metaSummary — new entries", () => {
    it("shows each change as old → new", () => {
        expect(
            metaSummary({
                role: "expert",
                changes: { city: { from: "Austin", to: "Dallas" }, price: { from: [25], to: [40] } },
            }),
        ).toBe("role=expert; city: Austin → Dallas; price: 25 → 40");
    });

    it("shows pricing changes with their dotted names", () => {
        expect(metaSummary({ changes: { "seminar.expertCommissionPercent": { from: 20, to: 25 } } })).toBe(
            "seminar.expertCommissionPercent: 20 → 25",
        );
        expect(metaSummary({ changes: {} })).toBe("no changes");
    });

    it("shows an unset value as a dash", () => {
        expect(metaSummary({ changes: { specialNote: { from: null, to: "Paid offline" } } })).toBe(
            "specialNote: — → Paid offline",
        );
    });

    it("shows payroll, payment link, settings and terms entries in full", () => {
        expect(
            metaSummary({ month: "2026-10", amount: "8.00 USD", chequeNumber: "1001", chequeDate: "2026-10-31" }),
        ).toBe("amount=8.00 USD; month=2026-10; chequeNumber=1001; chequeDate=2026-10-31");
        expect(metaSummary({ month: "2026-10", changes: { chequeNumber: { from: "1001", to: "2002" } } })).toBe(
            "month=2026-10; chequeNumber: 1001 → 2002",
        );
        expect(
            metaSummary({ amount: "40.00 USD", description: "Seminar seat", originalPayment: "ph1", stripeMode: "live" }),
        ).toBe("amount=40.00 USD; description=Seminar seat; originalPayment=ph1; stripeMode=live");
        expect(metaSummary({ from: 24, to: 36 })).toBe("from=24; to=36");
        expect(metaSummary({ audience: "shared", version: 3, file: "terms.docx" })).toBe(
            "audience=shared; version=3; file=terms.docx",
        );
    });
});

describe("formatMetaValue / formatMetaChanges", () => {
    it("formats plain, empty, list and nested values", () => {
        expect(formatMetaValue("x")).toBe("x");
        expect(formatMetaValue(0)).toBe("0");
        expect(formatMetaValue(false)).toBe("false");
        expect(formatMetaValue(null)).toBe("—");
        expect(formatMetaValue("")).toBe("—");
        expect(formatMetaValue([])).toBe("—");
        expect(formatMetaValue(["a", null, "b"])).toBe("a, b");
        expect(formatMetaValue({ a: 1, b: null })).toBe("a: 1");
        expect(formatMetaValue({ a: { b: 2 } })).toBe("a: b: 2");
    });

    it("copes with a malformed changes value", () => {
        expect(formatMetaChanges("odd")).toBe("odd");
        expect(formatMetaChanges({ city: null })).toBe("city: — → —");
    });
});
