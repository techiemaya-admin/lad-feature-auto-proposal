import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  dotColor?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  menuClassName?: string;
  menuAlign?: "left" | "right";
  disabled?: boolean;
  prefix?: React.ReactNode;
  maxMenuHeight?: number;
  id?: string;
  "aria-label"?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  size = "xs",
  className,
  menuClassName,
  menuAlign = "left",
  disabled = false,
  prefix,
  maxMenuHeight = 280,
  id,
  "aria-label": ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const dropdownId = id || generatedId;

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuMinWidth = 160;
    const menuWidth = Math.max(rect.width, menuMinWidth);

    let left = menuAlign === "right" ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;

    const actualMaxHeight = Math.min(
      maxMenuHeight,
      openAbove ? spaceAbove : spaceBelow
    );

    const style: React.CSSProperties = {
      position: "fixed",
      left: `${left}px`,
      minWidth: `${menuWidth}px`,
      maxHeight: `${Math.max(120, actualMaxHeight)}px`,
      zIndex: 9999,
    };

    if (openAbove) {
      style.bottom = `${window.innerHeight - rect.top + 4}px`;
      style.transformOrigin = "bottom";
    } else {
      style.top = `${rect.bottom + 4}px`;
      style.transformOrigin = "top";
    }

    setMenuStyle(style);
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const activeIdx = options.findIndex((opt) => opt.value === value);
    setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (event.key === "Enter" && highlightedIndex >= 0) {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option && !option.disabled) {
          onChange(option.value);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, options, value, menuAlign, maxMenuHeight, highlightedIndex]);

  const sizeClasses = {
    xs: "h-6.5 px-2 text-[11px] gap-1.5 rounded-lg",
    sm: "h-7.5 px-2.5 text-xs gap-2 rounded-xl",
    md: "h-8.5 px-3 text-xs gap-2.5 rounded-xl",
    lg: "h-10 px-3.5 text-sm gap-3 rounded-2xl",
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={dropdownId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "group inline-flex items-center justify-between font-medium transition-all select-none cursor-pointer",
          "bg-card dark:bg-[#1A2A43] hover:bg-muted/50 text-foreground border border-border/80 hover:border-primary/40",
          "shadow-2xs hover:shadow-xs active:scale-[0.99] outline-none",
          isOpen && "border-primary/60 ring-2 ring-primary/20 shadow-xs",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {prefix && <span className="shrink-0 text-muted-foreground">{prefix}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0 text-primary">{selectedOption.icon}</span>
          )}
          {selectedOption?.dotColor && (
            <span className={cn("size-2 rounded-full shrink-0", selectedOption.dotColor)} />
          )}
          <span className="truncate text-foreground font-semibold">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ml-1.5 group-hover:text-foreground",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {/* Floating Portal Menu */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-activedescendant={
              highlightedIndex >= 0 ? `${dropdownId}-opt-${highlightedIndex}` : undefined
            }
            style={menuStyle}
            className={cn(
              "p-1.5",
              "bg-card/98 dark:bg-[#1A2A43]/98 text-foreground backdrop-blur-xl",
              "border border-border/80 rounded-2xl shadow-2xl shadow-black/20",
              "overflow-y-auto overscroll-contain",
              "animate-in fade-in-0 zoom-in-95 duration-150 ease-out",
              menuClassName
            )}
          >
            <div className="space-y-0.5">
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    type="button"
                    role="option"
                    id={`${dropdownId}-opt-${index}`}
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    key={option.value}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all text-left select-none cursor-pointer",
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-[#2B7CFF] font-semibold"
                        : isHighlighted
                        ? "bg-muted/80 text-foreground"
                        : "text-foreground hover:bg-muted/60",
                      option.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                      {option.dotColor && (
                        <span
                          className={cn("size-2 rounded-full shrink-0", option.dotColor)}
                        />
                      )}
                      {option.icon && (
                        <span className="shrink-0 text-primary">{option.icon}</span>
                      )}
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{option.label}</span>
                          {option.badge && (
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#2B7CFF] border border-primary/20 shrink-0">
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {option.description && (
                          <span className="text-[10px] text-muted-foreground block truncate mt-0.5 font-normal">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="size-3.5 text-primary shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CustomDropdown;
