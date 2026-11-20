"""Réglages de __NOM_PROJET__, lus dans l'environnement (jamais de secret dans le dépôt).

- Base : PostgreSQL si `DATABASE_URL` est fourni (aperçu d'ADA), sinon SQLite (`donnees/`).
- Clé secrète : `DJANGO_SECRET_KEY`, sinon une clé tirée au hasard à chaque démarrage (POC).
"""

import os
import secrets
from pathlib import Path
from urllib.parse import unquote, urlsplit

RACINE = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or secrets.token_urlsafe(50)
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*" if DEBUG else "").split(",")
CSRF_TRUSTED_ORIGINS = [
    origine for origine in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if origine
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "gestion",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "projet.urls"
WSGI_APPLICATION = "projet.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


def base_de_donnees(adresse: str | None) -> dict[str, object]:
    """PostgreSQL d'après une adresse `postgresql://utilisateur:motdepasse@hote:port/base`,
    sinon SQLite dans `donnees/`."""
    if not adresse:
        (RACINE / "donnees").mkdir(exist_ok=True)
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": RACINE / "donnees" / "base.sqlite3"}
    morceaux = urlsplit(adresse)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": morceaux.path.lstrip("/"),
        "USER": unquote(morceaux.username or ""),
        "PASSWORD": unquote(morceaux.password or ""),
        "HOST": morceaux.hostname or "localhost",
        "PORT": morceaux.port or 5432,
    }


DATABASES = {"default": base_de_donnees(os.environ.get("DATABASE_URL"))}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = RACINE / "staticfiles"

# Compte de l'aperçu d'ADA (créé par `python manage.py compte_apercu`, jamais commité).
FICHIER_COMPTE_APERCU = RACINE / ".apercu" / "compte.txt"
