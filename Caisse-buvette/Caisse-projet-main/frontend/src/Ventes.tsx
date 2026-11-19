// frontend/src/Ventes.tsx — liste des ventes d'une journée, avec annulation
import { useCallback, useEffect, useState } from 'react';
import { api, Vente } from './api';
import { Chargement, Confirmer, SelecteurJour } from './composants';
import { aujourdhui, euros, heure } from './format';

export default function Ventes({ onChangement, notifier }: { onChangement: () => void; notifier: (t: string, type?: 'ok' | 'erreur') => void }) {
  const [jour, setJour] = useState(aujourdhui());
  const [ventes, setVentes] = useState<Vente[] | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Vente | null>(null);

  const charger = useCallback(() => {
    api
      .ventes(jour)
      .then((r) => setVentes(r.ventes))
      .catch((e: Error) => notifier(e.message, 'erreur'));
  }, [jour, notifier]);

  useEffect(() => {
    setVentes(null);
    charger();
  }, [charger]);

  async function annuler(v: Vente) {
    setAAnnuler(null);
    try {
      await api.annuler(v.id);
      notifier(`Vente n° ${v.id} annulée, stock remis à jour`);
      onChangement();
      charger();
    } catch (e) {
      notifier((e as Error).message, 'erreur');
    }
  }

  const valides = ventes?.filter((v) => !v.annulee) ?? [];
  const total = valides.reduce((s, v) => s + v.total, 0);

  return (
    <div className="page">
      <SelecteurJour jour={jour} onChange={setJour} />

      {ventes === null ? (
        <Chargement />
      ) : ventes.length === 0 ? (
        <p className="etat-vide">Aucune vente ce jour-là.</p>
      ) : (
        <>
          <p className="resume-jour">
            {valides.length} vente{valides.length > 1 ? 's' : ''} · <strong>{euros(total)}</strong>
          </p>
          <ul className="liste-ventes">
            {ventes.map((v) => (
              <li key={v.id} className={v.annulee ? 'annulee' : ''}>
                <div className="vente-ligne1">
                  <span className="vente-heure">{heure(v.date)}</span>
                  <span className={`badge ${v.mode_paiement}`}>{v.mode_paiement === 'especes' ? 'Espèces' : 'Carte'}</span>
                  {v.annulee && <span className="badge annulee">Annulée</span>}
                  <strong className="vente-total">{euros(v.total)}</strong>
                </div>
                <div className="vente-ligne2">
                  <span className="vente-articles">
                    {v.lignes.map((l) => `${l.quantite}× ${l.nom}`).join(', ')}
                  </span>
                  {!v.annulee && (
                    <button className="lien danger" onClick={() => setAAnnuler(v)}>
                      Annuler
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {aAnnuler && (
        <Confirmer
          message={`Annuler la vente n° ${aAnnuler.id} de ${heure(aAnnuler.date)} (${euros(aAnnuler.total)}) ? Les produits seront remis en stock.`}
          libelle="Annuler la vente"
          onOui={() => annuler(aAnnuler)}
          onNon={() => setAAnnuler(null)}
        />
      )}
    </div>
  );
}
