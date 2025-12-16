/**
 * Internationalization Context
 *
 * Provides language switching and translation access throughout the app
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, Language, TranslationKeys } from './translations';

const LANGUAGE_STORAGE_KEY = 'gitbox-language';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage or browser preference
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage first
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (stored && (stored === 'en' || stored === 'ja')) {
      setLanguageState(stored);
      return;
    }

    // Fallback to browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ja') {
      setLanguageState('ja');
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
  }, []);

  // Get translations for current language
  const t = translations[language];

  // Show nothing until mounted to prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return default values for SSR/pre-render
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: translations.en,
    };
  }
  return context;
}

// Utility hook for just getting translations (simpler API)
export function useTranslation() {
  const { t, language } = useI18n();
  return { t, language };
}

