// frontend/src/App.tsx — structure de l'application et état partagé (catalogue, panier)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Catalogue, Produit } from './api';
import Bilan from './Bilan';
import Caisse, { LignePanier } from './Caisse';
import Encaissement from './Encaissement';
import Ventes from './Ventes';
import { Chargement } from './composants';
import { vibrer } from './format';

type Onglet = 'caisse' | 'ventes' | 'bilan';
type Toast = { texte: string; type: 'ok' | 'erreur'; id: number };

const ONGLETS: { id: Onglet; libelle: string; icone: JSX.Element }[] = [
  {
    id: 'caisse',
    libelle: 'Caisse',
    icone: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h16l-1.5 10h-13zM8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    id: 'ventes',
    libelle: 'Ventes',
    icone: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />
      </svg>
    ),
  },
  {
    id: 'bilan',
    libelle: 'Bilan',
    icone: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16M7 20v-6M12 20V6M17 20v-9" />
      </svg>
    ),
  },
];

export default function App() {
  const [onglet, setOnglet] = useState<Onglet>('caisse');
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [panier, setPanier] = useState<{ produitId: number; quantite: number }[]>([]);
  const [encaissement, setEncaissement] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const notifier = useCallback((texte: string, type: 'ok' | 'erreur' = 'ok') => {
    setToast({ texte, type, id: Date.now() });
  }, []);

  const chargerCatalogue = useCallback(() => {
    api
      .catalogue()
      .then((c) => {
        setCatalogue(c);
        setErreurChargement(null);
        // retire du panier les produits devenus indisponibles
        setPanier((pan) => pan.filter((l) => c.produits.some((p) => p.id === l.produitId)));
      })
      .catch((e: Error) => setErreurChargement(e.message));
  }, []);

  useEffect(() => {
    chargerCatalogue();
  }, [chargerCatalogue]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const lignes: LignePanier[] = useMemo(() => {
    if (!catalogue) return [];
    return panier.flatMap((l) => {
      const produit = catalogue.produits.find((p) => p.id === l.produitId);
      return produit ? [{ produit, quantite: l.quantite }] : [];
    });
  }, [panier, catalogue]);
  const total = lignes.reduce((s, l) => s + l.quantite * l.produit.prix, 0);

  function modifier(produit: Produit, delta: number) {
    const actuelle = panier.find((l) => l.produitId === produit.id)?.quantite ?? 0;
    const voulue = actuelle + delta;
    if (delta > 0 && produit.stock !== null && voulue > produit.stock) {
      notifier(produit.stock === 0 ? `${produit.nom} : épuisé` : `${produit.nom} : il n’en reste que ${produit.stock}`, 'erreur');
      return;
    }
    if (delta > 0 && voulue > 99) return;
    vibrer();
    setPanier((pan) =>
      voulue <= 0
        ? pan.filter((l) => l.produitId !== produit.id)
        : actuelle === 0
          ? [...pan, { produitId: produit.id, quantite: voulue }]
          : pan.map((l) => (l.produitId === produit.id ? { ...l, quantite: voulue } : l))
    );
  }

  let contenu: JSX.Element;
  if (erreurChargement && !catalogue) {
    contenu = (
      <div className="etat-vide">
        <p>{erreurChargement}</p>
        <button className="bouton principal" onClick={chargerCatalogue}>
          Réessayer
        </button>
      </div>
    );
  } else if (!catalogue) {
    contenu = <Chargement texte="Connexion à la caisse…" />;
  } else if (onglet === 'caisse') {
    contenu = (
      <Caisse
        catalogue={catalogue}
        lignes={lignes}
        onAjouter={(p) => modifier(p, +1)}
        onModifier={(id, delta) => {
          const p = catalogue.produits.find((x) => x.id === id);
          if (p) modifier(p, delta);
        }}
        onVider={() => setPanier([])}
        onEncaisser={() => setEncaissement(true)}
      />
    );
  } else if (onglet === 'ventes') {
    contenu = <Ventes onChangement={chargerCatalogue} notifier={notifier} />;
  } else {
    contenu = (
      <Bilan
        onChangement={() => {
          setPanier([]);
          chargerCatalogue();
        }}
        notifier={notifier}
      />
    );
  }

  return (
    <div className="app">
      <header className="entete">
        <h1>
          <span aria-hidden="true">🧾</span> Caisse Buvette
        </h1>
      </header>

      <main className={`contenu contenu-${onglet}`}>{contenu}</main>

      <nav className="onglets" aria-label="Navigation">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={onglet === o.id ? 'actif' : ''}
            onClick={() => setOnglet(o.id)}
            aria-current={onglet === o.id ? 'page' : undefined}
          >
            {o.icone}
            <span>{o.libelle}</span>
            {o.id === 'caisse' && lignes.length > 0 && onglet !== 'caisse' && <span className="pastille" />}
          </button>
        ))}
      </nav>

      {encaissement && (
        <Encaissement
          lignes={lignes}
          total={total}
          onVenteEnregistree={() => {
            setPanier([]);
            chargerCatalogue();
          }}
          onFermer={() => setEncaissement(false)}
        />
      )}

      {toast && (
        <div key={toast.id} className={`toast ${toast.type}`} role="status">
          {toast.texte}
        </div>
      )}
    </div>
  );
}
