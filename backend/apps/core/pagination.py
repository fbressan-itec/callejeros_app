"""Clases de paginación reutilizables para los listados de la API."""

from rest_framework.pagination import PageNumberPagination


class StandardPageNumberPagination(PageNumberPagination):
    """Paginación estándar de a 12 resultados por página (`?page=2`)."""

    page_size = 12
