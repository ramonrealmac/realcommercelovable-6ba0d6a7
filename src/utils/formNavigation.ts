import React from "react";

/**
 * Handles Enter key press on form controls to navigate to the next enabled focusable element.
 */
export function handleEnterKeyNavigation(
  e: React.KeyboardEvent | KeyboardEvent,
  containerElement?: HTMLElement | null
) {
  if (e.key !== "Enter") return;

  const target = e.target as HTMLElement;
  if (!target) return;

  // Ignore textareas where enter inserts a line break
  if (target.tagName === "TEXTAREA") return;

  // Ignore submit buttons
  if (target.tagName === "BUTTON" && target.getAttribute("type") === "submit") return;

  // If inside an open Radix select popover or menu, let Radix handle option selection first
  if (
    target.closest('[role="listbox"]') ||
    target.closest('[role="menu"]') ||
    target.getAttribute("role") === "option"
  ) {
    return;
  }

  // Find form container
  const container =
    containerElement ||
    target.closest("form") ||
    target.closest("[data-form-container]") ||
    target.closest(".space-y-4") ||
    target.closest(".space-y-3") ||
    document.body;

  if (!container) return;

  // Query all focusable form elements in DOM order
  const selector = [
    'input:not([type="hidden"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
    'select:not([disabled]):not([readonly]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])'
  ].join(",");

  const focusables = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    // Exclude hidden elements and toolbar navigation buttons
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    if (el.closest('[data-form-toolbar="true"]')) return false;
    if (el.tagName === "BUTTON" && !el.getAttribute("role") && !el.classList.contains("focusable-btn")) {
      // Ignore regular action buttons unless explicitly meant for focus order
      return false;
    }
    return true;
  });

  const currentIndex = focusables.indexOf(target);
  if (currentIndex >= 0 && currentIndex < focusables.length - 1) {
    e.preventDefault();
    const nextElement = focusables[currentIndex + 1];
    nextElement.focus();
    if (nextElement instanceof HTMLInputElement && nextElement.type === "text") {
      nextElement.select();
    }
  }
}

/**
 * Formats numeric input strings on the fly (e.g., typing 1 -> 0,01, 10 -> 0,10, 100 -> 1,00).
 */
export function formatNumericInput(rawString: string, decimals = 2): string {
  const clean = String(rawString || "").replace(/\D/g, "");
  if (!clean) return (0).toFixed(decimals).replace(".", ",");
  const num = parseInt(clean, 10);
  const floatVal = num / Math.pow(10, decimals);
  return floatVal.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Keyboard handler for native select elements:
 * - Alt + ArrowDown: opens the select dropdown picker.
 * - ArrowUp / ArrowDown (without Alt): navigates items without opening picker.
 * - Typing letter/number: jumps to item starting with letter.
 * - Enter: moves focus to next enabled control.
 */
export function handleSelectKeyDown(
  e: React.KeyboardEvent<HTMLSelectElement>,
  containerElement?: HTMLElement | null
) {
  if (e.key === "Enter") {
    handleEnterKeyNavigation(e, containerElement);
    return;
  }

  if (e.altKey && e.key === "ArrowDown") {
    e.preventDefault();
    const select = e.currentTarget;
    if (typeof select.showPicker === "function") {
      try {
        select.showPicker();
      } catch (err) {
        // Fallback for browsers
      }
    }
  }
}
