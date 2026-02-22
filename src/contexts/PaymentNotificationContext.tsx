import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import PaymentSuccessPopup from "@/components/PaymentSuccessPopup";
import {
  triggerPaymentNotification,
  triggerOrderNotification,
  speakOrderSummary,
  speakPaymentReceived,
  type VoiceLang,
  type OrderItemForVoice,
} from "@/lib/paymentNotification";

const DEDUPE_MAX = 100;

export interface TriggerPaymentReceivedParams {
  amount: number;
  orderId: string;
  voiceLang: VoiceLang;
  vendorPhone?: string | null;
  sendWhatsApp?: boolean;
  alertVolume?: "low" | "medium" | "high" | null;
  orderItems?: OrderItemForVoice[] | null;
}

export interface TriggerOrderReceivedParams {
  amount: number;
  orderId: string;
  voiceLang: VoiceLang;
  alertVolume?: "low" | "medium" | "high" | null;
  orderItems?: OrderItemForVoice[] | null;
}

interface PaymentNotificationContextValue {
  triggerPaymentReceived: (params: TriggerPaymentReceivedParams) => void;
  triggerOrderReceived: (params: TriggerOrderReceivedParams) => void;
  replayVoice: () => void;
  lastVoice: { voiceLang: VoiceLang; amount: number; orderItems: OrderItemForVoice[] | null } | null;
}

const PaymentNotificationContext = createContext<PaymentNotificationContextValue | null>(null);

export function usePaymentNotification() {
  const ctx = useContext(PaymentNotificationContext);
  return ctx;
}

interface PaymentNotificationProviderProps {
  children: React.ReactNode;
}

export function PaymentNotificationProvider({ children }: PaymentNotificationProviderProps) {
  const [popup, setPopup] = useState<{ amount: number; type: "order" | "payment" } | null>(null);
  const [lastVoice, setLastVoice] = useState<{
    voiceLang: VoiceLang;
    amount: number;
    orderItems: OrderItemForVoice[] | null;
  } | null>(null);
  const notifiedIds = useRef<Set<string>>(new Set());
  const notifiedOrderIds = useRef<Set<string>>(new Set());

  const triggerPaymentReceived = useCallback((params: TriggerPaymentReceivedParams) => {
    if (notifiedIds.current.has(params.orderId)) return;
    notifiedIds.current.add(params.orderId);
    if (notifiedIds.current.size > DEDUPE_MAX) {
      const first = notifiedIds.current.values().next().value;
      if (first) notifiedIds.current.delete(first);
    }
    const voice = {
      voiceLang: params.voiceLang,
      amount: params.amount,
      orderItems: params.orderItems ?? null,
    };
    setLastVoice(voice);
    setPopup({ amount: params.amount, type: "payment" });
    triggerPaymentNotification({
      amount: params.amount,
      orderId: params.orderId,
      voiceLang: params.voiceLang,
      vendorPhone: params.vendorPhone,
      sendWhatsApp: params.sendWhatsApp ?? false,
      alertVolume: params.alertVolume,
      orderItems: params.orderItems,
    });
  }, []);

  const triggerOrderReceived = useCallback((params: TriggerOrderReceivedParams) => {
    if (notifiedOrderIds.current.has(params.orderId)) return;
    notifiedOrderIds.current.add(params.orderId);
    if (notifiedOrderIds.current.size > DEDUPE_MAX) {
      const first = notifiedOrderIds.current.values().next().value;
      if (first) notifiedOrderIds.current.delete(first);
    }
    const voice = {
      voiceLang: params.voiceLang,
      amount: params.amount,
      orderItems: params.orderItems ?? null,
    };
    setLastVoice(voice);
    setPopup({ amount: params.amount, type: "order" });
    triggerOrderNotification({
      amount: params.amount,
      orderId: params.orderId,
      voiceLang: params.voiceLang,
      alertVolume: params.alertVolume,
      orderItems: params.orderItems,
    });
  }, []);

  const replayVoice = useCallback(() => {
    if (!lastVoice) return;
    if (lastVoice.orderItems && lastVoice.orderItems.length > 0) {
      speakOrderSummary(lastVoice.voiceLang, lastVoice.orderItems, lastVoice.amount);
    } else {
      speakPaymentReceived(lastVoice.voiceLang, Math.round(lastVoice.amount));
    }
  }, [lastVoice]);

  const closePopup = useCallback(() => setPopup(null), []);

  return (
    <PaymentNotificationContext.Provider
      value={{
        triggerPaymentReceived,
        triggerOrderReceived,
        replayVoice,
        lastVoice,
      }}
    >
      {children}
      <PaymentSuccessPopup
        visible={!!popup}
        amount={popup?.amount ?? 0}
        title={popup?.type === "order" ? "New Order!" : "Payment Received!"}
        onClose={closePopup}
        onReplayVoice={replayVoice}
        canReplayVoice={!!lastVoice}
      />
    </PaymentNotificationContext.Provider>
  );
}
