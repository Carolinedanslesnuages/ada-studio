from datetime import datetime
from pathlib import Path

import pytest

from traitement.__main__ import principal
from traitement.ecriture import rapport_html
from traitement.lecture import lire_csv
from traitement.regles import Resultat


def test_traitement_complet_du_fichier_exemple(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    exemple = Path("donnees/entree/inscriptions.csv").resolve()
    monkeypatch.chdir(tmp_path)
    assert principal([str(exemple)]) == 0
    sortie = lire_csv(tmp_path / "donnees/sortie/inscriptions.csv")
    assert [ligne["nom"] for ligne in sortie] == ["MARTIN", "DURAND"]
    rapport = (tmp_path / "rapport/index.html").read_text(encoding="utf-8")
    assert "Lignes retenues : <strong>2</strong>" in rapport
    assert "Lignes écartées : <strong>2</strong>" in rapport


def test_fichier_absent_message_clair(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert principal([str(tmp_path / "absent.csv")]) == 1
    assert "Fichier introuvable" in capsys.readouterr().err


def test_rapport_accessible_et_sans_injection_html() -> None:
    resultat = Resultat(ecartees=[(2, "adresse électronique invalide « <script> »")])
    rapport = rapport_html("Essai", "a.csv", resultat, datetime(2026, 1, 2, 3, 4))
    assert '<html lang="fr">' in rapport
    assert rapport.count("<h1>") == 1
    assert "<caption>" in rapport and 'scope="col"' in rapport
    assert "<script>" not in rapport
    assert "02/01/2026 à 03:04" in rapport


def test_aucune_ligne_ecartee() -> None:
    assert "Aucune ligne écartée." in rapport_html("Essai", "a.csv", Resultat(), datetime(2026, 1, 2))
