import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePaymentNotification } from "@/contexts/PaymentNotificationContext";
import type { VoiceLang } from "@/lib/paymentNotification";

const NOTIFIED_IDS_MAX = 100;

export interface UsePaidOrderNotificationOptions {
  vendorId: string | null;
  voiceLang: VoiceLang;
  vendorPhone?: string | null;
  sendWhatsApp?: boolean;
  /** When false (e.g. shop closed), do not trigger popup/sound/vibration/voice. */
  alertsEnabled?: boolean;
  alertVolume?: "low" | "medium" | "high" | null;
}

/**
 * Subscribe to customer_orders for this vendor. On INSERT or UPDATE when status is 'paid',
 * trigger the payment success popup, sound, vibration, voice, and optional WhatsApp.
 */
interface OrderItemRow {
  item_name?: string;
  qty?: number;
}

export function usePaidOrderNotification(options: UsePaidOrderNotificationOptions): void {
  const {
    vendorId,
    voiceLang,
    vendorPhone,
    sendWhatsApp = false,
    alertsEnabled = true,
    alertVolume = null,
  } = options;
  const { triggerPaymentReceived, triggerOrderReceived } = usePaymentNotification();
  const notifiedIds = useRef<Set<string>>(new Set());
  const notifiedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`paid-orders-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          if (!alertsEnabled) return;
          const row = payload.new as {
            id: string;
            status?: string;
            total?: number;
            items?: OrderItemRow[];
          };
          if (!row?.id) return;
          const amount = Number(row.total ?? 0);
          const orderItems = Array.isArray(row.items)
            ? row.items.map((it) => ({ item_name: it?.item_name ?? "item", qty: Number(it?.qty) || 1 }))
            : null;
          if (row.status === "paid") {
            if (notifiedIds.current.has(row.id)) return;
            notifiedIds.current.add(row.id);
            if (notifiedIds.current.size > NOTIFIED_IDS_MAX) {
              const first = notifiedIds.current.values().next().value;
              if (first) notifiedIds.current.delete(first);
            }
            triggerPaymentReceived({
              amount,
              orderId: row.id,
              voiceLang,
              vendorPhone,
              sendWhatsApp,
              alertVolume,
              orderItems: orderItems ?? undefined,
            });
          } else {
            if (notifiedOrderIds.current.has(row.id)) return;
            notifiedOrderIds.current.add(row.id);
            if (notifiedOrderIds.current.size > NOTIFIED_IDS_MAX) {
              const first = notifiedOrderIds.current.values().next().value;
              if (first) notifiedOrderIds.current.delete(first);
            }
            triggerOrderReceived?.({
              amount,
              orderId: row.id,
              voiceLang,
              alertVolume,
              orderItems: orderItems ?? undefined,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customer_orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          try {
            if (!alertsEnabled) return;
            const row = payload.new as {
              id: string;
              status?: string;
              total?: number;
              items?: OrderItemRow[];
            };
            const old = payload.old as { status?: string } | undefined;
            if (row?.status === "paid" && old?.status !== "paid" && row?.id) {
              if (notifiedIds.current.has(row.id)) return;
              notifiedIds.current.add(row.id);
              if (notifiedIds.current.size > NOTIFIED_IDS_MAX) {
                const first = notifiedIds.current.values().next().value;
                if (first) notifiedIds.current.delete(first);
              }
              const amount = Number(row.total ?? 0);
              const orderItems = Array.isArray(row.items)
                ? row.items.map((it) => ({ item_name: it?.item_name ?? "item", qty: Number(it?.qty) || 1 }))
                : null;
              triggerPaymentReceived({
                amount,
                orderId: row.id,
                voiceLang,
                vendorPhone,
                sendWhatsApp,
                alertVolume,
                orderItems: orderItems ?? undefined,
              });
            }
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") console.error(e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [vendorId, voiceLang, vendorPhone, sendWhatsApp, alertsEnabled, alertVolume, triggerPaymentReceived, triggerOrderReceived]);
}
