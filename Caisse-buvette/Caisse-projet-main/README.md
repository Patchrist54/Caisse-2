# Caisse Buvette

Caisse tactile pour buvette, utilisable sur **téléphone ou tablette Android et iPhone/iPad** depuis le navigateur,
et installable sur l'écran d'accueil comme une application.

- **Backend** : Node.js / Express (TypeScript), base **SQLite** (`sql.js`, aucune compilation native)
- **Frontend** : React + Vite (TypeScript), interface responsive téléphone / tablette

## Fonctions

| Écran      | Contenu |
|------------|---------|
| **Caisse** | 15 produits en 4 catégories, ajout d'un toucher, panier (+/−), stock affiché (« Reste 8 », « Épuisé ») |
| **Encaissement** | Espèces : raccourcis (compte juste, 10 €, 20 €…) + pavé numérique, **rendu de monnaie** calculé. Carte : validation après TPE. Ticket de confirmation |
| **Ventes** | Ventes du jour (ou des jours précédents), **annulation** avec remise en stock |
| **Bilan**  | Chiffre d'affaires, nombre de ventes, panier moyen, espèces / carte, ventes par produit, tendance 7 jours |

Les prix et totaux sont **toujours recalculés par le serveur** : le téléphone n'envoie que les produits et quantités.

## Démarrage

```bash
npm install      # installe tout (racine, backend, frontend)
npm run dev      # lance backend + frontend
```

Au démarrage, le terminal affiche l'adresse Wi-Fi de la caisse et un **QR code**.

## Tester sur téléphone (Android / iPhone)

1. Le téléphone doit être sur **le même réseau Wi-Fi** que le PC.
2. **Scannez le QR code** affiché dans le terminal avec l'appareil photo,
   ou tapez l'adresse `http://<IP-du-PC>:5173` dans le navigateur.
3. Sous Windows, au premier lancement, **autorisez Node.js sur les réseaux privés** dans la fenêtre du pare-feu
   (sinon le téléphone ne peut pas se connecter).
4. Les modifications du code s'affichent immédiatement sur le téléphone (rechargement à chaud).

### Ajouter l'icône sur l'écran d'accueil

- **iPhone / iPad (Safari)** : bouton Partager → **« Sur l'écran d'accueil »**. L'application s'ouvre ensuite en plein écran, sans barre d'adresse.
- **Android (Chrome)** : menu ⋮ → **« Ajouter à l'écran d'accueil »**.

> En réseau local (`http://`), Android crée un raccourci qui s'ouvre dans Chrome. Pour une installation
> complète en plein écran sur Android, l'application devra être servie en HTTPS (étape de déploiement).

## Mode production (un seul port)

```bash
npm run prod     # compile tout et sert l'interface + l'API sur le port 3000
```

Adresse à ouvrir : `http://<IP-du-PC>:3000` (QR code affiché dans le terminal).

## Base de données de démonstration

Créée automatiquement au premier démarrage dans `backend/data/caisse.sqlite` :

- **4 catégories, 15 produits** (café, thé, chocolat, vin chaud, eau, Coca-Cola, Orangina, jus de pomme,
  bière, hot-dog, sandwich, croque-monsieur, frites, crêpe, gaufre)
- quelques stocks pour tester les alertes : sandwich (8 restants), gaufre (épuisée)…
- **7 jours de ventes fictives** (environ 250 ventes, espèces et carte, quelques annulations)

Pour repartir de zéro : bouton **« Réinitialiser les données de démonstration »** en bas de l'écran Bilan,
ou `npm run reinitialiser` (serveur arrêté).

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET  | `/api/catalogue` | catégories et produits actifs |
| POST | `/api/ventes` | enregistre une vente `{ lignes: [{ produitId, quantite }], modePaiement: "especes" \| "carte", montantRecu? }` (centimes) |
| GET  | `/api/ventes?jour=AAAA-MM-JJ` | ventes d'une journée |
| POST | `/api/ventes/:id/annuler` | annule une vente et remet le stock |
| GET  | `/api/bilan?jour=AAAA-MM-JJ` | bilan de la journée + 7 jours |
| POST | `/api/admin/reinitialiser` | régénère la base de démonstration |

Tous les montants sont en **centimes** (entiers) pour éviter les erreurs d'arrondi.

## Structure

```
backend/src/
  server.ts   routes de l'API, service de l'interface compilée
  db.ts       accès SQLite, transactions, sauvegarde atomique sur disque
  seed.ts     schéma + données fictives (15 produits, 7 jours de ventes)
  reseau.ts   adresses Wi-Fi + QR code pour les téléphones
frontend/src/
  App.tsx           navigation, panier, notifications
  Caisse.tsx        grille de produits + panier
  Encaissement.tsx  paiement espèces / carte, ticket
  Ventes.tsx        liste des ventes, annulation
  Bilan.tsx         statistiques
frontend/public/    icônes et manifeste (installation Android / iOS)
```

## Configuration

- `PORT` : port du backend (3000 par défaut)
- `BACKEND_URL` : cible du proxy Vite en développement (`http://localhost:3000` par défaut)
