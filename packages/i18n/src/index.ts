/**
 * @saas/i18n — Sistema de tradução editável.
 * Arquivos JSON em src/locales/ podem ser editados sem mexer no código.
 * Para adicionar idioma: criar novo arquivo (ex: en.json) e adicionar em SUPPORTED_LOCALES.
 */
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LOCALES = ["pt-BR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

const translations: Record<Locale, Record<string, string>> = {
  "pt-BR": ptBR as Record<string, string>,
};

/** Traduz uma chave. Fallback para pt-BR se não encontrar no idioma. */
export function t(key: string, locale: Locale = DEFAULT_LOCALE, params?: Record<string, string | number>): string {
  let text = translations[locale]?.[key] || translations[DEFAULT_LOCALE][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

/** Hook para usar em componentes React (client-side). */
export function useT(locale: Locale = DEFAULT_LOCALE) {
  return (key: string, params?: Record<string, string | number>) => t(key, locale, params);
}

export default t;
