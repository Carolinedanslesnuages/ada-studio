"""Écriture des résultats : fichier nettoyé (CSV) et rapport lisible (HTML accessible)."""

import csv
from datetime import datetime
from html import escape
from pathlib import Path

from traitement.regles import Resultat


def ecrire_csv(chemin: Path, lignes: list[dict[str, str]]) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    colonnes = list(lignes[0]) if lignes else []
    with chemin.open("w", encoding="utf-8", newline="") as fichier:
        ecrivain = csv.DictWriter(fichier, fieldnames=colonnes, delimiter=";")
        ecrivain.writeheader()
        ecrivain.writerows(lignes)


def rapport_html(titre: str, source: str, resultat: Resultat, le: datetime) -> str:
    """Rapport du traitement : page autonome, en français, titres hiérarchisés, tableaux avec
    légende et en-têtes (RGAA)."""
    lignes_ecartees = "\n".join(
        f"<tr><td>{numero}</td><td>{escape(raison)}</td></tr>" for numero, raison in resultat.ecartees
    )
    ecartees = (
        f"""<table>
  <caption>Lignes écartées et raison</caption>
  <thead><tr><th scope="col">Ligne du fichier</th><th scope="col">Raison</th></tr></thead>
  <tbody>
{lignes_ecartees}
  </tbody>
</table>"""
        if resultat.ecartees
        else "<p>Aucune ligne écartée.</p>"
    )
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport du traitement — {escape(titre)}</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 48rem; }}
main {{ padding: 0 1rem; color: #161616; }}
table {{ border-collapse: collapse; width: 100%; }}
caption {{ text-align: left; font-weight: bold; margin-bottom: .5rem; }}
th, td {{ border: 1px solid #666; padding: .4rem .6rem; text-align: left; }}
</style>
</head>
<body>
<main>
<h1>Rapport du traitement</h1>
<p>{escape(titre)} — fichier « {escape(source)} », traité le {le:%d/%m/%Y à %H:%M}.</p>
<h2>Résumé</h2>
<ul>
  <li>Lignes retenues : <strong>{len(resultat.retenues)}</strong></li>
  <li>Lignes écartées : <strong>{len(resultat.ecartees)}</strong></li>
</ul>
<h2>Lignes écartées</h2>
{ecartees}
</main>
</body>
</html>
"""
