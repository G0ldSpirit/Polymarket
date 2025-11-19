# Polymarket Trader Stats 📊

Application web pour analyser les statistiques des traders Polymarket.

## 🚀 Déploiement Rapide sur Vercel (GRATUIT - 5 minutes)

### Étape 1 : Organiser les fichiers

Crée un dossier `polymarket-stats` et organise les fichiers comme ceci :

```
polymarket-stats/
├── index.html          (renommer 1-index.html)
├── vercel.json         (renommer 3-vercel.json)
├── package.json        (renommer 4-package.json)
└── api/
    └── trader.js       (renommer 2-trader.js et mettre dans dossier api/)
```

**IMPORTANT :** 
- Renomme `1-index.html` → `index.html`
- Renomme `3-vercel.json` → `vercel.json`
- Renomme `4-package.json` → `package.json`
- Crée un dossier `api/` et mets `2-trader.js` dedans en le renommant `trader.js`

### Étape 2 : Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com)
2. Clique "Sign Up" et connecte-toi avec GitHub, GitLab ou Email
3. Clique "Add New Project"
4. Clique "Browse" ou drag & drop ton dossier `polymarket-stats`
5. Clique "Deploy"
6. ✅ Ton site sera en ligne en 2 minutes !

Tu recevras une URL comme : `https://polymarket-stats.vercel.app`

## 📊 Fonctionnalités

✅ Recherche par pseudo (ex: blubberbuster)
✅ Recherche par adresse (ex: 0x123...)
✅ Win Rate
✅ Total Positions
✅ Positions Fermées/Actives
✅ Wins/Losses
✅ Profit Total & Moyen
✅ Volume Total

## 🛠️ Structure des Fichiers

```
1-index.html     → Page web principale (RENOMMER en index.html)
2-trader.js      → API backend (RENOMMER en trader.js et mettre dans api/)
3-vercel.json    → Configuration Vercel (RENOMMER en vercel.json)
4-package.json   → Dépendances (RENOMMER en package.json)
```

## ⚠️ Important

Ce projet NÉCESSITE un backend pour fonctionner à cause des restrictions CORS de l'API Polymarket. Il ne fonctionnera pas en ouvrant simplement le fichier HTML localement.

## 🎯 Pourquoi Vercel ?

- ✅ 100% Gratuit
- ✅ Déploiement en 2 minutes
- ✅ HTTPS automatique
- ✅ Backend serverless inclus
- ✅ Pas de carte bancaire requise

## 🆘 Besoin d'aide ?

Si tu as des problèmes :
1. Vérifie que tous les fichiers sont bien nommés (sans les numéros)
2. Vérifie que `trader.js` est dans un dossier `api/`
3. Assure-toi d'avoir déployé sur Vercel (pas en local)
