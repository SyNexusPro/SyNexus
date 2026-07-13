export type PaidPlan = "PRO";

export type CheckoutPayload = {
  plan?: PaidPlan;
  email?: string;
  userId?: string;
};

export type JsonResponse = {
  statusCode: number;
  body: { url?: string; error?: string };
};
