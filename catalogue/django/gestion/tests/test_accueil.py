import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from gestion.models import Demande


class AccueilTests(TestCase):
    def test_accueil_accessible_et_mene_a_l_administration(self) -> None:
        reponse = self.client.get(reverse("accueil"))
        self.assertEqual(reponse.status_code, 200)
        page = reponse.content.decode()
        self.assertIn('<html lang="fr">', page)
        self.assertEqual(page.count("<h1>"), 1)
        self.assertIn('href="/admin/"', page)

    def test_administration_demande_une_connexion(self) -> None:
        reponse = self.client.get("/admin/")
        self.assertEqual(reponse.status_code, 302)
        self.assertIn("/admin/login/", reponse["Location"])


class CompteApercuTests(TestCase):
    def test_compte_cree_une_fois_affiche_sur_l_accueil_en_developpement(self) -> None:
        with tempfile.TemporaryDirectory() as dossier:
            fichier = Path(dossier) / ".apercu" / "compte.txt"
            with override_settings(FICHIER_COMPTE_APERCU=fichier, DEBUG=True):
                call_command("compte_apercu")
                identifiant, _, mot_de_passe = fichier.read_text(encoding="utf-8").strip().partition(":")
                self.assertEqual(identifiant, "po")
                self.assertTrue(self.client.login(username="po", password=mot_de_passe))
                call_command("compte_apercu")
                self.assertEqual(fichier.read_text(encoding="utf-8").strip().partition(":")[2], mot_de_passe)
                self.assertContains(self.client.get(reverse("accueil")), mot_de_passe)
            with override_settings(FICHIER_COMPTE_APERCU=fichier, DEBUG=False):
                self.assertNotContains(self.client.get(reverse("accueil")), mot_de_passe)


class AdministrationDemandesTests(TestCase):
    def test_liste_recherche_et_filtre_des_demandes(self) -> None:
        administrateur = get_user_model().objects.create_superuser(
            "admin", "admin@exemple.fr", "mot-de-passe-fictif"
        )
        self.client.force_login(administrateur)
        Demande.objects.create(titre="Badge perdu", demandeur="Camille")
        Demande.objects.create(titre="Écran cassé", demandeur="Lou", statut=Demande.Statut.TRAITEE)
        liste = self.client.get("/admin/gestion/demande/?q=badge")
        self.assertContains(liste, "Badge perdu")
        self.assertNotContains(liste, "Écran cassé")
        traitees = self.client.get("/admin/gestion/demande/?statut__exact=traitee")
        self.assertContains(traitees, "Écran cassé")
