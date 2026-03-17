import { useCallback, useState } from "react";
import { auth } from "@/lib/firebase";
import { tenantConfig } from "@/lib/whitelabel";

interface RazorpaySuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayFailureResponse {
    error: {
        code: string;
        description: string;
        source: string;
        step: string;
        reason: string;
        metadata: {
            order_id: string;
            payment_id: string;
        };
    };
}

export interface RazorpayOptions {
    key: string;
    amount: string;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

// Extend window interface
declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => {
            on: (event: string, handler: (response: RazorpayFailureResponse) => void) => void;
            open: () => void;
        };
    }
}

export function useRazorpay() {
    const [isScriptLoading, setIsScriptLoading] = useState(false);

    const loadRazorpayScript = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }

            setIsScriptLoading(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => {
                setIsScriptLoading(false);
                resolve(true);
            };
            script.onerror = () => {
                setIsScriptLoading(false);
                resolve(false);
            };
            document.body.appendChild(script);
        });
    }, []);

    const checkout = useCallback(
        async (
            planId: string,
            orgId: string,
            email: string,
            currency: "INR" | "USD" = "INR",
            onSuccess?: () => void,
            onFailure?: (error: unknown) => void
        ) => {
            try {
                const res = await loadRazorpayScript();
                if (!res) {
                    throw new Error("Razorpay SDK failed to load. Are you online?");
                }

                // Get Auth Token
                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error("User not authenticated.");

                // 1. Create order on backend
                const orderResponse = await fetch("/api/payments/create-order", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        orgId,
                        planId,
                        currency,
                        customerEmail: email,
                    }),
                });

                if (!orderResponse.ok) {
                    const err = await orderResponse.json();
                    throw new Error(err.detail || "Failed to create order");
                }

                const orderData = await orderResponse.json();

                // 2. Open Razorpay Widget
                let settled = false;
                const finalizeFailure = (err: unknown) => {
                    if (settled) return;
                    settled = true;
                    if (onFailure) onFailure(err);
                };
                const finalizeSuccess = () => {
                    if (settled) return;
                    settled = true;
                    if (onSuccess) onSuccess();
                };
                const timeoutId = typeof window !== "undefined"
                    ? window.setTimeout(() => finalizeFailure(new Error("Payment timed out.")), 180000)
                    : null;

                const clearTimeoutSafe = () => {
                    if (timeoutId) window.clearTimeout(timeoutId);
                };

                const options: RazorpayOptions = {
                    key: orderData.keyId,
                    amount: orderData.amount.toString(),
                    currency: orderData.currency,
                    name: tenantConfig.brandName,
                    description: orderData.description,
                    order_id: orderData.orderId,
                    handler: async function (response: RazorpaySuccessResponse) {
                        try {
                            // 3. Verify payment on backend
                            const verifyResponse = await fetch("/api/payments/verify", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature,
                                    orgId: orgId,
                                }),
                            });

                            if (!verifyResponse.ok) {
                                throw new Error("Payment verification failed");
                            }

                            clearTimeoutSafe();
                            finalizeSuccess();
                        } catch (err) {
                            console.error(err);
                            clearTimeoutSafe();
                            finalizeFailure(err);
                        }
                    },
                    prefill: {
                        email: email,
                    },
                    theme: {
                        color: tenantConfig.colorPrimary || "#4f46e5",
                    },
                    modal: {
                        ondismiss: () => {
                            clearTimeoutSafe();
                            finalizeFailure(new Error("Payment cancelled by user."));
                        },
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.on("payment.failed", function (response: RazorpayFailureResponse) {
                    clearTimeoutSafe();
                    finalizeFailure(response.error);
                });
                rzp.open();
            } catch (error) {
                console.error(error);
                if (onFailure) onFailure(error);
            }
        },
        [loadRazorpayScript]
    );

    return { checkout, isScriptLoading };
}
