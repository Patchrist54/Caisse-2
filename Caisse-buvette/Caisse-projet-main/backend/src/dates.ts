// backend/src/dates.ts — dates en heure locale, format SQLite 'YYYY-MM-DD HH:MM:SS'
const deux = (n: number) => String(n).padStart(2, '0');

export function jourLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

export function horodatageLocal(d: Date = new Date()): string {
  return `${jourLocal(d)} ${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
}

export function estJourValide(jour: unknown): jour is string {
  return typeof jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jour);
}
