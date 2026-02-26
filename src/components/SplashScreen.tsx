import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPLASH_DURATION_MS = 3000;

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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
