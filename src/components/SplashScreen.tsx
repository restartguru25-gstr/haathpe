import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPLASH_DURATION_MS = 3000;

/** Indian national flag – horizontal layout (wider than tall), Ashoka Chakra on white band. */
function IndianFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      role="img"
      aria-label="Indian flag"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="36" height="8" y="0" fill="#FF9933" />
      <rect width="36" height="8" y="8" fill="#FFFFFF" />
      <rect width="36" height="8" y="16" fill="#138808" />
      <g transform="translate(18, 12)">
        <circle r="3" fill="none" stroke="#000080" strokeWidth="0.35" />
        <circle r="0.85" fill="#000080" />
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24 - 90;
          const rad = (angle * Math.PI) / 180;
          const x1 = 0.85 * Math.cos(rad);
          const y1 = 0.85 * Math.sin(rad);
          const x2 = 3 * Math.cos(rad);
          const y2 = 3 * Math.sin(rad);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#000080"
              strokeWidth="0.35"
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const hideAt = SPLASH_DURATION_MS - 450;
    const fadeTimer = setTimeout(() => setFadeOut(true), hideAt);
    const unmountTimer = setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="splash"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-primary"
        initial={{ opacity: 1 }}
        animate={{ opacity: fadeOut ? 0 : 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        exit={{ opacity: 0 }}
        aria-hidden={fadeOut}
      >
        <div className="relative flex flex-col items-center justify-center gap-6 px-6 py-8 text-center sm:gap-8 md:gap-10">
          <motion.p
            className="font-heading text-4xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            I love haathpe
          </motion.p>
          <motion.p
            className="font-heading text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            I am using haathpe
          </motion.p>
          <motion.div
            className="mt-6 sm:mt-8"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          >
            <IndianFlag className="w-28 h-auto sm:w-32 md:w-36 rounded-md border border-white/30 shadow-md" />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
