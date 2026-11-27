"""Datos de prueba de notificaciones (`python manage.py seed`)."""

from datetime import timedelta

from django.core.management.base import CommandError
from django.utils import timezone

from apps.notifications.models import Notification
from apps.pets.models import Pet
from apps.users.models import User

SEED_NOTIFICATIONS = [
    # Notificaciones base del maquetado (`initialNotifications`) para el miembro de prueba.
    {
        "recipient_email": "miembro@callejeros.ar",
        "title": "Alerta Perro Perdido en Centro",
        "text": "Mestizo mediano marrón con collar azul visto en Plaza Roca.",
        "tag": Notification.Tag.URGENT,
        "link": "/alertas",
        "is_read": False,
        "minutes_ago": 15,
    },
    {
        "recipient_email": "miembro@callejeros.ar",
        "title": "Jornada de Castración Gratuita",
        "text": "Sábado 10:00 hs en Vecinal Alberdi. Cupos limitados por orden de llegada.",
        "tag": Notification.Tag.COMMUNITY,
        "link": "/noticias",
        "is_read": False,
        "minutes_ago": 120,
    },
    {
        "recipient_email": "miembro@callejeros.ar",
        "title": "Cachorritos Huérfanos Rescatados",
        "text": "3 gatitos de 1 mes buscan nodriza o leche especial en Banda Norte.",
        "tag": Notification.Tag.URGENT,
        "link": "/alertas",
        "is_read": False,
        "minutes_ago": 240,
    },
    {
        "recipient_email": "miembro@callejeros.ar",
        "title": "¡Final Feliz!",
        "text": "Pancho fue adoptado y ya está en su nuevo hogar definitivo.",
        "tag": Notification.Tag.ADOPTION,
        "pet_link_name": "Pancho",
        "link": "/adopciones",
        "is_read": True,
        "minutes_ago": 1440,
    },
    {
        "recipient_email": "miembro@callejeros.ar",
        "title": "Colecta de Mantas y Alimento",
        "text": "Recibimos donaciones para los refugios este fin de semana.",
        "tag": Notification.Tag.FUNDRAISING,
        "link": "/donaciones",
        "is_read": True,
        "minutes_ago": 2880,
    },
    # Ejemplos para refugio, staff y admin.
    {
        "recipient_email": "refugio@callejeros.ar",
        "title": "¡Tu publicación de Loki ya está en el catálogo!",
        "text": "Un voluntario aprobó la ficha de Loki y ya está visible para adopción.",
        "tag": Notification.Tag.POST,
        "pet_link_name": "Loki",
        "link": "/adopciones",
        "is_read": False,
        "minutes_ago": 45,
    },
    {
        "recipient_email": "refugio@callejeros.ar",
        "title": "Nuevo apadrinamiento para Rocco",
        "text": "Un vecino se sumó a colaborar mensualmente con el cuidado de Rocco.",
        "tag": Notification.Tag.SPONSORSHIP,
        "pet_link_name": "Rocco",
        "link": "/donaciones",
        "is_read": True,
        "minutes_ago": 1800,
    },
    {
        "recipient_email": "staff@callejeros.ar",
        "title": "Jornada de Adopción en Plaza Olmos",
        "text": (
            "Recordatorio para voluntarios: armado de mesa informativa el sábado a las 15:30 hs."
        ),
        "tag": Notification.Tag.COMMUNITY,
        "link": "/noticias",
        "is_read": False,
        "minutes_ago": 60,
    },
    {
        "recipient_email": "admin@callejeros.ar",
        "title": "Colecta de Mantas y Alimento",
        "text": "Recibimos donaciones para los refugios este fin de semana.",
        "tag": Notification.Tag.FUNDRAISING,
        "link": "/donaciones",
        "is_read": True,
        "minutes_ago": 2880,
    },
]


def _resolve_link(item: dict) -> str:
    pet_name = item.get("pet_link_name")
    if pet_name:
        pet_id = Pet.objects.filter(name=pet_name).values_list("id", flat=True).first()
        if pet_id is not None:
            return f"/mascotas/{pet_id}"
    return item["link"]


def run() -> str:
    """Crea o actualiza las notificaciones de prueba sin duplicarlas y devuelve un resumen."""
    now = timezone.now()
    created_count = 0
    updated_count = 0

    for item in SEED_NOTIFICATIONS:
        recipient = User.objects.filter(email=item["recipient_email"]).first()
        if recipient is None:
            raise CommandError(
                f"No se encontró el usuario de prueba '{item['recipient_email']}'. "
                "Asegurate de que `apps.users` esté antes de `apps.notifications` "
                "en INSTALLED_APPS."
            )

        target_created_at = now - timedelta(minutes=item["minutes_ago"])
        existing = (
            Notification.objects.filter(recipient=recipient, title=item["title"])
            .order_by("created_at", "id")
            .first()
        )

        if item["is_read"]:
            if existing is not None and existing.is_read and existing.read_at is not None:
                read_at = existing.read_at
            else:
                read_at = now
        else:
            read_at = None

        fields = {
            "text": item["text"],
            "tag": item["tag"],
            "link": _resolve_link(item),
            "is_read": item["is_read"],
            "read_at": read_at,
            "is_active": True,
        }

        if existing is None:
            notification = Notification.objects.create(
                recipient=recipient,
                title=item["title"],
                **fields,
            )
            created_count += 1
        else:
            for field_name, value in fields.items():
                setattr(existing, field_name, value)
            existing.save()
            notification = existing
            updated_count += 1

        # `created_at` tiene `auto_now_add=True`, por eso se ajusta con `.update(...)`
        # para respetar las antigüedades y el orden del maquetado.
        Notification.objects.filter(pk=notification.pk).update(created_at=target_created_at)

    return f"{created_count} notificaciones creadas, {updated_count} actualizadas"
