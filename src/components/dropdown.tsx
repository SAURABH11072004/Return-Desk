"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption<V extends string> = { value: V; label: string; icon?: LucideIcon; iconClass?: string };

/**
 * A small listbox-style dropdown. `multiple` turns it into a checklist (used for status).
 * Closes on outside click and Escape; options are real buttons, so it works by keyboard.
 */
export function Dropdown<V extends string>({
  label,
  icon: TriggerIcon,
  options,
  selected,
  onChange,
  multiple = false,
  align = "left",
  summary,
  neutral = false,
}: {
  label: string;
  icon: LucideIcon;
  options: DropdownOption<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
  multiple?: boolean;
  align?: "left" | "right";
  /** Text shown in the trigger when something is selected. */
  summary?: string;
  /** Show the selection without the "filter is active" highlight (e.g. sort order). */
  neutral?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // While a checklist is open, clicks build on this working copy. Applying a filter updates the URL
  // asynchronously, so deriving each click from `selected` would drop quick successive clicks.
  const [draft, setDraft] = useState<V[] | null>(null);
  const current = open && draft ? draft : selected;
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleOpen = () => {
    setDraft(open ? null : selected);
    setOpen(!open);
  };

  const choose = (value: V) => {
    if (multiple) {
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      setDraft(next);
      onChange(next);
    } else {
      onChange([value]);
      setOpen(false);
    }
  };

  const showSummary = selected.length > 0 && Boolean(summary);
  const active = showSummary && !neutral;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className={`inline-flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm shadow-card transition-colors ${
          active ? "border-accent/40 bg-accent-soft text-accent-text" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
        }`}
      >
        <TriggerIcon aria-hidden className="size-4 shrink-0 opacity-80" />
        <span className="truncate">
          <span className={showSummary ? "sr-only" : ""}>{label}</span>
          {showSummary && <span className={active ? "font-medium" : ""}>{summary}</span>}
        </span>
        <ChevronDown aria-hidden className={`ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          className={`absolute z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] animate-scale-in rounded-xl border border-line bg-surface p-1.5 shadow-floating ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((option) => {
            const isSelected = current.includes(option.value);
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role={multiple ? "menuitemcheckbox" : "menuitemradio"}
                aria-checked={isSelected}
                onClick={() => choose(option.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
              >
                {multiple ? (
                  <span
                    className={`grid size-4 place-items-center rounded border transition-colors ${
                      isSelected ? "border-accent bg-accent text-accent-fg" : "border-line-strong"
                    }`}
                  >
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                ) : null}
                {Icon && <Icon aria-hidden className={`size-4 ${option.iconClass ?? "text-faint"}`} />}
                <span className="flex-1">{option.label}</span>
                {!multiple && isSelected && <Check aria-hidden className="size-4 text-accent-text" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
