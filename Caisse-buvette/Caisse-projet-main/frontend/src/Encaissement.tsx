// frontend/src/Encaissement.tsx — paiement espèces (pavé + rendu de monnaie) ou carte
import { useState } from 'react';
import { api, ModePaiement, Vente } from './api';
import { Modale } from './composants';
import { euros, vibrer } from './format';
import type { LignePanier } from './Caisse';

interface Props {
  lignes: LignePanier[];
  total: number;
  onVenteEnregistree: (v: Vente) => void;
  onFermer: () => void;
}

/** Convertit la saisie du pavé ("12,5") en centimes. */
function saisieEnCentimes(saisie: string): number {
  if (!saisie) return 0;
  const [entiers, decimales = ''] = saisie.split(',');
  return Number(entiers || '0') * 100 + Number((decimales + '00').slice(0, 2));
}

const enSaisie = (centimes: number) =>
  centimes % 100 === 0 ? String(centimes / 100) : (centimes / 100).toFixed(2).replace('.', ',');

/** Montants proposés en raccourci : compte juste, euro supérieur, billets courants. */
function raccourcis(total: number): number[] {
  const candidats = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 1000, 2000, 5000];
  return [...new Set(candidats)].filter((m) => m >= total).sort((a, b) => a - b).slice(0, 4);
}

export default function Encaissement({ lignes, total, onVenteEnregistree, onFermer }: Props) {
  const [mode, setMode] = useState<ModePaiement>('especes');
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vente, setVente] = useState<Vente | null>(null);

  const recu = saisieEnCentimes(saisie);
  const suffisant = mode === 'carte' || recu >= total;

  function touche(t: string) {
    vibrer(8);
    setErreur(null);
    setSaisie((s) => {
      if (t === '⌫') return s.slice(0, -1);
      if (t === ',') return s.includes(',') ? s : (s || '0') + ',';
      const [entiers, decimales] = s.split(',');
      if (decimales !== undefined && decimales.length >= 2) return s;
      if (decimales === undefined && entiers.length >= 4) return s;
      if (s === '0') return t;
      return s + t;
    });
  }

  async function valider() {
    if (!suffisant || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const v = await api.vendre({
        lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: l.quantite })),
        modePaiement: mode,
        montantRecu: mode === 'especes' ? recu : undefined,
      });
      vibrer(40);
      setVente(v);
      onVenteEnregistree(v);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  // ---------- Ticket de confirmation ----------
  if (vente) {
    return (
      <Modale titre="Vente enregistrée" onFermer={onFermer}>
        <div className="ticket">
          <div className="ticket-ok" aria-hidden="true">
            ✓
          </div>
          {vente.mode_paiement === 'especes' ? (
            <>
              <p className="ticket-libelle">À rendre</p>
              <p className="ticket-rendu">{euros(vente.rendu ?? 0)}</p>
              <p className="ticket-detail">
                Reçu {euros(vente.montant_recu ?? 0)} pour {euros(vente.total)}
              </p>
            </>
          ) : (
            <>
              <p className="ticket-libelle">Payé par carte</p>
              <p className="ticket-rendu">{euros(vente.total)}</p>
            </>
          )}
          <ul className="ticket-lignes">
            {vente.lignes.map((l) => (
              <li key={l.produit_id}>
                <span>
                  {l.quantite} × {l.nom}
                </span>
                <span>{euros(l.quantite * l.prix_unitaire)}</span>
              </li>
            ))}
          </ul>
          <p className="ticket-detail">Vente n° {vente.id}</p>
        </div>
        <button className="bouton principal large" onClick={onFermer} autoFocus>
          Nouvelle vente
        </button>
      </Modale>
    );
  }

  // ---------- Saisie du paiement ----------
  return (
    <Modale titre="Encaissement" onFermer={envoi ? undefined : onFermer}>
      <div className="encaissement-total">
        <span>À payer</span>
        <strong>{euros(total)}</strong>
      </div>

      <div className="segment" role="radiogroup" aria-label="Mode de paiement">
        <button role="radio" aria-checked={mode === 'especes'} className={mode === 'especes' ? 'actif' : ''} onClick={() => setMode('especes')}>
          💶 Espèces
        </button>
        <button role="radio" aria-checked={mode === 'carte'} className={mode === 'carte' ? 'actif' : ''} onClick={() => setMode('carte')}>
          💳 Carte
        </button>
      </div>

      {mode === 'especes' ? (
        <>
          <div className="raccourcis">
            {raccourcis(total).map((m) => (
              <button key={m} className={`puce ${recu === m ? 'active' : ''}`} onClick={() => setSaisie(enSaisie(m))}>
                {m === total ? 'Compte juste' : euros(m)}
              </button>
            ))}
          </div>

          <div className="especes-ecran">
            <div>
              <span>Reçu</span>
              <strong>{saisie ? `${saisie} €` : '—'}</strong>
            </div>
            <div className={recu >= total ? 'rendu-ok' : recu > 0 ? 'rendu-manque' : ''}>
              <span>{recu >= total ? 'À rendre' : 'Manque'}</span>
              <strong>{recu > 0 ? euros(Math.abs(recu - total)) : '—'}</strong>
            </div>
          </div>

          <div className="pave">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((t) => (
              <button key={t} onClick={() => touche(t)} aria-label={t === '⌫' ? 'Effacer' : t}>
                {t}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="carte-consigne">
          Saisissez <strong>{euros(total)}</strong> sur le terminal de paiement, puis validez une fois le paiement accepté.
        </p>
      )}

      {erreur && <p className="message-erreur">{erreur}</p>}

      <button className="bouton principal large" onClick={valider} disabled={!suffisant || envoi}>
        {envoi ? 'Enregistrement…' : mode === 'carte' ? 'Paiement carte accepté' : 'Valider l’encaissement'}
      </button>
    </Modale>
  );
}
