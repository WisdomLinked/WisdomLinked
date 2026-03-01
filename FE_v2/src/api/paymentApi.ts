import { apiClient } from "./client";

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  type: "subscription" | "one_time";
  currency: string;
  amount: number;
  interval?: "month" | "year";
  features: string[];
}

export interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface Payment {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: Date;
}

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  enabled: boolean;
}

export const paymentApi = {
  async getPricingPlans(): Promise<{ plans: PricingPlan[] }> {
    const response = await apiClient.get("/api/v1/payment/pricing");
    return response.data;
  },

  async createCheckoutSession(
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    const response = await apiClient.post("/api/v1/payment/checkout", {
      planId,
      successUrl,
      cancelUrl,
    });
    return response.data;
  },

  async getUserSubscription(): Promise<{ subscription: Subscription | null }> {
    const response = await apiClient.get("/api/v1/payment/subscription");
    return response.data;
  },

  async cancelSubscription(): Promise<{
    message: string;
    subscription: { id: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date };
  }> {
    const response = await apiClient.post("/api/v1/payment/subscription/cancel");
    return response.data;
  },

  async getPaymentHistory(): Promise<{ payments: Payment[] }> {
    const response = await apiClient.get("/api/v1/payment/history");
    return response.data;
  },
};

// Admin APIs
export const paymentAdminApi = {
  async getStripeConfig(): Promise<{ config: StripeConfig; plans: PricingPlan[] }> {
    const response = await apiClient.get("/api/v1/payment/config");
    return response.data;
  },

  async updateStripeConfig(config: {
    publishableKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    enabled: boolean;
  }): Promise<{ message: string }> {
    const response = await apiClient.put("/api/v1/payment/config", config);
    return response.data;
  },

  async updatePricingPlans(plans: PricingPlan[]): Promise<{ message: string }> {
    const response = await apiClient.put("/api/v1/payment/plans", { plans });
    return response.data;
  },
};
