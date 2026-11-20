"""Écrans d'administration : liste (colonnes, filtres, recherche) et fiche de chaque donnée."""

from typing import TYPE_CHECKING

from django.contrib import admin

from gestion.models import Demande

# Django ne connaît pas les types génériques à l'exécution ; mypy (django-stubs), si.
if TYPE_CHECKING:
    AdminDemande = admin.ModelAdmin[Demande]
else:
    AdminDemande = admin.ModelAdmin


@admin.register(Demande)
class DemandeAdmin(AdminDemande):
    list_display = ("titre", "demandeur", "statut", "creee_le")
    list_filter = ("statut",)
    search_fields = ("titre", "demandeur")
