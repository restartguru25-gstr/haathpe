/**
 * Instant vendor payment notification: sound, vibration, voice (Web Speech API), optional WhatsApp.
 * Supports custom MP3 at /audio/payment-success.mp3 and profile alert volume.
 */

export type VoiceLang = "en" | "hi" | "te";

export type AlertVolume = "low" | "medium" | "high";

const VOLUME_MAP: Record<AlertVolume, number> = { low: 0.3, medium: 0.7, high: 1 };

export function getAlertVolumeMultiplier(alertVolume: AlertVolume | null | undefined): number {
  return alertVolume ? VOLUME_MAP[alertVolume] ?? 0.7 : 0.7;
}

const VOICE_MESSAGES: Record<VoiceLang, (amount: number) => string> = {
  en: (amount) => `New payment received. ${amount} rupees. Thank you!`,
  hi: (amount) => `Naya payment mila. ${amount} rupaye. Shukriya!`,
  te: (amount) => `Kotha payment vachindi. ${amount} rupaayalu. Dhanyavaadham!`,
};

const FALLBACK_MESSAGE = "Payment received. Thank you!";

/** Tiny WAV beep as fallback when MP3 fails (e.g. autoplay blocked). */
const FALLBACK_BEEP_DATA =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Play payment success sound: custom MP3 (volume adjustable), then base64 beep, then Web Audio. */
export function playPaymentSound(volume: number = 1): void {
  const vol = Math.max(0, Math.min(1, volume));
  try {
    const audio = new Audio("/audio/payment-success.mp3");
    audio.volume = vol;
    audio.play().catch((err) => {
      if (import.meta.env.DEV) console.log("Payment sound MP3 failed:", err);
      try {
        const fallback = new Audio(FALLBACK_BEEP_DATA);
        fallback.volume = vol;
        fallback.play().catch(() => playPaymentSoundWebAudio(vol));
      } catch {
        playPaymentSoundWebAudio(vol);
      }
    });
  } catch (e) {
    if (import.meta.env.DEV) console.log("Payment sound error:", e);
    try {
      new Audio(FALLBACK_BEEP_DATA).play().catch(() => playPaymentSoundWebAudio(vol));
    } catch {
      playPaymentSoundWebAudio(vol);
    }
  }
}

function playPaymentSoundWebAudio(volume: number): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const v = 0.15 * volume;
      gain.gain.setValueAtTime(v, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    playTone(880, 0, 0.08);
    playTone(1320, 0.1, 0.12);
  } catch {
    // ignore
  }
}

/** Vibrate for ~1s (pattern: strong then short pause). */
export function vibratePayment(): void {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 80, 200, 80, 200]);
    }
  } catch {
    // ignore
  }
}

