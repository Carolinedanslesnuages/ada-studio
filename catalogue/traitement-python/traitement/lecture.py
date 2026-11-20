"""Lecture des fichiers d'entrée (CSV, séparateur « ; », encodage UTF-8)."""

import csv
from pathlib import Path


def lire_csv(chemin: Path) -> list[dict[str, str]]:
    """Lignes du fichier, chaque ligne étant un dictionnaire colonne → valeur (texte brut)."""
    with chemin.open(encoding="utf-8-sig", newline="") as fichier:
        return [dict(ligne) for ligne in csv.DictReader(fichier, delimiter=";")]
