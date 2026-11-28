# API REST

> Volver al [README](../README.md).

Detalle de cada endpoint: permisos, parámetros y reglas. La documentación interactiva, generada con `drf-spectacular`, está en Swagger: <https://callejeros-api.onrender.com/api/docs/> (publicada) o <http://localhost:8000/api/docs/> (local). El esquema OpenAPI 3 está en `/api/schema/`.

## Endpoints de autenticación (`/api/auth/`)

| Método y ruta | Permiso | Qué hace |
| :--- | :--- | :--- |
| `POST /api/auth/register/` | Público (`AllowAny`) | Registra un usuario nuevo con rol `member`, crea sus preferencias y devuelve `{ access, refresh, user }`. |
| `POST /api/auth/login/` | Público (`AllowAny`) | Inicia sesión por email y contraseña; con `remember_me=true` emite un `refresh` de 30 días (1 día si es `false`). |
| `POST /api/auth/refresh/` | Público (`AllowAny`) | Emite un nuevo token `access` a partir de un `refresh` vigente. |
| `POST /api/auth/logout/` | Público (`AllowAny`) | Invalida el token `refresh` agregándolo a la lista negra (`token_blacklist`). |
| `GET /api/auth/me/` | Sesión activa (`IsAuthenticated`) | Devuelve los datos y el rol (`member`, `verified_shelter`, `staff`, `admin`) del usuario autenticado. |

## Endpoints de administración de usuarios (`/api/admin/`)

| Método y ruta | Permiso | Qué hace |
| :--- | :--- | :--- |
| `GET /api/admin/roles/` | Solo Admin (`IsAdmin`) | Lista los 4 roles del catálogo (`member`, `verified_shelter`, `staff`, `admin`) con código y nombre de insignia. |
| `GET /api/admin/users/` | Solo Admin (`IsAdmin`) | Listado paginado de a 12 (`{ count, next, previous, results }`, `?page=2`) de usuarios activos e inactivos, ordenados de más reciente a más antiguo. Soporta filtros (`?role=`, `?is_active=true\|false`) y búsqueda (`?search=` por correo, nombre o apellido). Nunca expone `address` ni `password`. |
| `GET /api/admin/users/{id}/` | Solo Admin (`IsAdmin`) | Devuelve el detalle de gestión de un usuario (activo o inactivo), su rol y estado, sin exponer `address` ni `password`. |
| `POST /api/admin/users/{id}/role/` | Solo Admin (`IsAdmin`) | Cambia el rol (`role_code` y `note` opcional ≤ 255) y registra el cambio en `UserRoleLog`. Impide auto-degradación y bajar al último Admin activo; pedir el mismo rol responde `200` sin duplicar historial. |
| `POST /api/admin/users/{id}/deactivate/` | Solo Admin (`IsAdmin`) | Aplica baja lógica (`is_active=False`), registra `UserStatusLog` (`deactivated`, `admin_action`, `note` opcional ≤ 255) e invalida los tokens de refresco vigentes en `token_blacklist`. Impide auto-desactivación y desactivar al último Admin activo; idempotente si ya estaba inactivo. |
| `POST /api/admin/users/{id}/reactivate/` | Solo Admin (`IsAdmin`) | Reactiva una cuenta desactivada (`is_active=True`) y registra `UserStatusLog` (`reactivated`, `admin_action`, `note` opcional ≤ 255); idempotente si ya estaba activa. |

## Endpoints de mascotas (`/api/pets/`)

