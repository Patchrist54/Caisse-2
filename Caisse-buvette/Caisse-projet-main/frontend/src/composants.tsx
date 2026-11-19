// frontend/src/composants.tsx — petits composants partagés
import { ReactNode, useEffect } from 'react';
import { aujourdhui, decalerJour, libelleJour } from './format';

/** Fenêtre modale : feuille du bas sur téléphone, boîte centrée sur tablette. */
export function Modale({ titre, onFermer, children }: { titre: string; onFermer?: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!onFermer) return;
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="modale" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <div className="modale-entete">
          <h2>{titre}</h2>
          {onFermer && (
            <button className="bouton-icone" onClick={onFermer} aria-label="Fermer">
              ✕
            </button>
          )}
        </div>
        <div className="modale-corps">{children}</div>
      </div>
    </div>
  );
}

export function Confirmer({
  message,
  libelle,
  onOui,
  onNon,
}: {
  message: string;
  libelle: string;
  onOui: () => void;
  onNon: () => void;
}) {
  return (
    <Modale titre="Confirmation" onFermer={onNon}>
      <p className="confirmer-texte">{message}</p>
      <div className="rangee-boutons">
        <button className="bouton secondaire" onClick={onNon}>
          Retour
        </button>
        <button className="bouton danger" onClick={onOui}>
          {libelle}
        </button>
      </div>
    </Modale>
  );
}

export function SelecteurJour({ jour, onChange }: { jour: string; onChange: (j: string) => void }) {
  const estAujourdhui = jour >= aujourdhui();
  return (
    <div className="selecteur-jour">
      <button className="bouton-icone" onClick={() => onChange(decalerJour(jour, -1))} aria-label="Jour précédent">
        ‹
      </button>
      <span className="selecteur-jour-libelle">{libelleJour(jour)}</span>
      <button
        className="bouton-icone"
        onClick={() => onChange(decalerJour(jour, 1))}
        disabled={estAujourdhui}
        aria-label="Jour suivant"
      >
        ›
      </button>
    </div>
  );
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return <div className="etat-vide">{texte}</div>;
}
