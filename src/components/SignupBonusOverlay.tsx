import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Gift } from "lucide-react";

const DURATION_MS = 4200;

export default function SignupBonusOverlay({
  amount,
  onComplete,
}: {
  amount: number;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, DURATION_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-gradient-to-br from-[#0B1220] via-[#1E40AF] to-[#F97316]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Confetti-like sparkles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 26 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-[#FFD700]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.2, 1, 0],
                  rotate: 360,
                }}
                transition={{
                  duration: 2.2,
                  delay: i * 0.06,
                  repeat: Infinity,
                  repeatDelay: 0.6,
                }}
              >
                <Sparkles className="w-5 h-5" />
              </motion.div>
            ))}
          </div>

          <motion.div
            className="relative z-10 text-center px-6 max-w-sm"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <motion.div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/10 backdrop-blur border border-[#FFD700]/50 mb-6"
              animate={{
                boxShadow: [
                  "0 0 18px rgba(255,215,0,0.35)",
                  "0 0 42px rgba(255,215,0,0.65)",
                  "0 0 18px rgba(255,215,0,0.35)",
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Gift className="w-12 h-12 text-[#FFD700]" />
            </motion.div>

            <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md mb-2">
              Welcome to Haathpe
            </h2>
            <p className="text-base md:text-lg font-semibold text-[#FFD700] drop-shadow">
              ₹{Math.round(amount)} Signup Bonus added to your wallet
            </p>
            <p className="mt-2 text-xs text-white/80">
              Use ₹5 off on your next orders (eligible orders only)
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

