// frontend/src/format.ts — mise en forme (montants en centimes, dates locales)

const formatEuros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export const euros = (centimes: number) => formatEuros.format(centimes / 100);

const deux = (n: number) => String(n).padStart(2, '0');

export const jourIso = (d: Date) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

export const aujourdhui = () => jourIso(new Date());

export function decalerJour(jour: string, nbJours: number): string {
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() + nbJours);
  return jourIso(d);
}

export function libelleJour(jour: string): string {
  if (jour === aujourdhui()) return "Aujourd'hui";
  if (jour === decalerJour(aujourdhui(), -1)) return 'Hier';
  return new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const libelleCourtJour = (jour: string) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

export const heure = (date: string) => date.slice(11, 16).replace(':', 'h');

/** Petite vibration de confirmation (Android ; ignoré silencieusement sur iPhone). */
export function vibrer(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non pris en charge */
  }
}
