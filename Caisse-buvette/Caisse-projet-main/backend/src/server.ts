// backend/src/server.ts — API de la caisse buvette
import fs from 'fs';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import { executer, lire, lireUn, ouvrirBase, reinitialiserBase, transaction } from './db';
import { estJourValide, horodatageLocal, jourLocal } from './dates';
import { afficherAccesMobile } from './reseau';

const port = Number(process.env.PORT) || 3000;
const MODE_DEV = __filename.endsWith('.ts'); // lancé via ts-node (npm run dev)
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

/** Erreur « métier » renvoyée au client avec un code 400. */
class ErreurCaisse extends Error {}

// ---------- Types ----------
interface Produit {
  id: number;
  categorie_id: number;
  nom: string;
  emoji: string;
  prix: number;
  stock: number | null;
  actif: number;
}
interface Vente {
  id: number;
  date: string;
  total: number;
  mode_paiement: 'especes' | 'carte';
  montant_recu: number | null;
  rendu: number | null;
  annulee: number;
}
interface LigneVente {
  vente_id: number;
  produit_id: number;
  nom: string;
  prix_unitaire: number;
  quantite: number;
}

function detailVente(v: Vente) {
  const lignes = lire<LigneVente>(
    'SELECT vente_id, produit_id, nom, prix_unitaire, quantite FROM lignes_vente WHERE vente_id = ? ORDER BY id',
    [v.id]
  );
  return { ...v, annulee: v.annulee === 1, lignes };
}

const app = express();
app.use(express.json({ limit: '50kb' }));

// ---------- Santé ----------
app.get('/api/sante', (_req, res) => {
  res.json({ ok: true, heure: horodatageLocal() });
});

// ---------- Catalogue ----------
app.get('/api/catalogue', (_req, res) => {
  const categories = lire('SELECT id, nom, couleur FROM categories ORDER BY ordre');
  const produits = lire<Produit>(
    'SELECT id, categorie_id, nom, emoji, prix, stock, actif FROM produits WHERE actif = 1 ORDER BY ordre'
  );
  res.json({ categories, produits });
});

// ---------- Enregistrer une vente ----------
// Le client n'envoie que les produits et quantités : prix et total sont recalculés ici.
app.post('/api/ventes', (req, res) => {
  const { lignes, modePaiement, montantRecu } = req.body ?? {};

  if (!Array.isArray(lignes) || lignes.length === 0) throw new ErreurCaisse('Le panier est vide.');
  if (modePaiement !== 'especes' && modePaiement !== 'carte') throw new ErreurCaisse('Mode de paiement invalide.');

  const quantites = new Map<number, number>();
  for (const l of lignes) {
    const id = Number(l?.produitId);
    const q = Number(l?.quantite);
    if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1 || q > 99) {
      throw new ErreurCaisse('Ligne de panier invalide.');
    }
    quantites.set(id, (quantites.get(id) ?? 0) + q);
  }

  const vente = transaction(() => {
    let total = 0;
    const details: { p: Produit; q: number }[] = [];
    for (const [id, q] of quantites) {
      const p = lireUn<Produit>('SELECT * FROM produits WHERE id = ? AND actif = 1', [id]);
      if (!p) throw new ErreurCaisse(`Produit introuvable (n° ${id}).`);
      if (p.stock !== null && p.stock < q) {
        throw new ErreurCaisse(p.stock === 0 ? `${p.nom} : épuisé.` : `${p.nom} : il n'en reste que ${p.stock}.`);
      }
      total += p.prix * q;
      details.push({ p, q });
    }

    let recu: number | null = null;
    let rendu: number | null = null;
    if (modePaiement === 'especes') {
      recu = Number(montantRecu);
      if (!Number.isInteger(recu) || recu < total) throw new ErreurCaisse('Montant reçu insuffisant.');
      rendu = recu - total;
    }

    const venteId = executer(
      'INSERT INTO ventes (date, total, mode_paiement, montant_recu, rendu) VALUES (?, ?, ?, ?, ?)',
      [horodatageLocal(), total, modePaiement, recu, rendu]
    );
    for (const { p, q } of details) {
      executer(
        'INSERT INTO lignes_vente (vente_id, produit_id, nom, prix_unitaire, quantite) VALUES (?, ?, ?, ?, ?)',
        [venteId, p.id, p.nom, p.prix, q]
      );
      if (p.stock !== null) executer('UPDATE produits SET stock = stock - ? WHERE id = ?', [q, p.id]);
    }
    return lireUn<Vente>('SELECT * FROM ventes WHERE id = ?', [venteId])!;
  });

  res.status(201).json(detailVente(vente));
});