| Método y ruta | Permiso | Qué hace |
| :--- | :--- | :--- |
| `GET /api/pets/` | Público (`AllowAny`) | Catálogo paginado de a 12 (`{ count, next, previous, results }`, `?page=2`) de mascotas activas (`published` por defecto; con `?adopted=true` solo `adopted`). Soporta filtros (`species`, `sex`, `age_group`, `is_sociable`, `good_with_children`, `good_with_animals`, `is_neutered`, `urgent`, `adopted`, `favorites`) y búsqueda por nombre (`search`). Devuelve `age_label`, `is_urgent`, `is_favorite` y `badges` calculados en el servidor y nunca expone `contact_phone` ni flags internos. |
| `POST /api/pets/` | Sesión activa (`IsAuthenticated`) | Publica una mascota con bloque de salud (`health`), al menos 1 foto válida (JPG/PNG/WEBP ≤ 5 MB) y log inicial en `PetStatusLog`. Nace en `in_review` con `is_urgent_validated=False`; si la carga un `admin`, nace en `published` y, si pidió urgente, con la urgencia validada. |
| `GET /api/pets/mine/` | Sesión activa (`IsAuthenticated`) | Lista paginada de a 12 (`{ count, next, previous, results }`, `?page=2`) de las mascotas activas publicadas por el usuario autenticado en todos los estados (filtro opcional `?status=`), incluyendo `contact_phone` para edición. |
| `GET /api/pets/favorites/` | Sesión activa (`IsAuthenticated`) | Lista paginada de a 12 (`{ count, next, previous, results }`, `?page=2`) de las mascotas activas y visibles (`published` o `adopted`) marcadas como favoritas por el usuario autenticado, ordenadas desde la más reciente. |
| `GET /api/pets/review-queue/` | Staff o Admin (`IsStaffOrAdmin`) | Cola de revisión del panel de Staff: lista paginada de a 12 (`?page=2`) de las mascotas activas en `in_review`, con la ficha de gestión (autor con su rol, `contact_phone`, urgencia pedida y validada, fotos y salud). Primero las que pidieron caso urgente y, dentro de cada grupo, de la más vieja a la más nueva. |
| `GET /api/pets/{id}/` | Público (`published`/`adopted`) · Autor o Staff/Admin en otros estados | Devuelve la ficha completa con `age_label`, `is_favorite` y `badges` calculados en el servidor (`{ key, tone, icon, text }`). Para el público expone solo `is_urgent` calculado (sin `contact_phone` ni flags internos); para autor, Staff o Admin incluye `contact_phone` y flags internos para edición/gestión. |
| `POST /api/pets/{id}/favorite/` | Sesión activa (`IsAuthenticated`) | Marca una mascota activa y visible (`published` o `adopted`) como favorita o reactiva el registro si tenía baja lógica (idempotente: `201` al crear, `200` si ya existía). |
| `DELETE /api/pets/{id}/favorite/` | Sesión activa (`IsAuthenticated`) | Desmarca una mascota de los favoritos del usuario aplicando baja lógica (`is_active=False`, idempotente, `204`). |
| `PATCH /api/pets/{id}/` | Autor, Staff o Admin (`IsPetOwnerOrStaffOrAdmin`) | Edita campos permitidos y `health` sin modificar `status`, `is_urgent_validated` ni `published_by`. Si el autor edita una mascota `published`, vuelve a `in_review` y queda en `PetStatusLog`; un pedido con los mismos datos no cuenta como cambio y no la manda a revisión. Una mascota `rejected` no se edita (`400`). |
| `DELETE /api/pets/{id}/` | Autor, Staff o Admin (`IsPetOwnerOrStaffOrAdmin`) | Da de baja lógica la mascota (`is_active=False`). |
| `POST /api/pets/{id}/adopt/` | Autor, Staff o Admin (`IsPetOwnerOrStaffOrAdmin`) | Marca como `adopted` una mascota en estado `published` y registra la transición en `PetStatusLog`. |
| `POST /api/pets/{id}/approve/` | Staff o Admin (`IsStaffOrAdmin`) | Aprueba una mascota en `in_review`: pasa a `published` (aparece en el catálogo) y registra quién y el motivo (`note`, opcional) en `PetStatusLog`. Si no está en `in_review`, devuelve `400`. |
| `POST /api/pets/{id}/reject/` | Staff o Admin (`IsStaffOrAdmin`) | Rechaza una mascota en `in_review`: pasa a `rejected` y registra quién y el motivo en `PetStatusLog` (si `note` llega vacío, guarda un motivo genérico). Una rechazada es final: no se edita ni se cambian sus fotos. |
| `POST /api/pets/{id}/urgency/` | Staff o Admin (`IsStaffOrAdmin`) | Con `{"validated": true}` valida el "caso urgente" que pidió quien publicó; con `false` le quita la validación (la insignia y el filtro `urgent` muestran solo urgencias validadas y no adoptadas). Solo en mascotas `in_review` o `published`; validar una urgencia no pedida devuelve `400`. Cada cambio queda en `PetStatusLog`; pedir el valor que ya tiene responde `200` sin cambios. |
| `POST /api/pets/{id}/photos/` | Autor, Staff o Admin (`IsPetOwnerOrStaffOrAdmin`) | Sube una nueva foto validada al carrusel (si el autor edita una `published`, vuelve a `in_review`; en una `rejected` devuelve `400`). |
| `DELETE /api/pets/{id}/photos/{photo_id}/` | Autor, Staff o Admin (`IsPetOwnerOrStaffOrAdmin`) | Da de baja lógica una foto impidiendo dejar a la mascota sin fotos activas y compacta posiciones desde `0` (en una `rejected` devuelve `400`). |

