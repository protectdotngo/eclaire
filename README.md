# Éclaire

Annuaire de l'inclusion numérique à Genève, avec carte interactive, assistant
conversationnel et calendrier d'événements.

> Nom de code du dépôt / de l'image : **`micropachycephalosaurus`**
> Production : **https://eclaire.protect.ngo**

Éclaire recense les organisations, associations et ateliers d'inclusion
numérique du canton de Genève et aide le public à s'y orienter de trois façons :
une **carte** (Leaflet), un **assistant conversationnel** en langue naturelle
(adossé à un LLM), et un **calendrier** d'événements. Le contenu est alimenté
par un scraping automatisé (n8n) et stocké dans PostgreSQL.

Principe central : **l'assistant ne rédige pas les réponses factuelles.** Le LLM
agit comme un planificateur de requêtes — il renvoie des identifiants d'orgs et
des filtres de recherche, et le backend va chercher les données réelles en base.
Pas d'hallucination possible sur les dates, lieux ou contenus.

## Pile technique

Astro 7 (SSR Node) · SolidJS (îlots) · nanostores · Leaflet ·
Drizzle ORM · PostgreSQL (Scaleway « pgvector ») · Qwen3 235B (via l'API
Scaleway). Déploiement : Docker → Helm → ArgoCD (Kubernetes).

## Prérequis

- **Node ≥ 22.12**
- **pnpm** (gestionnaire de paquets du projet)
- Accès à une base PostgreSQL peuplée et, pour tester le chat, à l'API LLM
  Scaleway (voir Configuration).

## Démarrage rapide

```bash
pnpm install
cp .env.example .env   # puis renseigner les variables (voir ci-dessous)
pnpm dev               # http://localhost:4321
```

> Sans `SCW_API_LLM_LNK` + `SCW_API_KEY`, l'application démarre mais
> `/api/chat` renvoie `500 « Chat is not configured »`. Le reste du site
> (carte, calendrier) fonctionne tant que les variables `SCW_DB_*` pointent
> vers une base peuplée.

## Scripts

| Commande            | Rôle                                                 |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Serveur de développement (`localhost:4321`)          |
| `pnpm build`        | Build de production dans `./dist`                    |
| `pnpm preview`      | Prévisualise le build                                |
| `pnpm check`        | `astro check` (typage)                               |
| `pnpm format`       | `prettier --write`                                   |
| `pnpm format:check` | Vérifie le formatage sans écrire                     |
| `pnpm delete-org`   | Supprime une org et ses données (dry-run par défaut) |

## Configuration

Variables chargées via `dotenv` (fichier `.env` en local ; ConfigMap + Secrets
Helm en production).

| Variable             | Sensible | Rôle                                                |
| -------------------- | -------- | --------------------------------------------------- |
| `SCW_DB_HOST`        | non      | Hôte PostgreSQL (endpoint privé en prod)            |
| `SCW_DB_PORT`        | non      | Port PostgreSQL                                     |
| `SCW_DB_NAME`        | non      | Nom de la base                                      |
| `SCW_DB_USER`        | oui      | Utilisateur applicatif                              |
| `SCW_DB_PASS`        | oui      | Mot de passe DB                                     |
| `SCW_API_LLM_LNK`    | non      | Endpoint chat completions Scaleway (Qwen 235B)      |
| `SCW_API_LNK`        | non      | Endpoint embeddings Scaleway (vestige, cf. doc)     |
| `SCW_API_KEY`        | oui      | Clé API Scaleway                                    |
| `N8N_WEBHOOK_URL`    | —        | Notification des nouvelles propositions (optionnel) |
| `N8N_WEBHOOK_SECRET` | oui      | Secret du webhook n8n                               |

## Structure du projet

```
src/
├── pages/          Routes .astro + endpoints /api (chat, dataInit,
│                   dataFilter, dataEvents, propose, prompt)
├── components/      Composants UI (Map, Calendar, SidePanel, ProposalForm…)
├── lib/             Logique métier (dbDrizzle, chatPrompt, orgCandidates,
│                   chatValidation, contrôleurs client, prompts/)
├── interfaces/      Types TypeScript
├── data/            Taxonomie (audienceTags, calendarConfig)
└── layouts/         BaseLayout, MainLayout
drizzle/             Schéma, relations, migrations SQL
helm/ · argocd/      Déploiement Kubernetes
```

## Pages principales

- `/` — carte + panneau de recherche conversationnel (accueil)
- `/calendrier` — calendrier des événements
- `/proposer` — formulaire de proposition d'organisation
- `/sous-le-capot` — page technique publique
- `/prompt` — éditeur du prompt système du chat (protégé par Cloudflare Access)

## Bon à savoir avant de contribuer

- **Le prompt du chat s'édite en prod via `/prompt`, pas dans le code.** Une
  fois qu'une version existe en base, modifier `src/lib/prompts/chatSystemPrompt.md`
  ne change plus rien en production — ce fichier n'est qu'un fallback.
- **La taxonomie (catégories, audiences) est dupliquée** entre la validation du
  chat, le prompt et la config du calendrier. Toute modification doit être
  propagée partout, casse et accents compris.
- **Le champ `city` fait autorité** pour le filtrage géographique (jamais le
  `desc`).
- Le schéma DB est **introspecté** depuis une base existante (le scraping crée
  les tables) ; les fichiers `drizzle/*.sql` servent de référence.

## Documentation

Pour l'architecture détaillée, le modèle de données, le fonctionnement de
l'assistant, le déploiement et les points de maintenance, voir
**[`documentation.md`](./documentation.md)**.
