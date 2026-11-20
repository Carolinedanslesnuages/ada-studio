from fastapi.testclient import TestClient

from app.main import app
from app.version import VERSION_DEV, lire_version

client = TestClient(app)


def test_l_api_repond() -> None:
    reponse = client.get("/api")
    assert reponse.status_code == 200
    assert reponse.json() == {"statut": "ok"}


def test_documentation_interactive_et_description_openapi() -> None:
    assert "swagger-ui" in client.get("/api/docs").text
    openapi = client.get("/api/openapi.json").json()
    assert openapi["info"]["title"] == "__NOM_PROJET__"
    assert list(openapi["paths"]) == ["/api"]


def test_version_en_repli_dev_hors_image() -> None:
    for chemin in ("/__version__", "/api/__version__"):
        reponse = client.get(chemin)
        assert reponse.status_code == 200
        assert reponse.headers["cache-control"] == "no-store"
        assert reponse.json() == VERSION_DEV
    assert lire_version("/fichier/absent.json") == VERSION_DEV
