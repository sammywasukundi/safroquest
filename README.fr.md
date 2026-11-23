# SafroQuest

**Apprends Safrochain. Prouve-le. Aide à la construire.**

Jeu gratuit et open source qui transforme la documentation de Safrochain en quêtes, rangs et badges.
Projet communautaire indépendant, pas un produit officiel de Safrochain. Documentation complète en anglais : [README.md](README.md).

## Lancer sur votre PC

Prérequis : Node.js 20+, npm, Git.

```bash
git clone https://github.com/sammywasukundi/safroquest.git
cd safroquest
npm install
npm run dev
```

Ouvrez <http://localhost:5173>. En développement, **le premier compte créé devient administrateur** (Réglages, puis « Ouvrir le back-office »).

- Tests : `npm test` (16 tests), types : `npm run typecheck`, build : `npm run build`.
- Guide de test complet (téléphone, wallets, Windows/WSL) : [docs/TESTING.md](docs/TESTING.md).
- Périmètre et limites de la V1 : [docs/V1-SCOPE.md](docs/V1-SCOPE.md). Wallets : [docs/WALLETS.md](docs/WALLETS.md). Notifications : [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md).

## Points clés

- Création de compte avec un wallet de **12 ou 24 mots** généré sur l'appareil, protégé par un PIN. La phrase n'est jamais envoyée au serveur.
- Connexion par signature d'un défi (sans mot de passe) avec Keplr, Leap, Cosmostation, EightSaf, Zunia ou le wallet intégré.
- Questions sans répétition sur 10 tentatives, XP, niveaux, rangs, quête du jour, classement, quête de contribution (traduction).
- Back-office pour ajouter des quêtes, interface en français et anglais, thèmes clair et sombre.
- Le contrat CosmWasm `contracts/quest-registry` n'a **pas encore été compilé** : lancez `cargo test` avant tout usage.

Licence MIT.
