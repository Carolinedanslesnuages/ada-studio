"""Règles métier du traitement : nettoyage et contrôle de chaque ligne.

Exemple fourni avec le modèle (à remplacer par les règles du projet) : des inscriptions fictives,
dont on retire les espaces superflus, met le nom en majuscules et écarte les lignes sans adresse
électronique valide.
"""

from dataclasses import dataclass, field


@dataclass
class Resultat:
    """Lignes retenues, et lignes écartées avec la raison (affichées dans le rapport)."""

    retenues: list[dict[str, str]] = field(default_factory=list)
    ecartees: list[tuple[int, str]] = field(default_factory=list)


def nettoyer(ligne: dict[str, str]) -> dict[str, str]:
    """Espaces superflus retirés de chaque valeur ; nom en majuscules."""
    propre = {colonne.strip(): (valeur or "").strip() for colonne, valeur in ligne.items()}
    if "nom" in propre:
        propre["nom"] = propre["nom"].upper()
    return propre


def raison_de_rejet(ligne: dict[str, str]) -> str | None:
    """Pourquoi la ligne est écartée, ou None si elle est valide."""
    courriel = ligne.get("courriel", "")
    if not courriel:
        return "adresse électronique absente"
    if "@" not in courriel or "." not in courriel.split("@")[-1]:
        return f"adresse électronique invalide « {courriel} »"
    return None


def traiter(lignes: list[dict[str, str]]) -> Resultat:
    """Applique les règles à toutes les lignes (numérotées à partir de 2 : la ligne 1 est l'en-tête)."""
    resultat = Resultat()
    for numero, ligne in enumerate(lignes, start=2):
        propre = nettoyer(ligne)
        raison = raison_de_rejet(propre)
        if raison:
            resultat.ecartees.append((numero, raison))
        else:
            resultat.retenues.append(propre)
    return resultat
