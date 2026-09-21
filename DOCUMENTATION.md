# Éclaire — Documentation technique

_Annuaire de l'inclusion numérique à Genève & assistant conversationnel_

> Nom de code du dépôt / de l'image : **`micropachycephalosaurus`**
> Domaine de production : **https://eclaire.protect.ngo**
> Mainteneur : **Protect.ngo**

---

## 1. Vue d'ensemble

Éclaire est une application web qui recense les organisations, associations et
ateliers d'**inclusion numérique** actifs dans le canton de Genève, et qui aide
le public à s'y orienter. Elle combine trois modes d'accès à un même annuaire :

1. **Une carte interactive** (Leaflet) qui géolocalise les organisations et
   permet un filtrage par catégorie et par commune.
2. **Un assistant conversationnel** en langue naturelle, adossé à un LLM, qui
   traduit une question (« ateliers smartphone pour seniors à Carouge cette
   semaine ») en une recherche structurée sur la base de données.
3. **Un calendrier d'événements** agrégés automatiquement depuis les sites des
   organisations partenaires.

Le contenu de l'annuaire (organisations, événements, actualités) est alimenté
par un **scraping automatisé** orchestré hors du dépôt applicatif (workflows
n8n), et stocké dans une base PostgreSQL managée.

Un principe de conception guide toute l'application : **l'assistant ne rédige
jamais lui-même les réponses factuelles.** Il agit comme un _planificateur de
requêtes_ — il choisit des identifiants d'organisations et des filtres de
recherche, et c'est le backend qui va chercher les données réelles en base.
Cela élimine par construction les hallucinations sur les dates, les lieux et les
contenus.

---

## 2. Pile technique

| Couche              | Technologie                                                         | Rôle                                                    |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Framework           | **Astro 7** (`output: "server"`, adaptateur Node standalone)        | Rendu hybride SSR + endpoints API                       |
| Réactivité client   | **SolidJS** (îlots Astro `client:load`, contextes typés)            | Interactivité par îlot, hydratée à la demande           |
| État partagé client | **nanostores** (+ `@nanostores/solid`)                              | Bus entre îles (données carte) et Leaflet               |
| Cartographie        | **Leaflet** + `leaflet.markercluster`                               | Carte interactive et regroupement de marqueurs          |
| Calendrier          | **flatpickr**                                                       | Sélecteur de date des filtres du calendrier             |
| Rendu Markdown      | **marked**                                                          | Formatage des messages de l'assistant                   |
| Base de données     | **PostgreSQL** (instance Scaleway managée « pgvector », fr-par)     | Organisations, événements, actualités, prompt           |
| ORM                 | **Drizzle ORM** + `drizzle-kit`                                     | Accès typé, migrations                                  |
| Pilote SQL          | **node-postgres (`pg`)**                                            | Connexion PostgreSQL                                    |
| LLM                 | **Qwen3 235B** (`qwen3-235b-a22b-instruct-2507`) via l'API Scaleway | Planification de requêtes en JSON                       |
| Scraping            | **n8n** (workflows hébergés hors dépôt)                             | Collecte automatisée du contenu                         |
| Conteneur           | **Docker** (base Alpine, `pnpm`)                                    | Image de déploiement                                    |
| Déploiement         | **Helm** + **ArgoCD** sur Kubernetes                                | Livraison continue                                      |
| Accès protégé       | **Cloudflare Access**                                               | Seule protection des pages `/prompt` et `/verification` |

### Conventions des îlots SolidJS

Toute l'interactivité client vit dans des **îlots** : un composant Solid racine
monté par une coquille `.astro`. La règle par feature :

- **Une île, un contexte.** La racine construit son état et le fournit via un
  `sections/<feature>/…Context.ts` typé ; les sous-composants le consomment avec
  un `use…()` qui lève une erreur hors de l'île. Pas de props traversant trois
  niveaux, et surtout plus de portée implicite comme avec `x-data`.
- **`client:load` partout.** Les îles chargent leurs données au montage, et
  `client:visible` serait un piège : `SidePanel.astro` masque `.map-search` en
  `display:none` quand la carte est recentrée sur mobile, et un sous-arbre
  masqué n'intersecte jamais — l'île ne s'hydraterait pas.
- **Tout accès navigateur dans `onMount`.** Les îles sont rendues au SSR
  (`output: "server"`) : `window`, `document`, `flatpickr`, `ResizeObserver` et
  `getBoundingClientRect` hors `onMount` cassent le build, et ça ne se voit
  qu'au `pnpm build`, pas en `pnpm dev`.
