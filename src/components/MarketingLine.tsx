import { motion } from "framer-motion";

const FULL_TEXT =
  "Get your groceries, kirana essentials, electricals, vegetables, fruits, and more at unbeatable wholesale rates! Try Haathpe today and shop smarter.";

const ORANGE_ACCENT = "#F97316";

type Variant = "banner" | "subtitle";

interface MarketingLineProps {
  variant?: Variant;
}

export default function MarketingLine({ variant = "banner" }: MarketingLineProps) {
  const isBanner = variant === "banner";
  const parts = FULL_TEXT.split("Try Haathpe today");

  return (
    <motion.div
      initial={{ opacity: 0, y: isBanner ? 8 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`font-heading font-bold text-center break-words ${isBanner ? "rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-snug sm:text-base sm:px-5 sm:py-3.5 text-foreground" : "text-xs leading-snug sm:text-sm px-1 py-2 text-muted-foreground max-w-2xl mx-auto"}`}
    >
      {parts[0]}
      <span style={{ color: ORANGE_ACCENT }}>Try Haathpe today</span>
      {parts[1]}
    </motion.div>
  );
}
