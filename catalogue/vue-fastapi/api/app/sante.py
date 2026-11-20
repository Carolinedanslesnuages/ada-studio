"""Santé de l'API (la racine du site est le front Vue)."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

routes = APIRouter()


class EtatApi(BaseModel):
    statut: str = Field(examples=["ok"], description="L’API répond")


@routes.get("/api", tags=["Santé"], summary="L’API est prête")
def etat() -> EtatApi:
    return EtatApi(statut="ok")
