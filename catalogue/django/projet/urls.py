"""Adresses du site : l'accueil, et l'administration (listes, fiches, droits) sous /admin/."""

from django.contrib import admin
from django.urls import path

from gestion.views import accueil

admin.site.site_header = "__NOM_PROJET__"
admin.site.site_title = "__NOM_PROJET__"
admin.site.index_title = "Administration"

urlpatterns = [
    path("", accueil, name="accueil"),
    path("admin/", admin.site.urls),
]