**Insignias calculadas (BK-04):** todas las respuestas de mascotas incluyen el campo de solo lectura `badges` (lista ordenada de `{ key, tone, icon, text }`), calculado en `backend/apps/pets/badges.py` a partir de los datos reales de la mascota; nunca se eligen ni se aceptan desde el cliente.

**Flujo de revisión reutilizable (BK-06):** aprobar y rechazar está escrito una sola vez en `backend/apps/core/review.py` (`ReviewWorkflow`): controla el rol de quien revisa, que la publicación esté activa y en `in_review`, el motivo (hasta 255 caracteres) y el registro en el historial, todo en una transacción. Cada app solo lo configura: las mascotas usan `PetReviewWorkflow` (historial en `PetStatusLog`; solo el Admin publica sin revisión) y los productos de la tienda (BK-12) van a usar `ProductReviewWorkflow` con `ProductStatusLog`.

## Endpoints de solicitudes de adopción (`/api/adoption-requests/`)

| Método y ruta | Permiso | Qué hace |
| :--- | :--- | :--- |
| `POST /api/adoption-requests/` | Sesión activa (`IsAuthenticated`) | Envía el cuestionario de adopción de 4 bloques para una mascota activa y `published` que no haya publicado el mismo usuario: datos personales (edad ≥ 18); hogar y entorno (`housing_type` en texto libre, `home_ownership` y `rental_allows_pets`, obligatorio solo si la vivienda es `rented`); experiencia y rutina (`adoption_reason` opcional), y compromiso (`accepts_commitment`, `accepts_follow_up`, `accepts_return_notice` y `declares_truthful` en `true`, y `accepts_neutering` en `true` solo si la mascota no está castrada). Guarda los datos declarados por el solicitante y nace en `pending`, impidiendo duplicar una solicitud `pending` para la misma mascota. |
| `GET /api/adoption-requests/mine/` | Sesión activa (`IsAuthenticated`) | Lista paginada de a 12 (`{ count, next, previous, results }`, `?page=2`) de las solicitudes activas enviadas por el usuario autenticado, ordenadas de la más reciente a la más antigua (filtro opcional `?status=pending\|approved\|rejected`). |
| `GET /api/adoption-requests/review-queue/` | Staff o Admin (`IsStaffOrAdmin`) | Cola de revisión del panel de Staff: lista paginada de a 12 (`?page=2`) de las solicitudes activas en estado `pending`, ordenadas de la más vieja a la más nueva (`created_at` ascendente). |
| `GET /api/adoption-requests/{id}/` | Solicitante, Staff o Admin (`404` para terceros) | Devuelve el detalle y la respuesta de la solicitud (responde `404` a terceros autenticados para no revelar su existencia). Cuando está `approved`, incluye `foster_contact` (nombre, rol, `contact_phone` de la publicación y `shelter_public_address` si quien publicó es un refugio verificado que la cargó; si no, `null`) para que coordinen el encuentro entre ellos, sin exponer nunca la dirección de la cuenta. Cuando está `rejected`, incluye `rejection_reason` y oculta `foster_contact`. |
| `POST /api/adoption-requests/{id}/approve/` | Staff o Admin (`IsStaffOrAdmin`) | Aprueba una solicitud en `pending` siempre que la mascota siga activa y `published`: no lleva cuerpo (no hay punto de encuentro que fije Staff), pasa a `approved`, registra `reviewed_by` y `reviewed_at` y devuelve la respuesta con `foster_contact` (sin la dirección de la cuenta). Si no está `pending` o la mascota ya no está disponible, devuelve `400`. |
| `POST /api/adoption-requests/{id}/reject/` | Staff o Admin (`IsStaffOrAdmin`) | Desaprueba una solicitud en `pending` (permitido incluso si la mascota ya fue adoptada o dada de baja, para no dejar solicitudes colgadas): requiere `rejection_reason` (motivo para el solicitante, hasta 400 caracteres), pasa a `rejected`, registra `reviewed_by` y `reviewed_at` y mantiene `foster_contact` en `null`. Si no está `pending`, devuelve `400`. |