// ---------- Ventes d'une journée ----------
app.get('/api/ventes', (req, res) => {
  const jour = estJourValide(req.query.jour) ? req.query.jour : jourLocal();
  const ventes = lire<Vente>('SELECT * FROM ventes WHERE substr(date, 1, 10) = ? ORDER BY date DESC', [jour]);
  res.json({ jour, ventes: ventes.map(detailVente) });
});

// ---------- Annuler une vente (remet le stock) ----------
app.post('/api/ventes/:id/annuler', (req, res) => {
  const id = Number(req.params.id);
  const vente = transaction(() => {
    const v = lireUn<Vente>('SELECT * FROM ventes WHERE id = ?', [id]);
    if (!v) throw new ErreurCaisse('Vente introuvable.');
    if (v.annulee) throw new ErreurCaisse('Cette vente est déjà annulée.');
    executer('UPDATE ventes SET annulee = 1 WHERE id = ?', [id]);
    for (const l of lire<LigneVente>('SELECT * FROM lignes_vente WHERE vente_id = ?', [id])) {
      executer('UPDATE produits SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL', [l.quantite, l.produit_id]);
    }
    return lireUn<Vente>('SELECT * FROM ventes WHERE id = ?', [id])!;
  });
  res.json(detailVente(vente));
});

// ---------- Bilan d'une journée + tendance 7 jours ----------
app.get('/api/bilan', (req, res) => {
  const jour = estJourValide(req.query.jour) ? req.query.jour : jourLocal();

  const totaux = lireUn<Record<string, number>>(
    `SELECT
       COUNT(*)                                                    AS nbVentes,
       COALESCE(SUM(total), 0)                                     AS total,
       COALESCE(SUM(CASE WHEN mode_paiement = 'especes' THEN total END), 0) AS especes,
       COALESCE(SUM(CASE WHEN mode_paiement = 'carte'   THEN total END), 0) AS carte,
       (SELECT COUNT(*) FROM ventes WHERE annulee = 1 AND substr(date, 1, 10) = $jour) AS nbAnnulees
     FROM ventes WHERE annulee = 0 AND substr(date, 1, 10) = $jour`,
    { $jour: jour }
  )!;

  const parProduit = lire(
    `SELECT l.nom, p.emoji, SUM(l.quantite) AS quantite, SUM(l.quantite * l.prix_unitaire) AS total
     FROM lignes_vente l
     JOIN ventes v   ON v.id = l.vente_id
     JOIN produits p ON p.id = l.produit_id
     WHERE v.annulee = 0 AND substr(v.date, 1, 10) = ?
     GROUP BY l.produit_id ORDER BY total DESC`,
    [jour]
  );

  // 7 jours se terminant au jour demandé (jours sans vente inclus)
  const fin = new Date(`${jour}T12:00:00`);
  const jours: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(fin);
    d.setDate(d.getDate() - i);
    jours.push(jourLocal(d));
  }
  const ventilation = new Map(
    lire<{ jour: string; total: number; nbVentes: number }>(
      `SELECT substr(date, 1, 10) AS jour, SUM(total) AS total, COUNT(*) AS nbVentes
       FROM ventes WHERE annulee = 0 AND substr(date, 1, 10) BETWEEN ? AND ? GROUP BY jour`,
      [jours[0], jours[6]]
    ).map((r) => [r.jour, r])
  );
  const septJours = jours.map((j) => ({ jour: j, total: ventilation.get(j)?.total ?? 0, nbVentes: ventilation.get(j)?.nbVentes ?? 0 }));

  res.json({
    jour,
    ...totaux,
    panierMoyen: totaux.nbVentes ? Math.round(totaux.total / totaux.nbVentes) : 0,
    parProduit,
    septJours,
  });
});

// ---------- Réinitialiser la base de démonstration ----------
app.post('/api/admin/reinitialiser', (_req, res) => {
  reinitialiserBase();
  res.json({ ok: true });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ erreur: 'Route inconnue.' });
});

// ---------- Interface compilée (npm run prod) : tout sur un seul port ----------
const frontendCompile = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
if (frontendCompile) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

// ---------- Gestion des erreurs ----------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErreurCaisse) {
    res.status(400).json({ erreur: err.message });
    return;
  }
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ erreur: 'Requête JSON invalide.' });
    return;
  }
  console.error(err);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

ouvrirBase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend démarré sur le port ${port}`);
      if (MODE_DEV) afficherAccesMobile(5173, 'Caisse (mode développement) :');
      else if (frontendCompile) afficherAccesMobile(port, 'Caisse :');
      else console.log('Interface non compilée : lancez « npm run dev » ou « npm run prod » à la racine.');
    });
  })
  .catch((e) => {
    console.error('Impossible d’ouvrir la base de données :', e);
    process.exit(1);
  });
