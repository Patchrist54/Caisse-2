// frontend/src/api.ts — accès à l'API (URL relatives : proxy Vite en dev, même serveur en prod)

export interface Categorie {
  id: number;
  nom: string;
  couleur: string;
}

export interface Produit {
  id: number;
  categorie_id: number;
  nom: string;
  emoji: string;
  prix: number; // centimes
  stock: number | null; // null = illimité
}

export interface Catalogue {
  categories: Categorie[];
  produits: Produit[];
}

export type ModePaiement = 'especes' | 'carte';

export interface LigneVente {
  produit_id: number;
  nom: string;
  prix_unitaire: number;
  quantite: number;
}

export interface Vente {
  id: number;
  date: string; // 'YYYY-MM-DD HH:MM:SS', heure locale
  total: number;
  mode_paiement: ModePaiement;
  montant_recu: number | null;
  rendu: number | null;
  annulee: boolean;
  lignes: LigneVente[];
}

export interface Bilan {
  jour: string;
  nbVentes: number;
  total: number;
  especes: number;
  carte: number;
  nbAnnulees: number;
  panierMoyen: number;
  parProduit: { nom: string; emoji: string; quantite: number; total: number }[];
  septJours: { jour: string; total: number; nbVentes: number }[];
}

export interface NouvelleVente {
  lignes: { produitId: number; quantite: number }[];
  modePaiement: ModePaiement;
  montantRecu?: number;
}

async function appel<T>(url: string, options: RequestInit = {}): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('Serveur injoignable. Vérifiez le Wi-Fi et que le PC de la caisse est allumé.');
  }
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees.erreur ?? `Erreur serveur (${reponse.status})`);
  return donnees as T;
}

export const api = {
  catalogue: () => appel<Catalogue>('/api/catalogue'),
  vendre: (vente: NouvelleVente) => appel<Vente>('/api/ventes', { method: 'POST', body: JSON.stringify(vente) }),
  ventes: (jour: string) => appel<{ jour: string; ventes: Vente[] }>(`/api/ventes?jour=${jour}`),
  annuler: (id: number) => appel<Vente>(`/api/ventes/${id}/annuler`, { method: 'POST' }),
  bilan: (jour: string) => appel<Bilan>(`/api/bilan?jour=${jour}`),
  reinitialiser: () => appel<{ ok: true }>('/api/admin/reinitialiser', { method: 'POST' }),
};
