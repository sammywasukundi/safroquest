export type ThemeMode = 'system' | 'light' | 'dark';
export type Accent = 'sky' | 'mint' | 'lavender' | 'sun';

export function applyTheme(mode: ThemeMode, accent: Accent) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  root.setAttribute('data-accent', accent);
  localStorage.setItem('sq.theme', mode);
  localStorage.setItem('sq.accent', accent);
}

export function loadTheme() {
  const m = localStorage.getItem('sq.theme');
  const a = localStorage.getItem('sq.accent');
  applyTheme(m === 'light' || m === 'dark' ? m : 'system', a === 'mint' || a === 'lavender' || a === 'sun' ? a : 'sky');
}
