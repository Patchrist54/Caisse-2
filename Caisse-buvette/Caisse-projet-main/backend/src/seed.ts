// backend/src/seed.ts — schéma et données fictives de démonstration
import type { Database } from 'sql.js';
import { horodatageLocal } from './dates';

export function creerSchema(db: Database): void {
  db.exec(`
    CREATE TABLE categories (
      id      INTEGER PRIMARY KEY,
      nom     TEXT    NOT NULL,
      couleur TEXT    NOT NULL,
      ordre   INTEGER NOT NULL
    );

    CREATE TABLE produits (
      id           INTEGER PRIMARY KEY,
      categorie_id INTEGER NOT NULL REFERENCES categories(id),
      nom          TEXT    NOT NULL,
      emoji        TEXT    NOT NULL,
      prix         INTEGER NOT NULL CHECK (prix >= 0),   -- en centimes
      stock        INTEGER,                              -- NULL = illimité
      actif        INTEGER NOT NULL DEFAULT 1,
      ordre        INTEGER NOT NULL
    );

    CREATE TABLE ventes (
      id            INTEGER PRIMARY KEY,
      date          TEXT    NOT NULL,                    -- heure locale
      total         INTEGER NOT NULL,                    -- centimes
      mode_paiement TEXT    NOT NULL CHECK (mode_paiement IN ('especes', 'carte')),
      montant_recu  INTEGER,                             -- centimes (espèces)
      rendu         INTEGER,                             -- centimes (espèces)
      annulee       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_ventes_date ON ventes(date);

    CREATE TABLE lignes_vente (
      id            INTEGER PRIMARY KEY,
      vente_id      INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
      produit_id    INTEGER NOT NULL REFERENCES produits(id),
      nom           TEXT    NOT NULL,                    -- copie au moment de la vente
      prix_unitaire INTEGER NOT NULL,
      quantite      INTEGER NOT NULL CHECK (quantite > 0)
    );
    CREATE INDEX idx_lignes_vente ON lignes_vente(vente_id);
  `);
}

const CATEGORIES = [
  { id: 1, nom: 'Boissons chaudes', couleur: '#b45309' },
  { id: 2, nom: 'Boissons fraîches', couleur: '#0369a1' },
  { id: 3, nom: 'Salé', couleur: '#b91c1c' },
  { id: 4, nom: 'Sucré', couleur: '#a21caf' },
];

// [catégorie, nom, emoji, prix (centimes), stock (null = illimité), popularité relative]
const PRODUITS: [number, string, string, number, number | null, number][] = [
  [1, 'Café', '☕', 100, null, 10],
  [1, 'Thé', '🍵', 100, null, 3],
  [1, 'Chocolat chaud', '🍫', 150, null, 5],
  [1, 'Vin chaud', '🍷', 250, 60, 6],
  [2, 'Eau 50 cl', '💧', 100, 48, 6],
  [2, 'Coca-Cola 33 cl', '🥤', 200, 48, 7],
  [2, 'Orangina 33 cl', '🍊', 200, 24, 4],
  [2, 'Jus de pomme 25 cl', '🧃', 150, 24, 3],
  [2, 'Bière pression 25 cl', '🍺', 250, null, 9],
  [3, 'Hot-dog', '🌭', 300, 40, 7],
  [3, 'Sandwich jambon-beurre', '🥪', 350, 8, 5],
  [3, 'Croque-monsieur', '🧀', 300, 25, 4],
  [3, 'Frites', '🍟', 250, null, 8],
  [4, 'Crêpe au sucre', '🥞', 200, 50, 6],
  [4, 'Gaufre', '🧇', 250, 0, 4],
];

/** Générateur pseudo-aléatoire déterministe : mêmes données fictives à chaque réinitialisation. */
function mulberry32(graine: number) {
  return () => {
    graine |= 0;
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function insererDonneesFictives(db: Database): void {
  CATEGORIES.forEach((c, i) =>
    db.run('INSERT INTO categories (id, nom, couleur, ordre) VALUES (?, ?, ?, ?)', [c.id, c.nom, c.couleur, i])
  );
  PRODUITS.forEach(([cat, nom, emoji, prix, stock], i) =>
    db.run(
      'INSERT INTO produits (id, categorie_id, nom, emoji, prix, stock, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [i + 1, cat, nom, emoji, prix, stock, i]
    )
  );

  // Historique fictif : 7 derniers jours (aujourd'hui inclus, jusqu'à l'heure actuelle)
  const alea = mulberry32(2026);
  const poidsTotal = PRODUITS.reduce((s, p) => s + p[5], 0);
  const tirerProduit = () => {
    let r = alea() * poidsTotal;
    for (let i = 0; i < PRODUITS.length; i++) {
      r -= PRODUITS[i][5];
      if (r <= 0) return i;
    }
    return PRODUITS.length - 1;
  };

  const maintenant = new Date();
  for (let j = 6; j >= 0; j--) {
    const jour = new Date(maintenant);
    jour.setDate(jour.getDate() - j);
    const nbVentes = 20 + Math.floor(alea() * 35);

    for (let v = 0; v < nbVentes; v++) {
      const date = new Date(jour);
      date.setHours(10 + Math.floor(alea() * 12), Math.floor(alea() * 60), Math.floor(alea() * 60), 0);
      if (date > maintenant) continue;

      // 1 à 4 produits différents, quantités 1 à 3
      const lignes = new Map<number, number>();
      const nbLignes = 1 + Math.floor(alea() * alea() * 4);
      for (let l = 0; l < nbLignes; l++) {
        const p = tirerProduit();
        lignes.set(p, (lignes.get(p) ?? 0) + 1 + Math.floor(alea() * alea() * 3));
      }
      const total = [...lignes].reduce((s, [p, q]) => s + PRODUITS[p][3] * q, 0);

      let mode: 'especes' | 'carte' = 'carte';
      let recu: number | null = null;
      let rendu: number | null = null;
      if (alea() < 0.6) {
        mode = 'especes';
        const billets = [total, Math.ceil(total / 100) * 100, 500, 1000, 2000, 5000].filter((b) => b >= total);
        recu = billets[Math.floor(alea() * Math.min(3, billets.length))];
        rendu = recu - total;
      }

      db.run(
        'INSERT INTO ventes (date, total, mode_paiement, montant_recu, rendu, annulee) VALUES (?, ?, ?, ?, ?, ?)',
        [horodatageLocal(date), total, mode, recu, rendu, alea() < 0.03 ? 1 : 0]
      );
      const venteId = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
      for (const [p, q] of lignes) {
        db.run(
          'INSERT INTO lignes_vente (vente_id, produit_id, nom, prix_unitaire, quantite) VALUES (?, ?, ?, ?, ?)',
          [venteId, p + 1, PRODUITS[p][1], PRODUITS[p][3], q]
        );
      }
    }
  }
}
