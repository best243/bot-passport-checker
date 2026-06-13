# OpenTravel — Passport Power Checker (bot Messenger)

Bot Facebook Messenger pour la page **OpenTravel** : un utilisateur indique sa
nationalité, le bot renvoie une infographie partageable montrant la "puissance"
de son passeport (nombre de pays accessibles sans visa, eVisa, visa à
l'arrivée, ou visa requis), avec un bouton pour partager le résultat sur
Facebook.

## 1. Structure du projet

```
bot-passport-checker/
├── src/
│   ├── server.js          # Serveur Express : webhook Messenger + page de partage
│   ├── conversation.js     # Logique conversationnelle (flux, sessions)
│   ├── messenger.js         # Wrapper Send API (texte, boutons, images)
│   ├── passportService.js   # Récupération données passeport (API live + cache + démo)
│   ├── imageGenerator.js    # Génération de l'infographie (Canvas)
│   └── countries.js          # Normalisation des noms de pays (FR + fuzzy match)
├── data/
│   ├── mock-passports.json   # Données de démonstration (sans clé API)
│   └── requests.json         # Log des requêtes (généré, éphémère sur Render)
├── cache/                     # Cache 24h des données passeport (généré)
├── public/generated/          # Images générées (servies statiquement)
├── .env.example
├── package.json
└── README.md
```

## 2. Choix de l'API "Passport Index"

Le bot fonctionne **en mode démo sans aucune clé** grâce à
`data/mock-passports.json` (quelques pays africains + quelques pays occidentaux
pour tester le flux complet).

Pour des données réelles, configure une API "Passport Index" sur RapidAPI :

1. Va sur [RapidAPI](https://rapidapi.com) et recherche "Passport Index" ou
   "Travel Visa / Passport".
2. Abonne-toi au plan gratuit de l'API choisie.
3. Note le **Host** (ex: `xxx.p.rapidapi.com`) et ta **clé API**.
4. Renseigne `RAPIDAPI_KEY` et `RAPIDAPI_HOST` dans `.env`.
5. Ouvre `src/passportService.js`, fonction `mapApiResponse(raw, code)`, et
   adapte les noms de champs (`raw.xxx`) à la réponse réelle de l'API choisie
   (regarde un exemple de réponse dans la doc RapidAPI de l'API).
6. Si besoin, adapte aussi `RAPIDAPI_PASSPORT_PATH` (le `{code}` est remplacé
   par le code ISO2 du pays, ex: `CI`, `SN`, `FR`).

Si l'appel à l'API échoue (clé manquante, quota dépassé, erreur réseau), le
bot retombe automatiquement sur les données de démonstration — aucun crash.

Le cache (`cache/<CODE>.json`) évite de rappeler l'API plus d'une fois par 24h
pour un même pays.

## 3. Créer l'app Meta for Developers et configurer le webhook

1. Va sur [developers.facebook.com](https://developers.facebook.com) →
   **Mes apps** → **Créer une app** → type "Entreprise" (ou "Autre").
2. Dans le tableau de bord de l'app, ajoute le produit **Messenger**.
3. **Générer un token de page** :
   - Dans Messenger → Paramètres → "Génération de jetons d'accès"
   - Sélectionne la page Facebook **OpenTravel**
   - Copie le token généré → mets-le dans `.env` comme `PAGE_ACCESS_TOKEN`
4. **Configurer le webhook** :
   - Choisis une chaîne secrète quelconque, ex `opentravel-passport-verify`,
     mets-la dans `.env` comme `VERIFY_TOKEN`
   - Déploie d'abord le bot (étape 4) pour avoir une URL publique
   - Dans Messenger → Paramètres → Webhooks → "Ajouter une URL de rappel" :
     - URL de rappel : `https://<ton-app>.onrender.com/webhook`
     - Verify Token : la même valeur que `VERIFY_TOKEN`
     - Champs d'abonnement (webhooks fields) : coche au minimum
       `messages`, `messaging_postbacks`
   - Abonne la page **OpenTravel** au webhook (dans la même section)
5. **Mode développement vs production** :
   - En mode développement, seuls les comptes ayant un rôle sur l'app
     (admin/développeur/testeur) peuvent utiliser le bot.
   - Pour ouvrir le bot à tout le monde, soumets l'app à la revue Meta pour
     la permission `pages_messaging` (App Review), ou passe l'app en mode
     "Live" si elle n'a pas besoin de permissions avancées.

## 4. Déploiement sur Render (gratuit)

### Option A — Blueprint (`render.yaml`, recommandé)

1. Pousse ce dossier dans un dépôt Git (GitHub/GitLab).
2. Sur [render.com](https://render.com) → **New** → **Blueprint** → relie ton
   dépôt. Render détecte `render.yaml` et propose de créer le service
   `opentravel-passport-checker` automatiquement.
3. Render demandera les variables marquées `sync: false`
   (`PAGE_ACCESS_TOKEN`, `VERIFY_TOKEN`, `RAPIDAPI_KEY`, `RAPIDAPI_HOST`) —
   renseigne-les (les clés RapidAPI peuvent rester vides pour le mode démo).
4. `BASE_URL` est préréglée sur `https://opentravel-passport-checker.onrender.com`.
   Si tu renommes le service dans `render.yaml`, mets à jour `BASE_URL` en conséquence.

### Option B — Configuration manuelle

1. Pousse ce dossier dans un dépôt Git (GitHub/GitLab).
2. Sur [render.com](https://render.com) → **New** → **Web Service** → relie
   ton dépôt.
3. Configuration :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment** : Node
4. Ajoute les variables d'environnement (Render → Environment) en reprenant
   `.env.example` :
   - `PAGE_ACCESS_TOKEN`
   - `VERIFY_TOKEN`
   - `BASE_URL` = l'URL Render attribuée (ex: `https://opentravel-passport.onrender.com`)
   - `RAPIDAPI_KEY` / `RAPIDAPI_HOST` / `RAPIDAPI_PASSPORT_PATH` (optionnels)
5. Déploie. Une fois en ligne, configure le webhook Meta avec l'URL Render
   (étape 3 ci-dessus).

> ⚠️ Le plan gratuit Render met le service en veille après inactivité (la
> première requête après veille peut prendre ~30s) et le système de fichiers
> est éphémère (le cache et les images générées sont perdus à chaque
> redéploiement/redémarrage — ce n'est pas grave, ils se régénèrent).

## 5. Configurer le bouton "Get Started" et le message d'accueil (optionnel)

Une fois `PAGE_ACCESS_TOKEN` disponible, exécute une fois (remplace `<TOKEN>`) :

```bash
curl -X POST "https://graph.facebook.com/v19.0/me/messenger_profile?access_token=<TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "get_started": { "payload": "GET_STARTED" },
    "greeting": [
      { "locale": "default", "text": "Bienvenue sur OpenTravel ! Découvrez où votre passeport peut vous emmener." }
    ]
  }'
```

## 6. Tester le flux complet

1. En local : `npm install` puis `npm start` (utilise les données de démo si
   pas de clé RapidAPI).
2. Sur la page Facebook OpenTravel, clique "Envoyer un message" → "Démarrer".
3. Tape le nom d'un pays (ex: "Côte d'Ivoire", "Sénégal", "Cameroun") :
   - Le bot répond avec un résumé texte
   - Puis envoie l'infographie générée
   - Puis propose "Partager sur Facebook" et "Vérifier un autre passeport"
4. Le bouton "Partager sur Facebook" ouvre le dialogue de partage natif avec
   l'infographie en aperçu (grâce aux balises Open Graph de `/share/:code/:filename`).
5. Teste une faute de frappe (ex: "camerou") → le bot doit corriger
   automatiquement vers "Cameroun".
6. Teste un mot non reconnu (ex: "xyzabc") → le bot propose des suggestions.

## 7. Limites / bonnes pratiques Meta

- Aucun spam : le bot ne répond qu'aux messages reçus (pas d'envoi non
  sollicité après 24h sans interaction, conformément à la politique Messenger).
- Tout le contenu est en français, sans emoji dans l'interface.
- Les données de mobilité sont mises en cache 24h pour limiter les appels API.
