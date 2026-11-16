# Callejeros Río Cuarto

Plataforma web comunitaria de **adopción responsable** y **alertas de animales en la calle** para Río Cuarto (Córdoba, Argentina). Conecta a refugios, particulares y vecinos: catálogo de mascotas en adopción, Alerta Callejeros para animales perdidos o en peligro, apadrinamiento, tienda solidaria y noticias.

Proyecto integrador de la **Práctica Profesionalizante II** — Tecnicatura Superior en Desarrollo de Software, ITEC, 2026.

> 🚧 **En desarrollo.** Este README se completa a medida que avanza el proyecto (arquitectura, base de datos, instalación, variables de entorno, tests y API).

## Equipo

| Integrante | GitHub |
| :--- | :--- |
| Franco Nicolás Bressan Nadal | [@fbressan-itec](https://github.com/fbressan-itec) |
| Ulises Cabrera | — |
| Leandro Odetto | — |

## Tecnologías

| Parte | Tecnologías |
| :--- | :--- |
| Backend | Python · Django · Django REST Framework · uv · pytest · ruff |
| Base de datos | ORM de Django · SQLite |
| Frontend | Next.js · TypeScript · Tailwind CSS · Vitest · ESLint |
| DevOps | Docker · GitHub Actions |
| Organización | GitHub Projects (Kanban) |

## Estructura

```
backend/    API REST (Django + DRF)
frontend/   Aplicación web (Next.js)
docs/       Documentación y bitácora del equipo
```

## Base de datos

Diseño del modelo de datos (ORM de Django + SQLite). Se completa por partes: cuentas, adopción y colaborar, comunidad. Cualquier cambio posterior se hace con una **migración nueva** y se actualiza este diagrama en el mismo PR.

### Convenciones

- **Modelo base (`BaseModel`):** todas las tablas de negocio lo heredan y suman `created_at` (fecha de creación), `updated_at` (última modificación) e `is_active` (baja lógica).
- **Baja lógica:** nunca se borran filas de negocio; se marca `is_active = False`. Las consultas normales traen solo los activos (`Model.objects.active()`).
- **Tablas de historial** (`*Log`): registran quién hizo un cambio y cuándo. No se editan ni se dan de baja, por eso solo llevan `created_at`.
- **Quién hizo algo** se guarda con una clave foránea al usuario (`performed_by_id`), nunca copiando su nombre.
- **Valores fijos** (estados, acciones): `TextChoices` de Django; el valor guardado en inglés y el texto visible en español.
- **Nombres** de tablas y campos en inglés, en `snake_case`.
- **Imágenes:** el archivo va a `media/` (o al almacenamiento externo en deploy); la base guarda solo la ruta.
- **Índices:** las claves primarias, las foráneas y los campos únicos ya tienen índice automático.

### Cuentas y roles

```mermaid
erDiagram
    Role ||--o{ User : "se asigna a"
    User ||--|| UserPreferences : "tiene"
    User ||--o{ UserStatusLog : "historial de"
    User ||--o{ UserStatusLog : "realiza"
    User ||--o{ UserRoleLog : "historial de"
    User ||--o{ UserRoleLog : "realiza"
    Role ||--o{ UserRoleLog : "rol anterior"
    Role ||--o{ UserRoleLog : "rol nuevo"
    Role {
        int id PK
        string code UK "member|verified_shelter|staff|admin"
        string name "texto de la insignia"
        bool is_active
        datetime created_at
        datetime updated_at
    }
    User {
        int id PK
        string email UK "se usa para iniciar sesión"
        string password "hash (nunca la contraseña real)"
        string first_name
        string last_name
        string phone
        bool is_phone_verified
        string photo "ruta del archivo"
        date birth_date
        string city
        string neighborhood
        string address "privado: nunca se expone"
        int role_id FK
        bool is_active "estado actual"
        datetime created_at
        datetime updated_at
    }
    UserPreferences {
        int id PK
        int user_id FK, UK
        bool notify_requests_and_posts
        bool notify_nearby_alerts
        bool notify_sponsored_updates
        bool notify_news_and_events
        bool notify_extra_channel "maquetado"
        bool show_phone_in_alerts
        bool show_photo_in_comments
        datetime created_at
        datetime updated_at
    }
    UserStatusLog {
        int id PK
        int user_id FK
        string action "deactivated|reactivated"
        string reason "self_deleted|admin_action"
        int performed_by_id FK
        string note
        datetime created_at
    }
    UserRoleLog {
        int id PK
        int user_id FK
        int previous_role_id FK
        int new_role_id FK
        int performed_by_id FK
        string note
        datetime created_at
    }
```

| Tabla | Para qué |
| :--- | :--- |
| `Role` | Catálogo de roles. `code` es el que usa el back para los permisos; `name` es el texto de la insignia. Un usuario tiene un solo rol; al registrarse, `member`. |
| `User` | Usuario propio (reemplaza al de Django desde la primera migración). Inicia sesión con `email`; no tiene `username`. |
| `UserPreferences` | Preferencias de notificación y de privacidad (uno a uno con `User`). Se crea al registrarse, todas en sí salvo `notify_extra_channel`. |
| `UserStatusLog` | Historial de bajas y reactivaciones: si el usuario se dio de baja solo (A3) o lo hizo un Admin (A4), y quién. |
| `UserRoleLog` | Historial de cambios de rol: rol anterior, rol nuevo y qué Admin lo cambió. |

**Reglas de cuentas:**
- **Contraseña:** mínimo **6 caracteres**. Si no se cumple, el mensaje de error lo dice explícitamente: "La contraseña debe tener al menos 6 caracteres". Se valida en el back y en el front.
- `is_active` de `User` es el estado actual (Django no deja iniciar sesión a un usuario inactivo); la historia completa queda en `UserStatusLog`.
- Solo el Admin cambia roles; cada cambio deja una fila en `UserRoleLog`.

### Comunidad: alertas, noticias, comentarios y notificaciones

Las tablas de `User` se muestran solo con su relación; sus campos están en el diagrama de cuentas.

```mermaid
erDiagram
    User ||--o{ Alert : "publica"
    User ||--o{ Alert : "resuelve"
    User ||--o{ Alert : "oculta"
    User ||--o{ News : "escribe"
    Alert |o--o{ Comment : "tiene"
    News |o--o{ Comment : "tiene"
    User ||--o{ Comment : "escribe"
    User ||--o{ Comment : "oculta"
    User ||--o{ Notification : "recibe"
    Alert {
        int id PK
        string title
        string situation "lost|sighted|emergency"
        string species "dog|cat|other"
        string location_text "ej. Plaza Roca"
        decimal latitude "3 decimales: nivel cuadra"
        decimal longitude "3 decimales: nivel cuadra"
        string description
        string contact_phone
        string photo "obligatoria, hasta 5 MB"
        string status "open|resolved"
        int published_by_id FK
        int resolved_by_id FK "autor o Staff"
        datetime resolved_at
        bool is_hidden
        int hidden_by_id FK
        string hidden_reason
        datetime hidden_at
        bool is_active
        datetime created_at
        datetime updated_at
    }
    News {
        int id PK
        string title
        string summary
        string body
        string tag_label "ej. Próximo Sábado • 16:00 hs"
        string tag_color "emerald|blue|..."
        string place
        string photo "ruta del archivo"
        int author_id FK
        bool is_active
        datetime created_at
        datetime updated_at
    }
    Comment {
        int id PK
        int alert_id FK "uno de los dos"
        int news_id FK "uno de los dos"
        int author_id FK
        string text
        bool is_hidden
        int hidden_by_id FK
        string hidden_reason
        datetime hidden_at
        bool is_active
        datetime created_at
        datetime updated_at
    }
    Notification {
        int id PK
        int recipient_id FK
        string title
        string text
        string tag "urgent|community|adoption|fundraising|post|sponsorship"
        string link "opcional"
        bool is_read
        datetime read_at
        bool is_active
        datetime created_at
        datetime updated_at
    }
```

| Tabla | Para qué |
| :--- | :--- |
| `Alert` | Alerta Callejeros. Exige cuenta, se publica al instante y aparece en el mapa mientras está abierta. |
| `News` | Noticias y eventos. Las cargan Staff y Refugio verificado. |
| `Comment` | Comentarios de alertas **y** de noticias en una sola tabla. Exige cuenta y se publica al instante. |
| `Notification` | Avisos de la campanita, generados por los eventos (publicación aprobada, solicitud respondida, etc.). |

**Reglas de comunidad:**
- **Revisión antes vs. moderación después:** `Pet` y `Product` pasan por revisión antes de publicarse (estados + historial `*StatusLog`). `Alert` y `Comment` se publican al instante y Staff los modera después con `is_hidden`, `hidden_by_id`, `hidden_reason` y `hidden_at`.
- **Dos bajas lógicas distintas:** `is_active = False` → lo borró su autor; `is_hidden = True` → lo ocultó Staff, con motivo.
- **Coordenadas:** el back redondea latitud y longitud a 3 decimales (unos 100 m, nivel cuadra) antes de guardarlas.
- **Teléfono de la alerta:** se guarda siempre; la API no lo devuelve si el autor apagó `show_phone_in_alerts`.
- **Alerta resuelta:** sale del mapa y del listado por defecto (hay un filtro para verla); sus comentarios quedan como historial.
- **Restricción en la base:** en `Comment`, exactamente uno de `alert_id` o `news_id` tiene valor (`CHECK`).

### Índices

Las claves primarias, las foráneas y los campos únicos ya tienen índice automático. Además se agregan índices en los campos que se usan seguido para filtrar u ordenar:

| Tabla | Índice | Lo usa |
| :--- | :--- | :--- |
| `Pet` | `status` + `species` + `sex` | Catálogo con filtros. |
| `Pet` | `estimated_birth_date` | Filtro por edad (Cachorro, Adulto, Senior). |
| `AdoptionRequest` | `status` + `created_at` | Panel de Staff: solicitudes pendientes, las más viejas primero. |
| `Sponsorship` | `pet_id` + `status` | Contador de padrinos activos. |
| `Product` | `status` | Tienda y panel de Staff. |
| `Alert` | `status` + `situation` + `created_at` | Listado de alertas con filtros, las más recientes primero. |
| `Comment` | `alert_id` + `created_at` · `news_id` + `created_at` | Comentarios de una alerta o noticia, en orden. |
| `News` | `created_at` | Listado de noticias, las más recientes primero. |
| `Notification` | `recipient_id` + `is_read` + `created_at` | Campanita: consulta cada 30–60 s las no leídas. |

## Flujo de trabajo

- **Tablero Kanban:** [Callejeros — Tablero](https://github.com/users/fbressan-itec/projects/1). Cada tarea es una tarjeta con historia de usuario y criterios de aceptación.
- **Ramas (GitFlow simplificado):**
  - `main`: versiones entregables (v0.1, v0.2…);
  - `develop`: integración;
  - `feature/<n°>-<nombre>` y `bugfix/<n°>-<nombre>`: una por tarjeta, desde `develop`;
  - `hotfix/<nombre>`: errores urgentes en `main`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat(auth): agrega endpoint de login`). Se revisan automáticamente en cada PR.
- **Pull Requests:** todo entra a `develop` por PR, con revisión de código y *merge commit* (cada commit queda visible en el historial). `main` y `develop` están protegidas: no se puede subir directo.
- **Bitácora:** cada integrante registra su avance en [`docs/bitacora/`](docs/bitacora/LEEME.md).
