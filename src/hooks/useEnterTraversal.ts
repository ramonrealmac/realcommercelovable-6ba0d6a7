import React, { useCallback } from "react";

/**
 * Hook para gerenciar a navegação de foco através da tecla Enter (e Shift+Enter para voltar).
 * Também suporta o gatilho automático de botões de lookup caso o campo seja obrigatório e esteja vazio.
 */
export function useEnterTraversal() {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;

    const activeEl = document.activeElement as HTMLElement;
    if (!activeEl) return;

    const tagName = activeEl.tagName;

    // Ignora elementos onde o Enter tem comportamento nativo importante
    if (tagName === "TEXTAREA") return;
    if (tagName === "BUTTON" && activeEl.getAttribute("data-lookup-trigger") !== "true") return;
    if (activeEl.getAttribute("data-ignore-enter-traversal") === "true") return;

    // Previne envio acidental de formulários no Enter
    e.preventDefault();

    const container = e.currentTarget;
    const allElements = Array.from(
      container.querySelectorAll<HTMLElement>(
        "input, select, textarea, button, [data-focusable='true']"
      )
    );

    // Filtra apenas elementos visíveis, habilitados e navegáveis
    const focusableElements = allElements.filter((el) => {
      // Ignora elementos invisíveis ou sem tamanho
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;

      const inputEl = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
      if (inputEl.disabled || el.tabIndex === -1) return false;

      // Ignora inputs do tipo hidden
      if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "hidden") return false;

      // Ignora botões auxiliares que não sejam de submit
      if (el.tagName === "BUTTON") {
        if ((el as HTMLButtonElement).type === "button") return false;
        if (el.getAttribute("data-lookup-trigger") === "true") return false;
      }

      return true;
    });

    const currentIndex = focusableElements.indexOf(activeEl);

    // Regra 1-b: Comportamento inteligente por tipo de Lookup
    const isLookup = activeEl.getAttribute("data-lookup") === "true";
    const isRequired =
      activeEl.hasAttribute("required") ||
      activeEl.getAttribute("data-required") === "true" ||
      activeEl.getAttribute("required") === "true";
    const val = (activeEl as HTMLInputElement).value || "";

    if (isLookup && val.trim() === "") {
      if (isRequired) {
        // Busca o botão de consulta associado
        const lookupKey = activeEl.getAttribute("data-lookup-key");
        let triggerBtn: HTMLElement | null = null;

        if (lookupKey) {
          triggerBtn = container.querySelector(
            `[data-lookup-trigger="true"][data-lookup-key="${lookupKey}"]`
          );
        }

        if (!triggerBtn) {
          // Fallback: procura um botão dentro do mesmo container/flex do input
          const parent = activeEl.parentElement;
          triggerBtn =
            parent?.querySelector('[data-lookup-trigger="true"]') ||
            parent?.querySelector("button");
        }

        if (triggerBtn) {
          triggerBtn.click();
          return; // Para a execução aqui, abrindo o modal sem avançar foco
        }
      }
      // Se for opcional e estiver vazio, o fluxo prossegue para avançar o foco
    }

    // Navega para frente (Enter) ou para trás (Shift+Enter)
    const direction = e.shiftKey ? -1 : 1;
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < focusableElements.length) {
      const nextEl = focusableElements[nextIndex];
      nextEl.focus();

      // Autoseleciona o texto se for um input do tipo texto/número
      if (nextEl.tagName === "INPUT") {
        const input = nextEl as HTMLInputElement;
        if (input.type === "text" || input.type === "number") {
          input.select();
        }
      }
    }
  }, []);

  return { handleKeyDown };
}
