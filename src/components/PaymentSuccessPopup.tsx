import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentSuccessPopupProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onReplayVoice?: () => void;
  canReplayVoice?: boolean;
}

const CONFETTI_COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ec4899", "#8b5cf6"];
const CONFETTI_COUNT = 40;

export default function PaymentSuccessPopup({
  visible,
  amount,
  onClose,
  onReplayVoice,
  canReplayVoice,
}: PaymentSuccessPopupProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Confetti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  rotate: i * 20,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: (Math.random() - 0.5) * 800,
                  y: (Math.random() - 0.5) * 800,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 1.5 + Math.random() * 0.5, ease: "easeOut" }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative mx-4 flex max-w-sm flex-col items-center rounded-3xl bg-green-600 px-8 py-10 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-5xl"
            >
              ✓
            </motion.div>
            <motion.p
              initial={{ y: 5 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-1 text-center text-lg font-semibold uppercase tracking-wide text-white/90"
            >
              Payment Received!
            </motion.p>
            <motion.p
              initial={{ y: 5 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center text-4xl font-bold"
            >
              ₹{Math.round(amount)}
            </motion.p>
            {canReplayVoice && onReplayVoice && (
              <motion.button
                type="button"
                initial={{ y: 5 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.22 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReplayVoice();
                }}
                className="mt-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30"
              >
                Replay voice
              </motion.button>
            )}
            <motion.p
              initial={{ y: 5 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-2 text-center text-sm text-white/80"
            >
              Tap to close
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
