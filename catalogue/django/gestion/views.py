"""Page d'accueil : présente le service et mène à l'administration."""

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render


def compte_apercu() -> tuple[str, str] | None:
    """Identifiant et mot de passe du compte de l'aperçu, s'il a été créé (jamais en production)."""
    fichier = settings.FICHIER_COMPTE_APERCU
    if not settings.DEBUG or not fichier.is_file():
        return None
    identifiant, _, mot_de_passe = fichier.read_text(encoding="utf-8").strip().partition(":")
    return identifiant, mot_de_passe


def accueil(requete: HttpRequest) -> HttpResponse:
    return render(requete, "gestion/accueil.html", {"compte": compte_apercu()})
