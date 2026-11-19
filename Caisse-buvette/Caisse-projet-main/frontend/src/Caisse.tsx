// frontend/src/Caisse.tsx — écran de vente : grille de produits + panier
import { useState, type CSSProperties } from 'react';
import type { Catalogue, Produit } from './api';
import { euros } from './format';

export interface LignePanier {
  produit: Produit;
  quantite: number;
}

interface Props {
  catalogue: Catalogue;
  lignes: LignePanier[];
  onAjouter: (p: Produit) => void;
  onModifier: (produitId: number, delta: number) => void;
  onVider: () => void;
  onEncaisser: () => void;
}

const SEUIL_STOCK_BAS = 10;

export default function Caisse({ catalogue, lignes, onAjouter, onModifier, onVider, onEncaisser }: Props) {
  const [categorie, setCategorie] = useState<number | null>(null);
  const [panierOuvert, setPanierOuvert] = useState(false);

  const couleurs = new Map(catalogue.categories.map((c) => [c.id, c.couleur]));
  const dansPanier = new Map(lignes.map((l) => [l.produit.id, l.quantite]));
  const produits = catalogue.produits.filter((p) => categorie === null || p.categorie_id === categorie);
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const total = lignes.reduce((s, l) => s + l.quantite * l.produit.prix, 0);

  return (
    <div className="caisse">
      <section className="caisse-produits">
        <div className="filtres" role="tablist" aria-label="Catégories">
          <button className={`puce ${categorie === null ? 'active' : ''}`} onClick={() => setCategorie(null)}>
            Tout
          </button>
          {catalogue.categories.map((c) => (
            <button
              key={c.id}
              className={`puce ${categorie === c.id ? 'active' : ''}`}
              style={{ '--couleur': c.couleur } as CSSProperties}
              onClick={() => setCategorie(c.id)}
            >
              {c.nom}
            </button>
          ))}
        </div>

        <div className="grille-produits">
          {produits.map((p) => {
            const quantite = dansPanier.get(p.id) ?? 0;
            const epuise = p.stock === 0;
            const reste = p.stock === null ? null : p.stock - quantite;
            return (
              <button
                key={p.id}
                className={`tuile ${epuise ? 'epuisee' : ''} ${quantite ? 'choisie' : ''}`}
                style={{ '--couleur': couleurs.get(p.categorie_id) } as CSSProperties}
                onClick={() => onAjouter(p)}
                disabled={epuise}
                aria-label={`${p.nom}, ${euros(p.prix)}${quantite ? `, ${quantite} dans le panier` : ''}`}
              >
                {quantite > 0 && <span className="tuile-quantite">{quantite}</span>}
                <span className="tuile-emoji" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="tuile-nom">{p.nom}</span>
                <span className="tuile-prix">{euros(p.prix)}</span>
                {epuise ? (
                  <span className="tuile-stock alerte">Épuisé</span>
                ) : (
                  reste !== null &&
                  reste <= SEUIL_STOCK_BAS && <span className="tuile-stock">Reste {reste}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tablette / paysage : panier toujours visible à droite */}
      <aside className="caisse-panier-lateral">
        <Panier lignes={lignes} total={total} onModifier={onModifier} onVider={onVider} onEncaisser={onEncaisser} />
      </aside>

      {/* Téléphone : barre de résumé en bas + panier en feuille */}
      <div className="barre-panier">
        <button className="barre-panier-resume" onClick={() => setPanierOuvert(true)} disabled={nbArticles === 0}>
          <span className="barre-panier-nb">{nbArticles}</span>
          <span>
            {nbArticles === 0 ? 'Panier vide' : nbArticles === 1 ? '1 article' : `${nbArticles} articles`}
            <small>{nbArticles > 0 && 'Voir le panier'}</small>
          </span>
          <strong>{euros(total)}</strong>
        </button>
        <button className="bouton principal" onClick={onEncaisser} disabled={nbArticles === 0}>
          Encaisser
        </button>
      </div>

      {panierOuvert && nbArticles > 0 && (
        <div className="voile" onClick={() => setPanierOuvert(false)}>
          <div className="feuille-panier" onClick={(e) => e.stopPropagation()}>
            <Panier
              lignes={lignes}
              total={total}
              onModifier={onModifier}
              onVider={() => {
                onVider();
                setPanierOuvert(false);
              }}
              onEncaisser={() => {
                setPanierOuvert(false);
                onEncaisser();
              }}
              onFermer={() => setPanierOuvert(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Panier({
  lignes,
  total,
  onModifier,
  onVider,
  onEncaisser,
  onFermer,
}: {
  lignes: LignePanier[];
  total: number;
  onModifier: (produitId: number, delta: number) => void;
  onVider: () => void;
  onEncaisser: () => void;
  onFermer?: () => void;
}) {
  return (
    <div className="panier">
      <div className="panier-entete">
        <h2>Panier</h2>
        {lignes.length > 0 && (
          <button className="lien" onClick={onVider}>
            Vider
          </button>
        )}
        {onFermer && (
          <button className="bouton-icone" onClick={onFermer} aria-label="Fermer le panier">
            ✕
          </button>
        )}
      </div>

      {lignes.length === 0 ? (
        <p className="etat-vide">Touchez un produit pour l’ajouter.</p>
      ) : (
        <ul className="panier-lignes">
          {lignes.map(({ produit, quantite }) => (
            <li key={produit.id}>
              <span className="panier-emoji" aria-hidden="true">
                {produit.emoji}
              </span>
              <span className="panier-nom">
                {produit.nom}
                <small>{euros(produit.prix)} l’unité</small>
              </span>
              <span className="compteur">
                <button onClick={() => onModifier(produit.id, -1)} aria-label={`Retirer un ${produit.nom}`}>
                  −
                </button>
                <span>{quantite}</span>
                <button onClick={() => onModifier(produit.id, +1)} aria-label={`Ajouter un ${produit.nom}`}>
                  +
                </button>
              </span>
              <span className="panier-montant">{euros(produit.prix * quantite)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="panier-pied">
        <div className="panier-total">
          <span>Total</span>
          <strong>{euros(total)}</strong>
        </div>
        <button className="bouton principal large" onClick={onEncaisser} disabled={lignes.length === 0}>
          Encaisser {lignes.length > 0 && euros(total)}
        </button>
      </div>
    </div>
  );
}
