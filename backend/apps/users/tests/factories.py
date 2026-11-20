"""Factories de usuarios y roles para tests con factory_boy."""

import factory
from factory.django import DjangoModelFactory

from apps.users.models import Role, RoleCode, User, UserPreferences


class RoleFactory(DjangoModelFactory):
    """Obtiene o crea un rol del catálogo."""

    class Meta:
        model = Role
        django_get_or_create = ("code",)

    code = RoleCode.MEMBER
    name = factory.LazyAttribute(lambda obj: dict(RoleCode.choices).get(obj.code, obj.code))


class UserFactory(DjangoModelFactory):
    """Crea un usuario activo con contraseña hasheada y sus preferencias."""

    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"usuario{n}@callejeros.ar")
    first_name = factory.Faker("first_name", locale="es_AR")
    last_name = factory.Faker("last_name", locale="es_AR")
    phone = "+54 9 358 4000000"
    city = "Río Cuarto"
    role = factory.SubFactory(RoleFactory, code=RoleCode.MEMBER)

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "claveSegura123")
        user = model_class(*args, **kwargs)
        user.set_password(password)
        user.save()
        UserPreferences.objects.get_or_create(user=user)
        return user
