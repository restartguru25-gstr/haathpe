import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import PaymentSuccessPopup from "@/components/PaymentSuccessPopup";
import {
  triggerPaymentNotification,
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

interface PaymentNotificationContextValue {
  triggerPaymentReceived: (params: TriggerPaymentReceivedParams) => void;
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
  const [popup, setPopup] = useState<{ amount: number } | null>(null);
  const [lastVoice, setLastVoice] = useState<{
    voiceLang: VoiceLang;
    amount: number;
    orderItems: OrderItemForVoice[] | null;
  } | null>(null);
  const notifiedIds = useRef<Set<string>>(new Set());

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
    setPopup({ amount: params.amount });
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
        replayVoice,
        lastVoice,
      }}
    >
      {children}
      <PaymentSuccessPopup
        visible={!!popup}
        amount={popup?.amount ?? 0}
        onClose={closePopup}
        onReplayVoice={replayVoice}
        canReplayVoice={!!lastVoice}
      />
    </PaymentNotificationContext.Provider>
  );
}
