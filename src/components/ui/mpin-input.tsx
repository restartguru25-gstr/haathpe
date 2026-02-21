import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MPINInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
  showPreview?: boolean;
  onShowPreviewChange?: (show: boolean) => void;
  maxLength?: number;
}

const MPINInput = React.forwardRef<HTMLInputElement, MPINInputProps>(
  (
    {
      className,
      value,
      onChange,
      showPreview = false,
      onShowPreviewChange,
      maxLength = 4,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalShow, setInternalShow] = React.useState(showPreview);
    const isControlled = onShowPreviewChange !== undefined;
    const visible = isControlled ? showPreview : internalShow;

    const toggle = () => {
      if (isControlled) {
        onShowPreviewChange?.(!showPreview);
      } else {
        setInternalShow((s) => !s);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, maxLength);
      onChange(v);
    };

    return (
      <div className="relative flex">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background px-4 py-2 pr-10 text-center text-lg font-semibold tracking-[0.4em] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-lg",
            className
          )}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
          onClick={toggle}
          tabIndex={-1}
          aria-label={visible ? "Hide MPIN" : "Show MPIN"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    );
  }
);
MPINInput.displayName = "MPINInput";

export { MPINInput };
