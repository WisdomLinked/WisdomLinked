import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PaymentReceipt, {
  formatMoney,
  formatSessionMeta,
  formatPaymentMethod,
  moneyLabels,
} from "./PaymentReceipt";
import * as api from "../api/api";

vi.mock("../api/api");
vi.mock("react-router-dom", () => ({
  useParams: () => ({ paymentId: "pay-1" }),
}));

const receipt = {
  id: "pay-1",
  receiptNumber: "2381-4472",
  status: "completed",
  amount: 10000,
  currency: "usd",
  paidAt: "2026-06-22T03:47:00.000Z",
  description: 'Research Methods & Grad School Guidance — Dr. Bruce Wang',
  paymentMethod: "Credit card",
  card: { brand: "visa", last4: "4242" },
  transactionId: "pi_1",
  balanceTransaction: "txn_1",
  stripeReceiptUrl: "https://pay.stripe.com/receipts/payment/abc",
  session: {
    name: "Research Methods & Grad School Guidance",
    typeLabel: "1:1 Session",
    durationMinutes: 45,
    start: "2026-07-24T16:00:00.000Z",
    timezone: "UTC",
  },
  expert: { name: "Dr. Bruce Wang", title: "Professor of Molecular Biology" },
  student: { name: "Araavind", email: "araavind@student.edu" },
};

describe("receipt formatting", () => {
  it("renders money to two decimals, naming a non-USD currency", () => {
    expect(formatMoney(10000)).toBe("$100.00");
    expect(formatMoney(4900, "usd")).toBe("$49.00");
    expect(formatMoney(4900, "eur")).toBe("$49.00 EUR");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("drops either half of the session meta line when it is missing", () => {
    expect(formatSessionMeta("1:1 Session", 45)).toBe("1:1 Session · 45 min");
    expect(formatSessionMeta("Seminar", null)).toBe("Seminar");
    expect(formatSessionMeta("", 90)).toBe("90 min");
    expect(formatSessionMeta("", null)).toBe("");
  });

  it("shows the card brand when we have it and the coarse label when we do not", () => {
    expect(formatPaymentMethod({ brand: "visa", last4: "4242" })).toEqual({
      primary: "VISA",
      secondary: "· 4242",
    });
    expect(formatPaymentMethod(null, "WeChat Pay")).toEqual({ primary: "WeChat Pay", secondary: "" });
    expect(formatPaymentMethod(null, "")).toEqual({ primary: "—", secondary: "" });
  });

  it("only calls money paid when it was actually paid", () => {
    expect(moneyLabels("completed")).toEqual({ amount: "Amount paid", date: "Date paid" });

    for (const status of ["refunded", "released", "withheld", "failed", "pending"]) {
      const labels = moneyLabels(status);
      expect(labels.amount, `${status} must not claim payment`).not.toMatch(/paid/i);
      expect(labels.date, `${status} must not claim payment`).not.toMatch(/paid/i);
    }

    expect(moneyLabels("released").amount).toBe("Amount authorized");
    expect(moneyLabels("refunded").amount).toBe("Amount refunded");
    expect(moneyLabels("refunded", "refund")).toEqual({
      amount: "Amount refunded",
      date: "Date refunded",
    });
    expect(moneyLabels("refunded", "charge").date).toBe("Date charged");
    expect(moneyLabels(undefined)).toEqual({ amount: "Amount", date: "Date" });
    expect(moneyLabels("something-new")).toEqual({ amount: "Amount", date: "Date" });
  });
});

describe("PaymentReceipt page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the session, the people and the amount", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({ success: true, receipt } as any);

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Payment Receipt")).toBeInTheDocument());
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Research Methods & Grad School Guidance")).toBeInTheDocument();
    expect(screen.getByText("Dr. Bruce Wang")).toBeInTheDocument();
    expect(screen.getByText("Professor of Molecular Biology")).toBeInTheDocument();
    expect(screen.getByText("Araavind")).toBeInTheDocument();
    expect(screen.getByText("VISA")).toBeInTheDocument();
    expect(screen.getByText("Receipt no. 2381-4472")).toBeInTheDocument();
  });

  it("never prints the raw Stripe URL as text", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({ success: true, receipt } as any);

    const { container } = render(<PaymentReceipt />);
    await waitFor(() => expect(screen.getByText("Payment Receipt")).toBeInTheDocument());

    expect(container.textContent).not.toContain("pay.stripe.com");
    expect(screen.getByRole("link", { name: /official stripe receipt/i })).toHaveAttribute(
      "href",
      receipt.stripeReceiptUrl,
    );
  });

  it("says a refunded payment was refunded rather than reading as a clean receipt", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({
      success: true,
      receipt: { ...receipt, status: "refunded" },
    } as any);

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Refunded.")).toBeInTheDocument());
    expect(screen.getByText(/This payment has been refunded/i)).toBeInTheDocument();
  });

  it("explains itself when the receipt cannot be loaded", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue(
      "This receipt belongs to someone else." as any,
    );

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Receipt unavailable")).toBeInTheDocument());
    expect(screen.getByText("This receipt belongs to someone else.")).toBeInTheDocument();
  });

  it("a released authorization is not presented as money paid", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({
      success: true,
      receipt: { ...receipt, status: "released" },
    } as any);

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Amount authorized")).toBeInTheDocument());
    expect(screen.getByText("Date authorized")).toBeInTheDocument();
    expect(screen.queryByText("Amount paid")).not.toBeInTheDocument();
    expect(screen.queryByText("Date paid")).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/i)).toBeInTheDocument();
  });

  it("a refunded payment names the charge, not a payment", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({
      success: true,
      receipt: { ...receipt, status: "refunded" },
    } as any);

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Amount refunded")).toBeInTheDocument());
    expect(screen.queryByText("Amount paid")).not.toBeInTheDocument();
    expect(screen.getByText(/refunded in full/i)).toBeInTheDocument();
  });

  it("still renders when the expert has no title and the card is unknown", async () => {
    vi.mocked(api.getPaymentReceipt).mockResolvedValue({
      success: true,
      receipt: {
        ...receipt,
        card: null,
        paymentMethod: "Alipay",
        expert: { name: "Dr. Bruce Wang", title: "" },
      },
    } as any);

    render(<PaymentReceipt />);

    await waitFor(() => expect(screen.getByText("Alipay")).toBeInTheDocument());
    expect(screen.queryByText("Professor of Molecular Biology")).not.toBeInTheDocument();
  });
});
