export const fmtTime = (t: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t));
export const shortAddr = (a: string) => (a.length > 22 ? `${a.slice(0, 12)}…${a.slice(-6)}` : a);
