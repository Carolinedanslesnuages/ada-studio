# __NOM_PROJET__

**Objectif :** __OBJECTIF__
**Stack :** Vue 3 + Python (FastAPI) + PostgreSQL (modèle ADA studio `vue-fastapi`)
**Interface :** voir AGENTS.md (section « Interface »)
**Créé le :** __DATE__ par __PO__

## Lancer le projet
| Action | Commande |
|---|---|
| Base de données | `docker compose up -d` puis `cd api && alembic upgrade head` |
| Lancer l'API | `cd api && uvicorn app.main:app --reload` |
| Lancer le front | `cd front && npm run dev` |

## Stories réalisées
_(aucune pour l'instant)_
