"""Configuración de Django para el back de Callejeros Río Cuarto.

Todo lo que cambia entre entornos (tu compu, CI, deploy) se lee de variables de
entorno con django-environ. En local se cargan desde el archivo `.env` de la
raíz del repo (copia de `.env.example`). Nunca se escriben secretos acá.
"""

from datetime import timedelta
from pathlib import Path

import environ

# backend/ (donde está manage.py)
BASE_DIR = Path(__file__).resolve().parent.parent
# Raíz del repo (donde están .env y .env.example)
REPO_DIR = BASE_DIR.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    SEED_USER_PASSWORD=(str, ""),
    JWT_ACCESS_LIFETIME_MINUTES=(int, 60),
    JWT_REFRESH_LIFETIME_DAYS=(int, 1),
    JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS=(int, 30),
    MOCK_VERIFICATION_CODE=(str, "8596"),
)
# Si existe, carga el .env de la raíz. Las variables ya definidas en el sistema
# (por ejemplo, las que pasa Docker o el CI) tienen prioridad.
environ.Env.read_env(REPO_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")


# Aplicaciones

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.core",
    "apps.users",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # CORS tiene que ir antes de CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Base de datos (SQLite en local; en deploy solo cambia DATABASE_URL)

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}


# Contraseñas

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        # Regla de cuentas: mínimo 6 caracteres (README, sección Base de datos).
        "OPTIONS": {"min_length": 6},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Idioma y zona horaria

LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Cordoba"
USE_I18N = True
USE_TZ = True


# Archivos estáticos e imágenes subidas

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# CORS: solo el front puede llamar a la API desde el navegador.

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# Datos semilla de desarrollo (`python manage.py seed`)

SEED_USER_PASSWORD = env("SEED_USER_PASSWORD")


# API REST y autenticación JWT (`djangorestframework-simplejwt`)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

JWT_ACCESS_LIFETIME_MINUTES = env("JWT_ACCESS_LIFETIME_MINUTES")
JWT_REFRESH_LIFETIME_DAYS = env("JWT_REFRESH_LIFETIME_DAYS")
JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS = env("JWT_REMEMBER_ME_REFRESH_LIFETIME_DAYS")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=JWT_ACCESS_LIFETIME_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=JWT_REFRESH_LIFETIME_DAYS),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": True,
}

# Código único de 4 dígitos para verificación de teléfono y recupero maquetados.
MOCK_VERIFICATION_CODE = env("MOCK_VERIFICATION_CODE")
