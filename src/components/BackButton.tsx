import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  fallbackTo?: string;
  label?: string;
  className?: string;
  variant?: "ghost" | "outline" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

/** Back button: navigates(-1) when history allows, else navigates to fallbackTo (default "/") */
export default function BackButton({
  fallbackTo = "/",
  label,
  className,
  variant = "ghost",
  size = "icon",
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("shrink-0", className)}
      aria-label={label ?? "Go back"}
    >
      <ArrowLeft size={size === "icon" ? 20 : 18} className={size !== "icon" && label ? "mr-1.5" : ""} />
      {label}
    </Button>
  );
}
