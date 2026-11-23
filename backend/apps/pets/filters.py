"""Filtros con `django-filter` para el catálogo público de mascotas (BK-03c)."""

import django_filters
from django.db.models import QuerySet
from django.utils import timezone

from apps.pets.badges import AGE_GROUP_CHOICES, AgeGroup, subtract_years
from apps.pets.models import Pet


class PetCatalogFilter(django_filters.FilterSet):
    """Filtros y búsqueda por nombre del catálogo público (`GET /api/pets/`).

    Por defecto devuelve solo mascotas `published`. Si se pasa `adopted=true`,
    devuelve solo `adopted` (nunca se mezclan disponibles con adoptadas).
    """

    species = django_filters.ChoiceFilter(choices=Pet.Species.choices)
    sex = django_filters.ChoiceFilter(choices=Pet.Sex.choices)
    age_group = django_filters.ChoiceFilter(
        choices=AGE_GROUP_CHOICES,
        method="filter_age_group",
    )
    is_sociable = django_filters.BooleanFilter()
    good_with_children = django_filters.ChoiceFilter(choices=Pet.Compatibility.choices)
    good_with_animals = django_filters.ChoiceFilter(choices=Pet.Compatibility.choices)
    is_neutered = django_filters.BooleanFilter()
    urgent = django_filters.BooleanFilter(method="filter_urgent")
    adopted = django_filters.BooleanFilter(method="filter_adopted")
    favorites = django_filters.BooleanFilter(method="filter_favorites")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Pet
        fields = (
            "species",
            "sex",
            "age_group",
            "is_sociable",
            "good_with_children",
            "good_with_animals",
            "is_neutered",
            "urgent",
            "adopted",
            "favorites",
            "search",
        )

    @property
    def qs(self) -> QuerySet[Pet]:
        queryset = super().qs
        if not self.is_bound or not self.data.get("adopted"):
            return queryset.filter(status=Pet.Status.PUBLISHED)
        return queryset

    def filter_age_group(
        self,
        queryset: QuerySet[Pet],
        name: str,
        value: str,
    ) -> QuerySet[Pet]:
        today = timezone.localdate()
        cutoff_1y = subtract_years(today, 1)
        cutoff_8y = subtract_years(today, 8)

        if value == AgeGroup.CACHORRO.value:
            return queryset.filter(estimated_birth_date__gt=cutoff_1y)
        if value == AgeGroup.ADULTO.value:
            return queryset.filter(
                estimated_birth_date__lte=cutoff_1y,
                estimated_birth_date__gt=cutoff_8y,
            )
        if value == AgeGroup.SENIOR.value:
            return queryset.filter(estimated_birth_date__lte=cutoff_8y)
        return queryset

    def filter_urgent(
        self,
        queryset: QuerySet[Pet],
        name: str,
        value: bool,
    ) -> QuerySet[Pet]:
        if value:
            return queryset.filter(
                is_urgent_requested=True,
                is_urgent_validated=True,
            ).exclude(status=Pet.Status.ADOPTED)
        return queryset.exclude(
            is_urgent_requested=True,
            is_urgent_validated=True,
        )

    def filter_adopted(
        self,
        queryset: QuerySet[Pet],
        name: str,
        value: bool,
    ) -> QuerySet[Pet]:
        target_status = Pet.Status.ADOPTED if value else Pet.Status.PUBLISHED
        return queryset.filter(status=target_status)

    def filter_favorites(
        self,
        queryset: QuerySet[Pet],
        name: str,
        value: bool,
    ) -> QuerySet[Pet]:
        user = getattr(self.request, "user", None)
        is_authenticated_active = bool(
            user and getattr(user, "is_authenticated", False) and getattr(user, "is_active", False)
        )
        if value:
            if not is_authenticated_active:
                return queryset.none()
            return queryset.filter(favorites__user=user, favorites__is_active=True)
        if not is_authenticated_active:
            return queryset
        return queryset.exclude(favorites__user=user, favorites__is_active=True)

    def filter_search(
        self,
        queryset: QuerySet[Pet],
        name: str,
        value: str,
    ) -> QuerySet[Pet]:
        term = value.strip()
        if not term:
            return queryset
        return queryset.filter(name__icontains=term)
