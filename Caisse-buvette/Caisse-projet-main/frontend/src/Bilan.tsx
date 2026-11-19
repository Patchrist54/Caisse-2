// frontend/src/Bilan.tsx — bilan de la journée + tendance sur 7 jours
import { useEffect, useState } from 'react';
import { api, Bilan as TBilan } from './api';
import { Chargement, Confirmer, SelecteurJour } from './composants';
import { aujourdhui, euros, libelleCourtJour, libelleJour } from './format';

export default function Bilan({ onChangement, notifier }: { onChangement: () => void; notifier: (t: string, type?: 'ok' | 'erreur') => void }) {
  const [jour, setJour] = useState(aujourdhui());
  const [bilan, setBilan] = useState<TBilan | null>(null);
  const [confirmerReset, setConfirmerReset] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    api
      .bilan(jour)
      .then((b) => actif && setBilan(b))
      .catch((e: Error) => notifier(e.message, 'erreur'));
    return () => {
      actif = false;
    };
  }, [jour, version, notifier]);

  async function reinitialiser() {
    setConfirmerReset(false);
    try {
      await api.reinitialiser();
      notifier('Données de démonstration régénérées');
      onChangement();
      setVersion((v) => v + 1);
    } catch (e) {
      notifier((e as Error).message, 'erreur');
    }
  }

  if (!bilan || bilan.jour !== jour) {
    return (
      <div className="page">
        <SelecteurJour jour={jour} onChange={setJour} />
        <Chargement />
      </div>
    );
  }

  const max7 = Math.max(...bilan.septJours.map((j) => j.total), 1);
  const maxProduit = Math.max(...bilan.parProduit.map((p) => p.total), 1);

  return (
    <div className="page">
      <SelecteurJour jour={jour} onChange={setJour} />

      <div className="tuiles-stats">
        <div className="stat hero">
          <span>Chiffre d’affaires</span>
          <strong>{euros(bilan.total)}</strong>
        </div>
        <div className="stat">
          <span>Ventes</span>
          <strong>{bilan.nbVentes}</strong>
        </div>
        <div className="stat">
          <span>Panier moyen</span>
          <strong>{euros(bilan.panierMoyen)}</strong>
        </div>
        <div className="stat">
          <span>💶 Espèces</span>
          <strong>{euros(bilan.especes)}</strong>
        </div>
        <div className="stat">
          <span>💳 Carte</span>
          <strong>{euros(bilan.carte)}</strong>
        </div>
      </div>
      {bilan.nbAnnulees > 0 && (
        <p className="note">
          {bilan.nbAnnulees} vente{bilan.nbAnnulees > 1 ? 's annulées' : ' annulée'} (non comptée{bilan.nbAnnulees > 1 ? 's' : ''})
        </p>
      )}

      <section className="carte-section">
        <h3>Chiffre d’affaires sur 7 jours</h3>
        <div className="histo" role="img" aria-label="Chiffre d’affaires des 7 derniers jours">
          {bilan.septJours.map((j) => {
            const choisi = j.jour === jour;
            return (
              <button
                key={j.jour}
                className={`histo-col ${choisi ? 'choisi' : ''}`}
                onClick={() => setJour(j.jour)}
                title={`${libelleJour(j.jour)} : ${euros(j.total)} (${j.nbVentes} ventes)`}
                aria-label={`${libelleJour(j.jour)} : ${euros(j.total)}`}
              >
                <span className="histo-valeur">{choisi ? euros(j.total) : ''}</span>
                <span className="histo-zone">
                  <span className="histo-barre" style={{ height: `${(j.total / max7) * 100}%` }} />
                </span>
                <span className="histo-jour">{libelleCourtJour(j.jour)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="carte-section">
        <h3>Ventes par produit</h3>
        {bilan.parProduit.length === 0 ? (
          <p className="etat-vide">Aucune vente.</p>
        ) : (
          <table className="table-produits">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Qté</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {bilan.parProduit.map((p) => (
                <tr key={p.nom}>
                  <td>
                    <span className="produit-barre-nom">
                      {p.emoji} {p.nom}
                    </span>
                    <span className="produit-barre" style={{ width: `${(p.total / maxProduit) * 100}%` }} />
                  </td>
                  <td>{p.quantite}</td>
                  <td>{euros(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="zone-demo">
        <p>Version de test : les ventes passées sont fictives.</p>
        <button className="bouton secondaire" onClick={() => setConfirmerReset(true)}>
          Réinitialiser les données de démonstration
        </button>
      </section>

      {confirmerReset && (
        <Confirmer
          message="Effacer toutes les ventes et régénérer la base de démonstration (15 produits, 7 jours de ventes fictives) ?"
          libelle="Réinitialiser"
          onOui={reinitialiser}
          onNon={() => setConfirmerReset(false)}
        />
      )}
    </div>
  );
}
