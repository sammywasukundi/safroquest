import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

export type Lang = 'en' | 'fr';
const stored = localStorage.getItem('sq.lang');
const initial: Lang = stored === 'fr' || stored === 'en' ? stored : navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
document.documentElement.lang = initial;

export function setLang(l: Lang) {
  localStorage.setItem('sq.lang', l);
  document.documentElement.lang = l;
  void i18n.changeLanguage(l);
}
export default i18n;