/** Speak payment message in vendor's preferred language (Web Speech API). */
export function speakPaymentReceived(lang: VoiceLang, amount: number): void {
  try {
    if (!("speechSynthesis" in window)) return;
    const msg = VOICE_MESSAGES[lang]?.(amount) ?? VOICE_MESSAGES.en(amount);
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : "en-IN";
    u.rate = 0.9;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    try {
      const u = new SpeechSynthesisUtterance(FALLBACK_MESSAGE);
      u.lang = "en-IN";
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }
}

export interface OrderItemForVoice {
  item_name: string;
  qty: number;
}

const NUM_WORDS_HI: Record<number, string> = {
  1: "ek", 2: "do", 3: "teen", 4: "chaar", 5: "paanch", 6: "chhe", 7: "saat", 8: "aath", 9: "nau", 10: "das",
};
const NUM_WORDS_TE: Record<number, string> = {
  1: "okati", 2: "rendu", 3: "moodu", 4: "naalugu", 5: "aidu", 6: "aaru", 7: "eedu", 8: "enimidi", 9: "tommidi", 10: "padi",
};

function numberWord(lang: VoiceLang, n: number): string {
  if (lang === "hi" && n <= 10) return NUM_WORDS_HI[n] ?? String(n);
  if (lang === "te" && n <= 10) return NUM_WORDS_TE[n] ?? String(n);
  return String(n);
}

/** Build order summary phrase for voice, e.g. "2 pani puri, 1 masala soda" or "do pani puri aur ek masala soda". */
function orderSummaryPhrase(lang: VoiceLang, items: OrderItemForVoice[]): string {
  if (!items.length) return "";
  const parts = items.map((it) => {
    const q = numberWord(lang, it.qty);
    const name = (it.item_name || "item").trim();
    if (lang === "hi") return `${q} ${name}`;
    if (lang === "te") return `${q} ${name}`;
    return `${it.qty} ${name}`;
  });
  if (lang === "hi") return parts.join(" aur ");
  if (lang === "te") return parts.join(" mariyu ");
  return parts.join(", ");
}

const ORDER_SUMMARY_VOICE: Record<VoiceLang, (itemsPhrase: string, total: number) => string> = {
  en: (itemsPhrase, total) =>
    itemsPhrase ? `New order. ${itemsPhrase}. Total ${total} rupees. Thank you!` : `New order. Total ${total} rupees. Thank you!`,
  hi: (itemsPhrase, total) =>
    itemsPhrase ? `Naya order. ${itemsPhrase}. Total ${total} rupaye. Shukriya!` : `Naya order. Total ${total} rupaye. Shukriya!`,
  te: (itemsPhrase, total) =>
    itemsPhrase ? `Kotha order. ${itemsPhrase}. Total ${total} rupaayalu. Dhanyavaadham!` : `Kotha order. Total ${total} rupaayalu. Dhanyavaadham!`,
};

/** Speak order summary in vendor language: "Naya order... do pani puri aur ek masala soda... total 150 rupaye". */
export function speakOrderSummary(
  lang: VoiceLang,
  items: OrderItemForVoice[],
  total: number
): void {
  try {
    if (!("speechSynthesis" in window)) return;
    const itemsPhrase = orderSummaryPhrase(lang, items);
    const msg = ORDER_SUMMARY_VOICE[lang]?.(itemsPhrase, Math.round(total)) ?? ORDER_SUMMARY_VOICE.en(itemsPhrase, Math.round(total));
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : "en-IN";
    u.rate = 0.85;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    speakPaymentReceived(lang, Math.round(total));
  }
}

/** Get fallback text for unsupported speech (e.g. for screen readers or display). */
export function getPaymentVoiceFallbackText(lang: VoiceLang, amount: number): string {
  return VOICE_MESSAGES[lang]?.(amount) ?? VOICE_MESSAGES.en(amount);
}

/** Optional: send WhatsApp message to vendor. Requires VITE_WHATSAPP_API_KEY (or similar) and API. Stub only. */
export async function sendWhatsAppPaymentAlert(
  vendorPhone: string,
  amount: number,
  orderId: string
): Promise<void> {
  const apiKey = import.meta.env.VITE_WHATSAPP_API_KEY;
  if (!apiKey || !vendorPhone) return;
  const message = `haathpe: New payment ₹${amount} – Order #${orderId.slice(0, 8)}`;
  try {
    // Stub: replace with your WhatsApp Business API / Twilio / etc.
    await fetch("https://api.whatsapp.com/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ phone: vendorPhone.replace(/\D/g, ""), message }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** Run all payment notifications (sound, vibration, voice). Call from UI after showing popup. */
export function triggerPaymentNotification(options: {
  amount: number;
  orderId: string;
  voiceLang: VoiceLang;
  vendorPhone?: string | null;
  sendWhatsApp?: boolean;
  alertVolume?: AlertVolume | null;
  orderItems?: OrderItemForVoice[] | null;
}): void {
  const { amount, orderId, voiceLang, vendorPhone, sendWhatsApp, alertVolume, orderItems } = options;
  const vol = getAlertVolumeMultiplier(alertVolume);
  playPaymentSound(vol);
  vibratePayment();
  if (orderItems && orderItems.length > 0) {
    speakOrderSummary(voiceLang, orderItems, amount);
  } else {
    speakPaymentReceived(voiceLang, Math.round(amount));
  }
  if (sendWhatsApp && vendorPhone) {
    sendWhatsAppPaymentAlert(vendorPhone, Math.round(amount), orderId);
  }
}
