"""Lance le traitement : `python -m traitement [fichier d'entrée]`.

Lit `donnees/entree/inscriptions.csv` (par défaut), écrit `donnees/sortie/inscriptions.csv` et
le rapport `rapport/index.html` (celui que montre l'aperçu d'ADA).
"""

import sys
from datetime import datetime
from pathlib import Path

from traitement.ecriture import ecrire_csv, rapport_html
from traitement.lecture import lire_csv
from traitement.regles import traiter

TITRE = "__NOM_PROJET__"
ENTREE_PAR_DEFAUT = Path("donnees/entree/inscriptions.csv")


def principal(arguments: list[str]) -> int:
    entree = Path(arguments[0]) if arguments else ENTREE_PAR_DEFAUT
    if not entree.is_file():
        print(f"Fichier introuvable : {entree}", file=sys.stderr)
        return 1
    resultat = traiter(lire_csv(entree))
    ecrire_csv(Path("donnees/sortie") / entree.name, resultat.retenues)
    rapport = Path("rapport/index.html")
    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text(rapport_html(TITRE, entree.name, resultat, datetime.now()), encoding="utf-8")
    print(f"{len(resultat.retenues)} ligne(s) retenue(s), {len(resultat.ecartees)} écartée(s) : {rapport}")
    return 0


if __name__ == "__main__":
    sys.exit(principal(sys.argv[1:]))
