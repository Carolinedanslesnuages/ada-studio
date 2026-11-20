from traitement.regles import nettoyer, raison_de_rejet, traiter


def test_nettoie_les_espaces_et_met_le_nom_en_majuscules() -> None:
    assert nettoyer({" nom ": " Martin ", "prenom": " Camille"}) == {"nom": "MARTIN", "prenom": "Camille"}


def test_ecarte_une_adresse_absente_ou_invalide_avec_sa_raison() -> None:
    assert raison_de_rejet({"courriel": ""}) == "adresse électronique absente"
    assert raison_de_rejet({"courriel": "sacha@exemple"}) == "adresse électronique invalide « sacha@exemple »"
    assert raison_de_rejet({"courriel": "alex@exemple.fr"}) is None


def test_traite_toutes_les_lignes_et_numerote_comme_dans_le_fichier() -> None:
    resultat = traiter(
        [
            {"nom": "Martin", "courriel": "camille@exemple.fr"},
            {"nom": "Bernard", "courriel": ""},
        ]
    )
    assert [ligne["nom"] for ligne in resultat.retenues] == ["MARTIN"]
    assert resultat.ecartees == [(3, "adresse électronique absente")]
