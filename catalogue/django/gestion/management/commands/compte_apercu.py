"""Crée le compte d'administration de l'aperçu d'ADA (« po »), mot de passe tiré au hasard,
noté hors du dépôt (`.apercu/compte.txt`) et affiché sur l'accueil en mode développement."""

import secrets
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

IDENTIFIANT = "po"


class Command(BaseCommand):
    help = "Crée le compte d'administration de l'aperçu (données fictives)"

    def handle(self, *args: Any, **options: Any) -> None:
        fichier = settings.FICHIER_COMPTE_APERCU
        utilisateurs = get_user_model()
        if fichier.is_file() and utilisateurs.objects.filter(username=IDENTIFIANT).exists():
            self.stdout.write("Compte de l'aperçu déjà prêt")
            return
        mot_de_passe = secrets.token_urlsafe(12)
        compte, _ = utilisateurs.objects.get_or_create(username=IDENTIFIANT)
        compte.is_staff = True
        compte.is_superuser = True
        compte.set_password(mot_de_passe)
        compte.save()
        fichier.parent.mkdir(exist_ok=True)
        fichier.write_text(f"{IDENTIFIANT}:{mot_de_passe}\n", encoding="utf-8")
        self.stdout.write(f"Compte de l'aperçu créé : {IDENTIFIANT}")
