import { useCallback, useState } from "react";

export interface RazorpayOptions {
    key: string;
    amount: string;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: any) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color?: string;
    };
}

// Extend window interface
declare global {
    interface Window {
        Razorpay: any;
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
            onSuccess?: () => void,
            onFailure?: (error: any) => void
        ) => {
            try {
                const res = await loadRazorpayScript();
                if (!res) {
                    throw new Error("Razorpay SDK failed to load. Are you online?");
                }

                // 1. Create order on backend
                const orderResponse = await fetch("/api/payments/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        orgId,
                        planId,
                        customerEmail: email,
                    }),
                });

                if (!orderResponse.ok) {
                    const err = await orderResponse.json();
                    throw new Error(err.detail || "Failed to create order");
                }

                const orderData = await orderResponse.json();

                // 2. Open Razorpay Widget
                const options: RazorpayOptions = {
                    key: orderData.keyId,
                    amount: orderData.amount.toString(),
                    currency: orderData.currency,
                    name: "AUM Context Foundry",
                    description: orderData.description,
                    order_id: orderData.orderId,
                    handler: async function (response: any) {
                        try {
                            // 3. Verify payment on backend
                            const verifyResponse = await fetch("/api/payments/verify", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
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

                            if (onSuccess) onSuccess();
                        } catch (err) {
                            console.error(err);
                            if (onFailure) onFailure(err);
                        }
                    },
                    prefill: {
                        email: email,
                    },
                    theme: {
                        color: "#4f46e5", // Indigo 600
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.on("payment.failed", function (response: any) {
                    if (onFailure) onFailure(response.error);
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
