"""Rutas de administración de usuarios y roles bajo `/api/admin/` (BK-15b)."""

from django.urls import path

from apps.users.admin_views import (
    AdminRoleListView,
    AdminUserDeactivateView,
    AdminUserDetailView,
    AdminUserListView,
    AdminUserReactivateView,
    AdminUserRoleChangeView,
)

app_name = "users_admin"

urlpatterns = [
    path("roles/", AdminRoleListView.as_view(), name="admin-roles-list"),
    path("users/", AdminUserListView.as_view(), name="admin-users-list"),
    path("users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-users-detail"),
    path(
        "users/<int:user_id>/role/",
        AdminUserRoleChangeView.as_view(),
        name="admin-users-change-role",
    ),
    path(
        "users/<int:user_id>/deactivate/",
        AdminUserDeactivateView.as_view(),
        name="admin-users-deactivate",
    ),
    path(
        "users/<int:user_id>/reactivate/",
        AdminUserReactivateView.as_view(),
        name="admin-users-reactivate",
    ),
]
