# Handover — état de l'app et config hors git

Dernière mise à jour : 2026-07-28

## Ce qui vit HORS de ce dépôt (à connaître absolument)

1. **Application ArgoCD** (`kubectl -n argocd get application micropachycephalosaurus -o yaml`, ou UI ArgoCD)
   — c'est elle qui porte les paramètres Helm réels : endpoints DB, secrets, tag d'image.
   Copie de référence assainie : [argocd/application.yaml](argocd/application.yaml).
   Pas de sync automatique : le déploiement est déclenché par la CI (push sur `main`).

2. **Base PostgreSQL** — instance Scaleway managée « pgvector » (fr-par).
   - L'app se connecte via l'**endpoint privé** (`172.16.4.19:5432`). Ne pas remettre
     l'endpoint public : son ACL par IP casse dès que le pod change de nœud (panne du 28.07).
   - Table `test.prompt_config` : contient le **prompt système actif du chat**
     (dernière ligne = version active, append-only = historique complet).
     Le fichier `src/lib/prompts/chatSystemPrompt.md` n'est qu'un défaut/fallback :
     le modifier ne change PAS la prod dès qu'une version existe en base.
     DDL de référence : `drizzle/0001_prompt_config.sql`.

3. **Cloudflare Access** — seule protection de la page `/prompt` (aucune auth applicative).
   Si Access saute, cette page devient publiquement éditable.

## Page /prompt

Éditeur du prompt système : modification en prod sans redéploiement (cache 5 min,
immédiat sur le pod qui enregistre), historique des versions, restauration.
Règle d'or pour éditer le prompt : le modèle suit davantage les **exemples** que les
règles — modifier toutes les occurrences d'un comportement, pas seulement la règle.

## Déployer une branche en prod (sans merger)

1. Pousser la branche → la CI builde `registry.gitlab.com/cyberpeaceinstitute/micropachycephalosaurus:<slug-de-branche>`
2. Dans ArgoCD : ajouter le paramètre `image.tag: <slug>` + Sync
3. Après merge dans `main` : **retirer le paramètre `image.tag`** + Sync
   (sinon la prod reste figée sur l'image de branche et les déploiements de `main`
   n'ont plus aucun effet visible).

## Utilisateurs DB (instance pgvector, db `eclaire`)

- `eclaire` : utilisateur applicatif, readwrite (owner de `test.prompt_config`)
- `data_fill` : admin, owner du schéma `test` (scraper)
- `data_retrieve` : readonly
- Pas de droits DDL pour `eclaire` : toute nouvelle table exige un passage
  temporaire en `all` via `scw rdb privilege set` (puis retour `readwrite`,
  et ré-asserter les privilèges des autres utilisateurs qui passent en « custom »).
