"""Données du projet. Exemple fourni avec le modèle (à remplacer) : des demandes à traiter.

Toute évolution d'un modèle = une migration (`python manage.py makemigrations`), relue avant fusion.
"""

from django.db import models


class Demande(models.Model):
    class Statut(models.TextChoices):
        NOUVELLE = "nouvelle", "Nouvelle"
        EN_COURS = "en_cours", "En cours"
        TRAITEE = "traitee", "Traitée"

    titre = models.CharField("titre", max_length=200)
    demandeur = models.CharField("demandeur", max_length=120)
    statut = models.CharField("statut", max_length=20, choices=Statut.choices, default=Statut.NOUVELLE)
    creee_le = models.DateTimeField("créée le", auto_now_add=True)

    class Meta:
        verbose_name = "demande"
        verbose_name_plural = "demandes"
        ordering = ("-creee_le",)

    def __str__(self) -> str:
        return self.titre
