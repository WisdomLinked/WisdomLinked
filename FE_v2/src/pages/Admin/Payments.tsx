import { useState, useEffect, useCallback } from "react";
import { paymentAdminApi, AdminPayment } from "@/api/paymentApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DollarSign, RefreshCw, CreditCard } from "lucide-react";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  totalRevenueCents: number;
  refunded: number;
}

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function AdminPayments() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    total: 0,
    totalRevenueCents: 0,
    refunded: 0,
  });
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await paymentAdminApi.getAllPayments(
        pagination.page,
        pagination.limit,
        { status: statusFilter || undefined },
      );
      setPayments(response.payments);
      setPagination((p) => ({
        ...p,
        total: response.total,
        totalPages: response.totalPages,
      }));
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.page, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const [allResult, refundedResult, succeededResult] = await Promise.all([
        paymentAdminApi.getAllPayments(1, 1),
        paymentAdminApi.getAllPayments(1, 1, { status: "refunded" }),
        paymentAdminApi.getAllPayments(1, 500, { status: "succeeded" }),
      ]);
      const revenueCents = succeededResult.payments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      setStats({
        total: allResult.total,
        refunded: refundedResult.total,
        totalRevenueCents: revenueCents,
      });
    } catch (error) {
      console.error("Failed to fetch payment stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefund = async (payment: AdminPayment) => {
    try {
      await paymentAdminApi.refundPayment(payment.stripePaymentIntentId);
      setRefundingId(null);
      fetchPayments();
      fetchStats();
      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Payment refunded successfully",
        });
      }
    } catch (error) {
      console.error("Failed to refund payment:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Management</h1>
        <p className="text-muted-foreground mt-1">
          View and manage payment transactions
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Total Payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(stats.totalRevenueCents / 100)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refunded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.refunded}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="">All Status</option>
            <option value="succeeded">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payments ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">
                          {formatAmount(payment.amount, payment.currency)}
                        </p>
                        <span
                          className={`px-2 py-0.5 text-xs rounded shrink-0 ${
                            payment.status === "succeeded"
                              ? "bg-green-500/10 text-green-500"
                              : payment.status === "refunded"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {payment.status}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary shrink-0">
                          {payment.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {payment.description}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>User: {payment.userId}</span>
                        <span>
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {payment.status === "succeeded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRefundingId(payment.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refund
                      </Button>
                    )}
                  </div>

                  {refundingId === payment.id && (
                    <div className="mt-3 p-3 border rounded bg-yellow-500/5 border-yellow-500/20">
                      <p className="text-sm font-medium mb-2">
                        Confirm refund of{" "}
                        {formatAmount(payment.amount, payment.currency)}?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRefund(payment)}
                        >
                          Confirm Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRefundingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {payments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No payments found
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
