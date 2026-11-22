"""Flujo de revisión reutilizable: `in_review` → `published` / `rejected` (BK-06, #9).

Lo usan las publicaciones de mascotas (`apps.pets`) y, en la v0.4, los productos de la
tienda. La lógica (permisos, estados válidos, motivo e historial) está escrita una sola
vez acá; cada app solo crea una clase hija que dice dónde guarda su historial.

Cómo se reutiliza en BK-12 (#15, productos de la tienda):

    class ProductReviewWorkflow(ReviewWorkflow):
        log_model = ProductStatusLog       # misma forma que `PetStatusLog` (ver README)
        log_object_field = "product"       # FK de `ProductStatusLog` hacia `Product`
        # Productos: Staff y Admin publican directo; Refugio verificado pasa por revisión.
        direct_publish_roles = frozenset({RoleCode.STAFF, RoleCode.ADMIN})

    product_review_workflow = ProductReviewWorkflow()
    status = product_review_workflow.get_initial_status(request.user)  # al crear
    product_review_workflow.approve(obj=product, actor=request.user)    # al revisar

Requisitos del modelo revisado: campos `status` (con los valores `in_review`,
`published` y `rejected`), `is_active` y `updated_at`. El modelo de historial necesita
`previous_status`, `new_status`, `performed_by`, `note` (con `max_length`) y la FK que
indica `log_object_field`.
"""

from typing import Any, ClassVar

from django.db import models, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.users.models import RoleCode
from apps.users.permissions import FORBIDDEN_ERROR_MESSAGE, user_has_role

ONLY_IN_REVIEW_ERROR = "Solo se puede revisar una publicación que esté en revisión."
INACTIVE_REVIEW_OBJECT_ERROR = "La publicación no está activa."
DEFAULT_APPROVE_NOTE = "Publicación aprobada por Staff."
DEFAULT_REJECT_NOTE = (
    "Tu publicación no fue aprobada porque no cumple con las pautas de Callejeros Río Cuarto."
)
CREATED_IN_REVIEW_NOTE = "Alta inicial de la publicación."


class ReviewWorkflow:
    """Base del flujo de revisión. Las clases hijas configuran `log_model` y `log_object_field`."""

    log_model: ClassVar[type[models.Model]]
    log_object_field: ClassVar[str]
    reviewer_roles: ClassVar[frozenset[str]] = frozenset({RoleCode.STAFF, RoleCode.ADMIN})
    # Roles cuyas publicaciones no pasan por revisión (decisión 2026-11-22: solo Admin).
    direct_publish_roles: ClassVar[frozenset[str]] = frozenset({RoleCode.ADMIN})

    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    REJECTED = "rejected"

    # -- Permisos -------------------------------------------------------------

    def can_review(self, actor: Any) -> bool:
        """Solo Staff y Admin revisan (el permiso de la vista se repite acá a propósito).

        Observación (decisión del 2026-11-22): Staff puede aprobar su propia publicación.
        Solo Admin publica sin revisión, pero no se bloquea que quien revisa sea el autor;
        el historial deja registrado quién aprobó. Si se quisiera bloquear, este es el
        lugar: recibir `obj` y comparar su autor con `actor`.
        """
        return user_has_role(actor, self.reviewer_roles)

    def publishes_directly(self, actor: Any) -> bool:
        """True si lo que publica `actor` sale publicado sin pasar por revisión."""
        return user_has_role(actor, self.direct_publish_roles)

    # -- Alta de una publicación ----------------------------------------------

    def get_initial_status(self, actor: Any) -> str:
        """Estado con el que nace una publicación según el rol de quien la carga."""
        return self.PUBLISHED if self.publishes_directly(actor) else self.IN_REVIEW

    def get_creation_note(self, actor: Any) -> str:
        """Nota del primer registro del historial (alta en revisión o publicación directa)."""
        if self.publishes_directly(actor):
            return f"Publicada directamente por {actor.role.name}, sin revisión."
        return CREATED_IN_REVIEW_NOTE

    # -- Acciones -------------------------------------------------------------

    def approve(self, *, obj: models.Model, actor: Any, note: str = "") -> models.Model:
        """Aprueba una publicación en revisión: pasa a `published` y queda en el historial."""
        reviewed = self._review(
            obj=obj,
            actor=actor,
            new_status=self.PUBLISHED,
            note=note.strip() or DEFAULT_APPROVE_NOTE,
        )
        self.on_approved(obj=reviewed, actor=actor)
        return reviewed

    def reject(self, *, obj: models.Model, actor: Any, note: str = "") -> models.Model:
        """Rechaza una publicación en revisión: pasa a `rejected` con motivo en el historial.

        Si Staff no escribe un motivo, se guarda `DEFAULT_REJECT_NOTE` (genérico a propósito,
        para no darle explicaciones a quien publica contenido malicioso).
        """
        reviewed = self._review(
            obj=obj,
            actor=actor,
            new_status=self.REJECTED,
            note=note.strip() or DEFAULT_REJECT_NOTE,
        )
        self.on_rejected(obj=reviewed, actor=actor)
        return reviewed

    # -- Ganchos para extender sin tocar la lógica ----------------------------

    def on_approved(self, *, obj: models.Model, actor: Any) -> None:
        """Se ejecuta después de aprobar. BK-08 (#11) lo usa para notificar al autor."""

    def on_rejected(self, *, obj: models.Model, actor: Any) -> None:
        """Se ejecuta después de rechazar. BK-08 (#11) lo usa para notificar al autor el motivo."""

    # -- Historial ------------------------------------------------------------

    def log_status_change(
        self,
        *,
        obj: models.Model,
        actor: Any,
        previous_status: str,
        new_status: str,
        note: str,
    ) -> models.Model:
        """Registra un cambio de estado en el historial de la app (quién, cuándo y por qué)."""
        return self.log_model.objects.create(
            **{self.log_object_field: obj},
            previous_status=previous_status,
            new_status=new_status,
            performed_by=actor,
            note=note,
        )

    # -- Internos -------------------------------------------------------------

    def _note_max_length(self) -> int:
        return self.log_model._meta.get_field("note").max_length

    @transaction.atomic
    def _review(
        self,
        *,
        obj: models.Model,
        actor: Any,
        new_status: str,
        note: str,
    ) -> models.Model:
        if not self.can_review(actor):
            raise PermissionDenied(FORBIDDEN_ERROR_MESSAGE)

        max_length = self._note_max_length()
        if len(note) > max_length:
            raise ValidationError(
                {"note": [f"El motivo no puede superar los {max_length} caracteres."]}
            )

        # Bloquea la fila hasta terminar: si dos personas de Staff revisan a la vez,
        # la segunda ve el estado ya cambiado y recibe el error en lugar de pisarlo.
        locked = type(obj).objects.select_for_update().get(pk=obj.pk)

        if not locked.is_active:
            raise ValidationError({"detail": [INACTIVE_REVIEW_OBJECT_ERROR]})
        if locked.status != self.IN_REVIEW:
            raise ValidationError({"status": [ONLY_IN_REVIEW_ERROR]})

        previous_status = locked.status
        locked.status = new_status
        locked.save(update_fields=["status", "updated_at"])

        self.log_status_change(
            obj=locked,
            actor=actor,
            previous_status=previous_status,
            new_status=new_status,
            note=note,
        )
        return locked
