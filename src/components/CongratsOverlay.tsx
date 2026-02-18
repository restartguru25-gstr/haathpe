import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";

const COIN_COUNT = 12;
const DURATION_MS = 4000;

interface CongratsOverlayProps {
  coins: number;
  cashback?: number;
  onComplete?: () => void;
}

export default function CongratsOverlay({ coins, cashback = 0, onComplete }: CongratsOverlayProps) {
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#1E40AF] via-[#3B82F6] to-[#F97316]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Sparkle particles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-[#FFD700]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.2, 1, 0],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
              />
            ))}
          </div>

          {/* Falling coins */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: COIN_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-[#FFD700] drop-shadow-lg"
                style={{
                  left: `${10 + (i * 8)}%`,
                  top: -40,
                }}
                initial={{ y: -50, opacity: 0, rotate: 0 }}
                animate={{
                  y: window.innerHeight + 50,
                  opacity: [0, 1, 1, 0],
                  rotate: 360 * 3,
                }}
                transition={{
                  duration: 3 + (i % 3) * 0.5,
                  delay: i * 0.15,
                  ease: "linear",
                }}
              >
                <Coins size={28 + (i % 3) * 4} strokeWidth={1.5} className="filter drop-shadow" />
              </motion.div>
            ))}
          </div>

          <motion.div
            className="relative z-10 text-center px-6 max-w-sm"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <motion.div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur border-2 border-[#FFD700]/80 mb-6"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(255,215,0,0.4)",
                  "0 0 40px rgba(255,215,0,0.6)",
                  "0 0 20px rgba(255,215,0,0.4)",
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Coins className="w-12 h-12 text-[#FFD700]" />
            </motion.div>
            <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md mb-2">
              Congratulations!
            </h2>
            <p className="text-lg font-semibold text-[#FFD700] drop-shadow">
              {coins} Coins Awarded
            </p>
            {cashback > 0 && (
              <p className="text-sm text-white/90 mt-1">
                + ₹{cashback.toFixed(0)} added to wallet
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
