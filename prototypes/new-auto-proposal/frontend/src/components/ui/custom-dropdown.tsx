import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  menuAlign?: "left" | "right";
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  size = "xs",
  className,
  menuAlign = "left",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: "h-6 px-2 text-[11px] gap-1.5 rounded-md",
    sm: "h-7 px-2.5 text-xs gap-2 rounded-lg",
    md: "h-8 px-3 text-xs gap-2.5 rounded-xl",
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between font-medium transition-all select-none",
          "bg-background/80 hover:bg-muted/80 text-foreground border border-border/50",
          "shadow-2xs hover:shadow-xs active:scale-[0.98] focus:outline-hidden",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.dotColor && (
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                selectedOption.dotColor
              )}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-150 shrink-0",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[140px] p-1",
            "bg-popover/95 text-popover-foreground backdrop-blur-md",
            "border border-border/80 rounded-xl shadow-lg shadow-black/10",
            "animate-in fade-in zoom-in-95 duration-100 origin-top",
            menuAlign === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.dotColor && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          option.dotColor
                        )}
                      />
                    )}
                    {option.icon && (
                      <span className="shrink-0">{option.icon}</span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>

                  {isSelected && <Check className="size-3 text-primary shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