- **CSS Modules co-localisés**, un `Composant.module.css` par composant. Le
  scoping d'Astro ne franchit pas la frontière d'une île (son `data-astro-cid`
  n'est posé que sur le DOM rendu par Astro), et 37 noms de classes du projet
  étaient définis dans plusieurs blocs `<style>`, parfois avec des valeurs
  différentes. Deux exceptions volontairement **non hachées** : `hero-root`
  (visé par le `:not()` de `Technical.astro`) et `map-search` (visé par
  `SidePanel.astro`). Une classe sans aucune règle CSS reste littérale, pour ne
  pas changer le DOM.
- **SVG en `?raw`** via `src/components/icons/Icon.tsx`. L'import `.svg` par
  défaut d'Astro renvoie un composant Astro, inutilisable depuis du JSX Solid ;
  le SVG reste inline pour que `stroke="currentColor"` continue d'opérer.
- **nanostores uniquement pour le cross-île** (`$mapData` : chat ↔ filtres ↔
  Leaflet). ⚠️ L'atome est un singleton de module : depuis qu'une île SSR
  l'importe, il est partagé entre toutes les requêtes du process — le lire au
  SSR est sans risque, y **écrire** fuiterait d'un utilisateur à l'autre. Donc
  jamais de `$mapData.set()` hors `onMount` ou gestionnaire d'événement.

Node ≥ 22.12. Gestionnaire de paquets : **pnpm** (`pnpm-workspace.yaml` autorise
les builds natifs `esbuild` et `sharp`).

---

## 3. Architecture générale

```
                    ┌─────────────────────────────┐
   Sites des orgs ─►│  n8n (scraping, hors dépôt)  │
                    └──────────────┬──────────────┘
                                   │  écrit (scraping)
                                   ▼
              ┌────────────────────────────────────────┐
              │  PostgreSQL « pgvector » (Scaleway)      │
              │  schéma "test" :                         │
              │   orgs · events · news                   │
              │   orgs_events · orgs_news (jointures)    │
              │   propositions · prompt_config           │
              └───────────────┬────────────────────────┘
                              │ lit (endpoint privé)
                              ▼
     ┌──────────────────────────────────────────────────────┐
     │  Application Astro (SSR Node, conteneur)              │
     │                                                       │
     │  Pages .astro ─── Endpoints /api/*                    │
     │       │                 │                             │
     │       │                 ├─ /api/chat ──► LLM Scaleway │
     │       │                 │      (Qwen 235B)            │
     │       │                 ├─ /api/dataInit / dataFilter │
     │       │                 ├─ /api/dataEvents            │
     │       │                 ├─ /api/propose ──► webhook n8n│
     │       │                 └─ /api/prompt (édition)      │
     │       ▼                                               │
     │  Îlots SolidJS + Leaflet + flatpickr (client)        │
     └──────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS (ingress Traefik)
                         Utilisateur
```

### Le flux conversationnel en détail

1. Le client (`mapSearchController.ts`) envoie l'historique de conversation à
   **`POST /api/chat`**.
2. Le serveur construit le **prompt système** (`buildSystemPrompt`) :
   - un en-tête de _contexte temporel_ (date du jour, jour de la semaine) ;
   - le gabarit éditable (voir §6) ;
   - l'**annuaire complet des organisations** injecté en JSON à la place du
     placeholder `[Insère ici le contenu de l'annuaire en JSON]` ;
   - une section **candidats prioritaires** issue d'une présélection
     déterministe par mots-clés (`orgCandidates.ts`).
3. La requête est envoyée au LLM avec `response_format: json_object`,
   `temperature: 0.1`, `max_tokens: 2000`.
4. La réponse JSON est **parsée et validée** (`chatValidation.ts`) : on rejette
   les IDs fabriqués, on plafonne à 5 organisations, on borne les filtres à des
   valeurs autorisées, et on répare le JSON tronqué si nécessaire.
5. Le **périmètre thématique est appliqué côté serveur** (`enforceScope`) : si
   le modèle a signalé `off_topic`, ou si la réponse ne contient que du texte
   au-delà de 900 caractères, tous ses blocs sont remplacés par une redirection
   figée et la requête s'arrête là (aucune requête SQL). Voir §8.
6. Les organisations retenues sont **hydratées** depuis la base (données
   complètes + prochain événement à venir), et tout bloc `event_search` est
   exécuté en SQL.
7. Le résultat consolidé (blocs + orgs + événements) revient au client, qui
   l'affiche dans une _timeline_ et met à jour la carte.

Point clé : le LLM ne renvoie que des **identifiants** et des **filtres**. Les
noms, descriptions, dates et lieux affichés proviennent toujours de la base.

---

## 4. Modèle de données

Toutes les tables vivent dans le schéma PostgreSQL **`test`**. Source de
vérité : `drizzle/schema.ts`.

### `orgs` — organisations

| Colonne                         | Type             | Notes                                                     |
| ------------------------------- | ---------------- | --------------------------------------------------------- |
| `id`                            | uuid (PK)        |                                                           |
| `name`                          | text             | requis, unique                                            |
| `desc`                          | text             | requis — base de la pertinence du chat                    |
| `categories`                    | text[]           | requis — taxonomie (voir §5)                              |
| `domain`                        | text             | site web                                                  |
| `events_url`, `news_url`, `rss` | text             | sources de scraping                                       |
| `socials`, `contact`            | text[]           |                                                           |
| `address`, `city`               | text             | `city` = **vérité absolue** pour le filtrage géographique |
| `lat`, `lon`                    | double precision | positionnement sur la carte                               |
| `embedding`                     | vector(1024)     | _vestige_ de l'ancienne recherche vectorielle (voir §10)  |

### `events` — événements

| Colonne                        | Type         | Notes                     |
| ------------------------------ | ------------ | ------------------------- |
| `id`                           | uuid (PK)    |                           |
| `url`                          | text         | requis                    |
| `title`, `content`, `location` | text         |                           |
| `startDate`, `endDate`         | timestamp    | cœur du filtrage temporel |
| `categories`                   | text[]       |                           |
| `baseUrl`                      | text         |                           |
| `scrapedAt`                    | timestamp    |                           |
| `embedding`                    | vector(1024) | vestige vectoriel         |

### `news` — actualités

`id`, `url`, `title`, `content`, `pubDate`, `scrapedAt`, `embedding(1024)`.

### Tables de jointure (n-n)

- **`orgs_events`** (`org_id`, `event_id`) — clé primaire composite ;
  `event_id` en `ON DELETE CASCADE`.
- **`orgs_news`** (`org_id`, `news_id`) — clé primaire composite.

### `propositions` — soumissions du public

Alimentée par le formulaire « Proposer une organisation ». Champs de
soumission (`submitter_type`, `submitter_name`, `submitter_email`, `action`),
champs de l'organisation proposée (mêmes champs que `orgs`), et
`modifying_org_id` (FK vers `orgs`, `ON DELETE SET NULL`) pour les demandes de
modification d'une org existante. Champs de workflow : `approved` (défaut
`false`), `status` (`pending` → `published` / `rejected`), `original_submission`
(jsonb — la soumission d'origine), `admin_editor` et `admin_edited_at`
(qui a édité / publié / rejeté, et quand). Voir §7.

### `proposition_verifications` — contrôle automatique (n8n)

Une ligne par proposition contrôlée par le workflow n8n. `proposition_id` (FK
vers `propositions`, `ON DELETE CASCADE`), `legitimacy_score`
(numeric 3,1), `verdict`, `suspicious_changes` (jsonb — champs jugés suspects),
`confirmed_by_web` (text[] — champs confirmés en ligne), `notes`,
`processing_status`, `created_at`. Sert de base à la page `/verification`
(§7). Indexée sur `proposition_id` et `verdict`.

### `prompt_config` — prompt système éditable

`id`, `content` (text), `created_at` (timestamptz). **Append-only** : chaque
sauvegarde ajoute une ligne ; la dernière ligne est le prompt actif,
l'historique complet est conservé. Voir §6.

### Relations (`drizzle/relations.ts`)

`orgs` ←→ `events` et `orgs` ←→ `news` via les tables de jointure ;
`propositions` → `orgs` (org modifiée) ; `propositions` ←→
`proposition_verifications` (une proposition, plusieurs vérifications).

---

## 5. Taxonomie

Deux dimensions structurent l'annuaire. Elles sont dupliquées à plusieurs
endroits (validation serveur, config calendrier, prompt) : **toute
modification doit être répercutée partout**.

### Catégories (12) — `chatValidation.ts`, prompt, `calendarConfig.ts`

`inclusion & accessibilité numérique` · `formation numérique` ·
`formation générale` · `aide & soutien numérique` ·
`cybersécurité & prévention` · `action & aide sociale` ·
`aide matérielle & équipement` · `connectivité publique` ·
`associations & réseaux` · `institutions publiques` ·
`plateformes d'information` · `lieux d'accueil`

Les valeurs sont **sensibles à la casse et aux accents** — elles correspondent
à des tags exacts en base.

### Publics / audiences — `audienceTags.ts`

`jeunesse` · `seniors` · `femmes` · `personnes migrantes` · `handicap` ·
`emploi` · `intergénérationnel` · `tout public` · `adultes` · `à domicile`

> Note : la validation du chat (`AUDIENCE_VALUES`) n'accepte pas `adultes` ni
> `à domicile` ; ces deux tags n'existent que côté formulaire/calendrier.

### Regroupements d'affichage du calendrier — `calendarConfig.ts`

Les 12 catégories sont regroupées en 7 « buckets » colorés pour la vue
calendrier et la recherche par filtre sur la carte : _Apprentissage numérique_, _Aide numérique_, _Cybersécurité_,
_Vie sociale_, _Formation générale_, _Institutionnel_, _Autre_. Chaque bucket
définit des couleurs pour les thèmes clair et sombre.

---

## 6. L'assistant : prompt et planification de requêtes

### Le prompt système

Le prompt (`src/lib/prompts/chatSystemPrompt.md`) est long et normatif. Ses
règles principales :

- **4 types de sortie** (jamais mélangés, sauf exception « B+ ») :
  - **A** — question de clarification ou message d'aide (texte seul) ;
  - **B** — recherche d'événements (`event_search` avec filtres) ;
  - **C** — liste d'organisations (`orgs`, 1 à 5 items avec un `reason`).
  - **B+** — événements _plus_ 2-3 orgs en secours, réservé aux sujets précis.
  - **D** — demande hors périmètre numérique : un seul bloc `text` de refus
    poli, plus `"off_topic": true` à la racine, et aucune recherche déclenchée.
- **Maximum absolu de 5 organisations** par réponse.
- **Tutoiement** obligatoire, et **réponse dans la langue de l'utilisateur**
  (mais les valeurs de filtres restent en français car ce sont des tags DB).
- **Interdiction d'inventer des filtres** : un axe demandé = un filtre rempli,
  jamais de valeur « par défaut ».
- Le mot _événement_ (ou atelier, cours, conférence…) force une sortie B.
- **Périmètre thématique** (RÈGLE 9) : seules les demandes liées au numérique
  et aux technologies sont traitées. Cuisine, santé, météo, devoirs, traduction
  de texte, culture générale… → Sortie D. Le refus est ensuite **imposé côté
  serveur**, indépendamment de la docilité du modèle (voir §8).
- **Périmètre documentaire** : pas de recommandations commerciales, aucune
  entité hors annuaire.
- **Filtrage géographique** sur le champ `city` uniquement, jamais élargi
  automatiquement.
- Règles renforcées pour les **situations de victime** (harcèlement, arnaque) :
  exclure les orgs généralistes, rappeler le signalement et la police (117).

### Format de sortie du LLM

Deux champs à la racine encadrent les blocs : `lang` (`"fr" | "en" | "de" |
"it" | "es"`, la langue des blocs `text`) et `off_topic` (`true` uniquement
pour une Sortie D). Le serveur n'accorde aucune confiance à `lang` : il n'est
qu'une clé vers cinq messages figés côté serveur.

```json
{
  "off_topic": false,
  "lang": "fr",
  "blocks": [
    { "type": "text", "content": "..." },
    {
      "type": "event_search",
      "filters": { "date_from": "...", "city": "..." }
    },
    { "type": "orgs", "items": [{ "id": "<uuid>", "reason": "..." }] }
  ]
}
```

Combinaisons valides : `[text]`, `[text, event_search, text]`,
`[text, orgs, text]`, et `[text, event_search, text, orgs, text]` (B+).

### Filtres `event_search` supportés

`date_from`, `date_to` (ISO), `include_past` (booléen), `day_of_week` (0-6,
récurrence), `time_of_day` (`morning`/`afternoon`/`evening`), `categories[]`,
`keywords[]`, `city`, `org_ids[]`, `audience`, `offset` (pagination, 10
résultats par page).

Par défaut, une recherche ne retourne que les événements **en cours ou à
venir**. Ce plancher est appliqué côté serveur (`eventSearchWindow.ts`) et
`date_from` ne le lève PAS : les dates du modèle peuvent restreindre la
fenêtre, jamais l'élargir vers le passé. Seul `include_past: true` le lève —
les résultats sont alors triés du plus récent au plus ancien, et une fenêtre
sans `date_to` est bornée à aujourd'hui.

### Édition du prompt en production — page `/prompt`

- La page permet de **modifier le prompt système sans redéploiement**,
  consulter l'**historique des versions** et **restaurer** une version.
- Le prompt actif est lu depuis la table `prompt_config` (dernière ligne). Le
  fichier `.md` du dépôt n'est qu'un **défaut/fallback** : dès qu'une version
  existe en base, modifier le fichier ne change plus la production.
- Un **cache de 5 minutes** (`chatPrompt.ts`, `TTL`) sert le prompt et
  l'annuaire ; une sauvegarde invalide le cache immédiatement sur le pod qui
  enregistre, mais les autres pods rattrapent au bout de 5 min.
- Contrainte de validation : le contenu doit dépasser 100 caractères et
  **contenir le placeholder** `[Insère ici le contenu de l'annuaire en JSON]`.
- **La page `/prompt` n'a aucune authentification applicative** — elle est
  protégée uniquement par **Cloudflare Access**. Si Access tombe, la page
  devient publiquement éditable.

> Règle d'or pour éditer le prompt : le modèle suit davantage les **exemples**
> que les règles. Pour changer un comportement, modifier toutes les
> occurrences dans les exemples, pas seulement l'énoncé de la règle.

---

## 7. Vérification et publication des propositions

Le public peut soumettre une organisation (nouvelle ou une modification d'une
org existante) via le formulaire `/proposer`, qui écrit une ligne dans
`propositions` (voir §4). Un **workflow n8n** contrôle ensuite automatiquement
chaque soumission et écrit une ligne dans `proposition_verifications` :
un score de légitimité, un verdict, et deux listes de champs — ceux qu'il a pu
**confirmer sur le web** et ceux qu'il juge **suspects**. La page d'admin
`/verification` permet à un membre de l'équipe de relire ce travail, de
corriger les champs, puis de **publier** ou **rejeter** la proposition.

Comme `/prompt`, la page n'a **aucune authentification applicative** : elle
dépend entièrement de Cloudflare Access. Contrairement à `/prompt`, elle écrit
dans la table `orgs` de production — la protection d'accès est donc d'autant
plus critique.

### Fichiers

- `src/pages/verification.astro` — la coquille de page (monte l'îlot).
- `src/components/verification/` — l'îlot Solid (liste, détail, champ, infobulle).
- `src/lib/verificationState.ts` — l'état et les fonctions pures.
- `src/pages/api/verifications.ts` — l'API (liste, détail, save, publish,
  reject).
- `src/interfaces/verification.ts` — types partagés et la liste des champs
  éditables d'une org (`ORG_FIELDS`, `ARRAY_FIELDS`).

### La page (îlot SolidJS)

La page est une coquille `.astro` qui monte un unique îlot
(`<Verification client:load />`). L'état vit dans
`src/lib/verificationState.ts` — comme `calendarState.ts` et
`proposalFormState.ts` — et les sous-composants le consomment via un contexte
Solid typé. L'îlot possède à la fois la liste et le formulaire :

- **Liste** — des cartes (une par proposition à traiter) reprenant le style de
  `FilteredOrgList` : nom, badge d'action (nouvelle org / modification), score,
  verdict, email du soumetteur. Cliquer sur une carte charge le détail.
- **Formulaire** — un champ par champ éditable de l'org, pré-rempli depuis la
  proposition. Le libellé d'un champ **confirmé** s'affiche en **vert**, celui
  d'un champ **suspect** en **rouge** ; une icône « ? » à côté explique quoi
  faire (vert : rien de suspect trouvé, une vérification de confirmation reste
  conseillée ; rouge : vérifier soigneusement avant publication).
- L'admin doit renseigner son **email** (`admin_editor`) avant toute action ;
  il est validé côté client et côté serveur.
- Sur mobile, quand un formulaire est ouvert, la liste passe **sous** le
  formulaire.

### Actions et sémantique serveur

Toutes passent par `POST /api/verifications` avec `verificationId`,
`adminEditor`, et selon le cas `fields` / `publish` / `reject`. Chaque action
horodate l'édition (`admin_editor`, `admin_edited_at`).

- **Enregistrer** — persiste les corrections de l'admin sur la ligne
  `propositions`. Rien n'est publié.
- **Publier** — persiste d'abord les corrections, puis :
  - action `modify` : met à jour **uniquement les champs modifiés** de l'org
    référencée (comparaison champ par champ avec les valeurs actuelles de
    l'org) ;
  - action `add` (ou absente) : **insère une nouvelle org** (nom, description
    et au moins une catégorie sont obligatoires).
  - Dans les deux cas, la proposition passe en `status = 'published'`,
    `approved = true`.
- **Rejeter** — passe la proposition en `status = 'rejected'`,
  `approved = false`. Aucune écriture sur `orgs`, aucun champ appliqué.

### Ce que la liste affiche

`GET /api/verifications` ne renvoie que les propositions **à traiter** : celles
qui ont une ligne de vérification, dont le `verdict` n'est pas `rejected`, et
dont le `status` n'est ni `published` ni `rejected`. Publier ou rejeter fait
donc naturellement disparaître l'item de la liste. `GET /api/verifications?id=`
renvoie le détail complet d'une vérification pour le formulaire.

> Le champ `city` reste la vérité géographique (comme partout ailleurs), et la
> taxonomie appliquée à la publication d'une nouvelle org doit respecter les
> catégories de §5.

---

## 8. Endpoints API

Tous sous `src/pages/api/`. Réponses en JSON.

| Endpoint             | Méthode  | Rôle                                                                                                                                                                                                                                    |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/chat`          | POST     | Cœur conversationnel : prompt → LLM → validation → hydratation → recherche d'événements. Corps : `{ messages: ChatMsg[] }`.                                                                                                             |
| `/api/dataInit`      | GET      | Liste complète des organisations (pour la carte et le formulaire).                                                                                                                                                                      |
| `/api/dataFilter`    | POST     | Filtre les orgs par `category` et/ou `location` (form-data).                                                                                                                                                                            |
| `/api/dataEvents`    | GET      | Événements **du numérique uniquement** (voir §Filtre numérique) ; `?org=<uuid>` pour une org, `?all=true` pour tout l'historique (sinon à partir du mois courant), `?scope=all` pour lever le filtre thématique. Valide le format UUID. |
| `/api/propose`       | POST     | Enregistre une `proposition` ; notifie n8n via webhook si configuré.                                                                                                                                                                    |
| `/api/prompt`        | GET/POST | Lit/écrit le prompt système et son historique.                                                                                                                                                                                          |
| `/api/verifications` | GET/POST | GET : liste des propositions à traiter, ou `?id=` pour le détail. POST : enregistrer / publier / rejeter une proposition (voir §7).                                                                                                     |

**Validation notable côté chat** (`chatValidation.ts`) :

- IDs d'organisations inexistants → comptés comme « fabriqués » et écartés.
- Max 5 items par bloc `orgs`.
- Catégories/audiences/`time_of_day` bornées à des listes fermées.
- `date_from`/`date_to` validées par regex `YYYY-MM-DD`.
- Réparation d'un JSON tronqué (`tryRepairTruncatedJson`) : ferme proprement le
  tableau `blocks` au dernier item complet.
- Garantie d'un premier bloc `text` (`ensureLeadingText`).
- **Application du périmètre thématique** (`enforceScope`, EC-38), deux
  déclencheurs indépendants :
  - `model_signal` — le modèle a mis `"off_topic": true`. C'est le chemin
    fiable, et le seul qui attrape un hors-sujet **court** (une liste de
    cocktails fait ~120 caractères, invisible pour toute heuristique de
    longueur).
  - `text_too_long` — réponse composée uniquement de texte au-delà de
    `MAX_TEXT_ONLY_CHARS` (900). Filet de sécurité si le modèle ignore la règle
    et rédige une recette ou une dissertation sans la signaler. Repère : le plus
    long texte légitime du prompt (message d'orientation RÈGLE 4) fait 433
    caractères.

  Dans les deux cas, **tous** les blocs du modèle sont jetés et remplacés par
  une redirection figée dans la langue déclarée : aucune prose du modèle
  n'atteint l'utilisateur. Chaque déclenchement est journalisé
  (`[chat] scope redirect (…)`) — c'est la seule visibilité disponible, faute
  d'outillage analytique.

---

## 9. Présélection déterministe des organisations

`src/lib/orgCandidates.ts` calcule, **avant** l'appel au LLM, une liste courte
d'organisations candidates à partir des mots de la question, et l'injecte dans
le prompt (« CANDIDATS PRIORITAIRES »). But : diriger l'attention du modèle.

- **Sans perte** : l'annuaire complet reste fourni. Si la présélection rate une
  correspondance, le comportement est identique à l'absence de présélection —
  jamais pire.
- Normalisation (minuscules, sans accents, ponctuation → espaces), retrait des
  mots vides, filtrage des mots < 4 caractères.
- **Groupes de synonymes thématiques** : un déclencheur dans la question
  (`harcel`, `arnaque`, `senior`, `emploi`, `migrant`, `handicap`…) élargit la
  recherche à des termes liés dans les descriptions.
- **Correspondance floue** tolérante aux fautes (distance de Levenshtein bornée
  avec sortie anticipée).
- Score pondéré : `name` (×2) > `desc` / `categories` (×1). On garde jusqu'à 8
  candidats ; si le meilleur score < 2, on considère que c'est du bruit lexical
  et on n'injecte rien.

---

## 10. Historique : la recherche vectorielle abandonnée

À l'origine, la recherche d'organisations reposait sur des **embeddings
vectoriels** : chaque description était convertie en vecteur de 1024 dimensions
et les requêtes comparées par similarité cosinus (extension `pgvector`).

Cette approche gérait bien le sémantique flou mais s'est révélée **moins
adaptée aux requêtes structurées** (« événements à Carouge mardi prochain »,
« ateliers pour seniors ») qui dominent les usages réels. L'architecture
actuelle — l'assistant comme planificateur de requêtes — donne de meilleurs
résultats sur ces cas et reste plus simple à maintenir.

Traces subsistantes : les colonnes `embedding vector(1024)` sur `orgs`,
`events`, `news`, et l'endpoint d'embeddings Scaleway (`SCW_API_LNK`) présent
dans la configuration. Le code de l'approche vectorielle reste consultable dans
l'historique Git.

---

## 11. Structure du dépôt

```
├── astro.config.mjs         # config Astro (SSR Node, polices, sécurité)
├── drizzle.config.ts        # config drizzle-kit (schéma "test", SSL requis)
├── Dockerfile               # image Alpine + pnpm + build Astro
├── package.json             # nom d'image : micropachycephalosaurus
│
├── drizzle/                 # schéma, relations, migrations SQL, snapshots
│
├── helm/                    # chart Helm (déploiement K8s)
├── argocd/application.yaml  # copie de référence de l'Application ArgoCD
│
├── public/                  # assets statiques (images, polices, leaflet, v1)
│
└── src/
    ├── pages/               # routes + endpoints /api
    │   ├── index.astro          # carte + panneau de recherche (accueil)
    │   ├── calendrier.astro     # calendrier des événements
    │   ├── proposer.astro       # formulaire de proposition
    │   ├── proposer/merci.astro # confirmation
    │   ├── prompt.astro         # éditeur du prompt système
    │   ├── verification.astro   # admin : relire/publier/rejeter les propositions
    │   ├── sous-le-capot.astro  # page "technique" publique
    │   ├── a-propos/            # présentation + ressources (contenu v1)
    │   └── api/                 # chat, dataInit, dataFilter, dataEvents,
    │                            #   propose, prompt, verifications
    ├── components/          # composants .astro (Map, Calendar, SidePanel,
    │   │                    #   ProposalForm, Nav, Technical…)
    │   ├── sections/            # blocs par domaine (calendar, mapSearch,
    │   │                        #   propose, sous-le-capot, general)
    │   └── eclaire-v1/          # ancienne version (partenaires, ressources)
    ├── lib/                 # logique métier
    │   ├── dbDrizzle.ts         # connexion PostgreSQL
    │   ├── chatPrompt.ts        # construction du prompt + cache 5 min
    │   ├── orgCandidates.ts     # présélection déterministe
    │   ├── chatValidation.ts    # parsing/validation + périmètre thématique
    │   ├── chatValidation.test.ts # tests unitaires (vitest)
    │   ├── mapSearch/
    │   │   ├── chatController.ts # orchestration du chat (absorbe l'ancien
    │   │   │                     #   mapSearchController)
    │   │   ├── timelineStore.ts  # timeline + machine à écrire
    │   │   └── filtersStore.ts   # filtres de l'annuaire → $mapData
    │   ├── calendarState.ts      # fonctions pures du calendrier
    │   ├── proposalFormState.ts  # fonctions pures du formulaire
    │   ├── verificationState.ts  # fonctions pures de /verification
    │   ├── taxonomy.ts           # catégories et publics partagés
    │   ├── contact.ts            # email / téléphone / href
    │   ├── text.ts               # rendu Markdown + troncature
    │   └── prompts/chatSystemPrompt.md
    ├── interfaces/          # types TypeScript (org, event, chat,
    │                        #   calendar, verification…)
    ├── data/                # taxonomie (audienceTags, calendarConfig) + v1
    ├── content.config.ts    # collections de contenu (partenaires, ressources)
    ├── layouts/             # BaseLayout, MainLayout
    └── assets/              # polices et icônes SVG
```

---

## 12. Configuration & variables d'environnement

Chargées via `dotenv`. Injectées en production par la ConfigMap (non
sensibles) et les Secrets (sensibles) du chart Helm, eux-mêmes renseignés par
l'Application ArgoCD.

| Variable             | Sensible | Rôle                                                |
| -------------------- | -------- | --------------------------------------------------- |
| `SCW_DB_HOST`        | non      | Hôte PostgreSQL — **endpoint privé**                |
| `SCW_DB_PORT`        | non      | `5432`                                              |
| `SCW_DB_NAME`        | non      | `eclaire`                                           |
| `SCW_DB_USER`        | oui      | Utilisateur applicatif                              |
| `SCW_DB_PASS`        | oui      | Mot de passe DB                                     |
| `SCW_API_LLM_LNK`    | non      | Endpoint chat completions Scaleway (Qwen 235B)      |
| `SCW_API_LNK`        | non      | Endpoint embeddings Scaleway (vestige vectoriel)    |
| `SCW_API_KEY`        | oui      | Clé API Scaleway (LLM + embeddings)                 |
| `N8N_WEBHOOK_URL`    | —        | Notification des nouvelles propositions (optionnel) |
| `N8N_WEBHOOK_SECRET` | oui      | En-tête `Eclaire-Webhook-Secret` du webhook         |
| `CI_COMMIT_SHA`      | —        | Injecté au build (traçabilité)                      |

> Attention à une divergence SSL : `dbDrizzle.ts` (runtime) utilise
> `ssl: false` — cohérent avec une connexion sur endpoint **privé** —, tandis
> que `drizzle.config.ts` (outil de migration) impose `ssl: "require"` sur les
> variables `SCW_DB_*`.

---

## 13. Développement local

```bash
pnpm install            # installe les dépendances (Node ≥ 22.12)
pnpm dev                # serveur de dev sur http://localhost:4321
pnpm build              # build de production dans ./dist
pnpm preview            # prévisualise le build
pnpm check              # astro check (typage)
pnpm test               # vitest run (tests unitaires)
pnpm test:watch         # vitest en mode watch
pnpm format             # prettier --write
pnpm delete-org         # supprime une org et ses données (dry-run par défaut)
pnpm delete-event       # supprime un événement ou les doublons (dry-run par défaut)
```

### Filtre numérique du calendrier

Les scrapers suivent des agendas communaux entiers : sur 1 101 événements à
partir du mois courant, la majorité sont des cours de yoga, des conférences de
jardinage ou des séances de conseil municipal. `/api/dataEvents` ne renvoie donc
que les événements **liés au numérique**, filtrés en base :

```sql
categories && ARRAY['formation numérique', 'inclusion & accessibilité numérique',
                    'aide & soutien numérique', 'connectivité publique',
                    'aide matérielle & équipement', 'cybersécurité & prévention']
```

Cette liste n'est **pas** écrite en dur : `DIGITAL_CATEGORIES`
(`src/lib/taxonomy.ts`) la dérive des buckets `digital_learning`,
`digital_help` et `cybersecurity` de `calendarConfig.ts`. Ajouter une catégorie
à l'un de ces buckets la rend numérique sans toucher à une seconde liste.
`hasDigitalCategory()` est le même prédicat en TypeScript, pour les appelants
qui ont déjà les lignes en main — c'est lui que les tests couvrent.

Le filtre s'applique **en base et non dans le navigateur** : il divise la charge
DB et fait passer la réponse de 933 Ko à 347 Ko. La clé de cache inclut `scope`.

`?scope=all` lève le filtre (maintenance, vue détaillée d'une org). Aucun
appelant applicatif ne l'utilise aujourd'hui.

⚠️ Le filtre porte sur les **catégories de l'événement**, pas sur celles de
l'org. C'est voulu : « Réseau WIFI public gratuit — Ville de Meyrin » est une
org numérique dont les 161 événements scrapés sont l'agenda municipal complet,
et aucun n'est numérique. Les catégories sont posées à l'ingestion ; leur
justesse conditionne directement ce que voit le calendrier.

### Supprimer un événement

`scripts/deleteEvent.ts` (`pnpm delete-event`) suit la même forme que
`delete-org` : dry-run par défaut, `--execute`, `--confirm`, `--backup`.

```bash
pnpm delete-event --list [filtre]     # lister les événements (id, date, titre, orgs)
pnpm delete-event "<titre|uuid>"      # DRY RUN : ce qui serait supprimé
pnpm delete-event "<titre|uuid>" --execute                # après confirmation
pnpm delete-event --duplicates                 # DRY RUN : groupes de doublons
pnpm delete-event --duplicates --execute       # collapse, une copie par groupe
```

La suppression unitaire est **plus simple que celle d'une org** :
`orgs_events.event_id` est `ON DELETE CASCADE` et rien d'autre ne référence
`events`, donc il n'y a pas d'orphelins à traquer. Les lignes de jointure sont
tout de même supprimées explicitement, pour pouvoir les compter.

Un titre qui correspond à plusieurs événements **n'est pas supprimé** : les
candidats sont affichés pour que l'opérateur passe le bon UUID. C'est le cas
courant — les titres dupliqués sont la norme ici, contrairement aux noms d'orgs.

**`--duplicates`** regroupe sur `title` **ET** `start_date` — le titre seul
fusionnerait les séances hebdomadaires de « Cuisine et Partage », qui sont des
événements distincts. Dans chaque groupe, la copie conservée est la
**mieux reliée** (le plus de liens orgs, puis le scrape le plus ancien, puis le
plus petit id) : les lignes de jointure sont la seule partie non régénérable.

⚠️ **Le garde-fou qui compte** : un événement peut appartenir à plusieurs orgs,
donc supprimer la mauvaise copie peut coûter à une org son **unique** lien vers
l'événement. Si aucune copie ne couvre tous les liens du groupe, le groupe
entier est **laissé intact** et signalé, plutôt qu'à moitié nettoyé. En
production, 163 groupes sur 166 sont nettoyables ; les 3 autres (dont un groupe
de 10 lignes sans titre, 7 liens en jeu) demandent un arbitrage manuel.

Le plan des doublons est lu **sans `FOR UPDATE`** (la requête agrège, ce qui
interdit le verrou de ligne) : avant de supprimer, le script recompte les liens
des copies condamnées et annule la transaction s'ils ont bougé.

### Supprimer une organisation

`scripts/deleteOrg.ts` (`pnpm delete-org`) est le seul chemin de suppression du
projet : l'application, elle, n'appelle jamais `db.delete()`.

```bash
pnpm delete-org --list [filtre]       # lister les orgs (id, nom, ville, compteurs)
pnpm delete-org "<nom|uuid>"          # DRY RUN : ce qui serait supprimé
pnpm delete-org "<nom|uuid>" --execute            # supprime après confirmation
pnpm delete-org "<nom|uuid>" --execute --confirm "<nom>"   # sans terminal
pnpm delete-org "<nom|uuid>" --backup dump.json   # dump JSON des lignes retirées
```

**L'ordre des suppressions n'est pas arbitraire** — il découle de la
configuration des clés étrangères (§4) :

1. On calcule d'abord, **avant toute suppression**, les événements et
   actualités liés à cette org **et à aucune autre**. Le prédicat est bien
   « rattaché à cette org et à personne d'autre », jamais « sans aucun lien » :
   un événement que le scraping vient d'insérer n'a pas encore sa ligne de
   jointure et ne doit pas être emporté.
2. `propositions` (`modifying_org_id`) — supprimées explicitement, leurs
   `proposition_verifications` suivent en cascade. Les propositions qui
   nomment l'org sans la cibler (typiquement le `action = 'add'` qui l'a créée)
   sont **conservées** et signalées : c'est l'historique de modération.
3. `orgs_events` puis `orgs_news` pour cette org. Obligatoire avant l'étape
   suivante : `orgs_news.news_id` n'a **pas** de cascade.
4. Les événements et actualités orphelins, avec un `NOT EXISTS` de contrôle.
   C'est lui qui neutralise le `ON DELETE CASCADE` de `orgs_events.event_id` :
   si une autre org a réclamé la ligne entre-temps, elle est épargnée au lieu
   d'être détruite avec son lien.
5. `orgs` en dernier — les FK `NO ACTION` des tables de jointure servent alors
   de contrôle d'exhaustivité : si quelque chose pointe encore vers l'org, toute
   la transaction est annulée plutôt que de laisser des orphelins.

Le tout dans **une seule transaction**, en `READ COMMITTED` avec un
`SELECT ... FOR UPDATE` sur la ligne `orgs` : l'insertion d'un lien vers cette
org exige un `FOR KEY SHARE` sur cette même ligne, donc le scraping ne peut pas
en ajouter pendant l'opération. `lock_timeout` à 5 s pour ne pas bloquer la
prod indéfiniment. Le dry-run tourne dans une transaction `read only`.

⚠️ **Trois pièges** : n8n possède l'ingestion et réinsérera l'org (avec un
nouvel UUID) à son prochain passage — il faut aussi la retirer de la config de
scraping ; les caches en mémoire la servent encore 60 s (carte, calendrier) à
5 min (liste d'orgs du chat) ; et il n'y a **aucun undo** sans `--backup`.

Les tests unitaires ne touchent ni la base ni le LLM : `chatValidation.ts` est
constitué de fonctions pures, donc `pnpm test` s'exécute sans `.env`. La CI
(`.gitlab-ci.yml`, étape `Run tests`) enchaîne `format:check`, `check` et
`test`.

Un fichier `.env` local doit fournir au minimum les variables `SCW_DB_*` (accès
à une base peuplée) et, pour tester le chat, `SCW_API_LLM_LNK` + `SCW_API_KEY`.
Sans ces dernières, `/api/chat` renvoie `500 « Chat is not configured »`.

### Migrations (Drizzle)

Le schéma applicatif est **introspecté** depuis une base existante (le scraping
crée les tables). Les fichiers `drizzle/00xx_*.sql` servent de référence pour
recréer l'environnement. La table `prompt_config` a été créée manuellement
(`drizzle/0001_prompt_config.sql`) car l'utilisateur applicatif n'a pas de
droits DDL par défaut.

---

## 14. Build & déploiement

### Image Docker

`Dockerfile` : base `alpine`, installe `nodejs pnpm git`, `pnpm install`, puis
`pnpm build`. L'exécution lance le serveur SSR Astro :
`node ./dist/server/entry.mjs`, écoute sur `0.0.0.0:4321`.

### Chaîne de livraison

1. **Push d'une branche** → la CI GitLab builde et pousse l'image
   `registry.gitlab.com/cyberpeaceinstitute/micropachycephalosaurus:<slug>`.

Le chart Helm définit : `replicaCount: 1`, contexte de sécurité non-root
(uid 1001, `readOnlyRootFilesystem: false`, drop de toutes les capabilities),
ressources (100m/256Mi → 1 CPU/512Mi), sondes liveness/readiness sur `/`, et une
dépendance au chart `common` de Bitnami.

### Déployer une branche en prod sans merger

1. Pousser la branche (la CI builde l'image `:<slug>`).
2. Dans ArgoCD : ajouter le paramètre Helm `image.tag: <slug>` + **Sync**.
3. **Après merge dans `main` : retirer le paramètre `image.tag`** + Sync.
   _Sinon la prod reste figée sur l'image de branche et les déploiements de
   `main` n'ont plus aucun effet visible._

---

## 15. Infrastructure hors dépôt (à connaître absolument)

> Ces éléments ne vivent pas dans le dépôt.

1. **Application ArgoCD** (`micropachycephalosaurus`, namespace `argocd`) —
   porte les paramètres Helm réels (secrets, tag d'image). La source de vérité
   est le cluster. Copie assainie de référence : `argocd/application.yaml`
   (secrets remplacés par `<SECRET>`).

2. **Base PostgreSQL** — instance Scaleway managée « pgvector » (fr-par).
   - Connexion via l'**endpoint privé**. **Ne pas remettre l'endpoint public** :
     son ACL par IP casse dès que le pod change de nœud.
   - Table `test.prompt_config` : prompt système actif du chat (append-only).

3. **Cloudflare Access** — seule protection des pages d'admin `/prompt` et
   `/verification` (cette dernière écrit dans la table `orgs` de production).

4. **`argocd-repo-server` doit tourner avec `ARGOCD_GIT_MODULES_ENABLED=false`.**
   Le dépôt contient un submodule privé (`src/assets/fonts/` →
   `cyberpeaceinstitute/eclaire-fonts`, fonte Founders Grotesk sous licence
   commerciale). ArgoCD clone le dépôt pour rendre le chart `helm/` et lance
   `git submodule update --init --recursive` ; ses credentials ne couvrent que
   `micropachycephalosaurus`, donc le clone du submodule échoue et **la
   génération des manifests s'arrête avant de produire quoi que ce soit** :

   ```
   ComparisonError: Failed to load target state: ... failed to update submodules
   remote: HTTP Basic: Access denied.
   fatal: Authentication failed for '.../eclaire-fonts.git/'
   ```

   ⚠️ Le message ressemble à un problème d'accès au dépôt de l'application :
   ce n'en est pas un. **ArgoCD n'a aucun besoin de la fonte** — elle est
   intégrée à l'image Docker au moment du build CI. Le réglage ne fait que lui
   éviter de récupérer un submodule qu'il n'utilisera jamais.

   À reconfigurer si l'instance ArgoCD est réinstallée. Le réglage est
   _global au repo-server_ : il désactive les submodules pour toutes les
   Applications de cette instance.

---

## 16. Points d'attention pour la maintenance

- **La taxonomie est dupliquée** (validation chat, prompt, config calendrier,
  tags d'audience). Toute modification doit être propagée partout, en
  respectant casse et accents.
- **Le champ `city` fait autorité** pour le filtrage géographique — jamais le
  `desc`.
- **Prod vs fichier de prompt** : une fois qu'une version existe en base,
  éditer `chatSystemPrompt.md` ne change plus rien en prod. Passer par
  `/prompt`.
- **Endpoint DB privé uniquement** — ne jamais rétablir l'endpoint public.
- **`/prompt` et `/verification` sans auth applicative** : dépendent
  entièrement de Cloudflare Access. ⚠️ Cette documentation écrivait jusqu'ici
  `/verifications` **au pluriel**, alors que la route est
  `/verification` au singulier (`src/pages/verification.astro`) — seule l'API
  est au pluriel. Si la règle Cloudflare Access a été écrite depuis cette doc
  (`/verifications*`), **elle ne couvre pas la vraie route** : à vérifier hors
  dépôt. `/verification` écrit dans `orgs` en prod,
  donc l'accès doit impérativement la couvrir.
- **Divergence SSL** entre runtime (`false`) et outil de migration
  (`require`) — attendu, mais à garder en tête.
- **Modèle LLM** figé en dur dans `chat.ts`
  (`qwen3-235b-a22b-instruct-2507`) : le changer nécessite un redéploiement.

---
