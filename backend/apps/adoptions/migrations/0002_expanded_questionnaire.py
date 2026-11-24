# Cuestionario de adopción ampliado a 4 bloques (FR-09a, #141).
#
# Las solicitudes que ya existían (solo datos de prueba locales) quedan con los textos y las
# opciones vacíos y con las casillas nuevas en verdadero, para cumplir las restricciones.
# `python manage.py seed` las vuelve a dejar completas.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("adoptions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="adoptionrequest",
            name="home_ownership",
            field=models.CharField(
                choices=[("owned", "Propia"), ("rented", "Alquilada"), ("other", "Otra")],
                default="",
                max_length=20,
                verbose_name="la vivienda es",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="rental_allows_pets",
            field=models.CharField(
                blank=True,
                choices=[("yes", "Sí"), ("no", "No"), ("unknown", "No sé")],
                help_text="Solo se completa si la vivienda es alquilada.",
                max_length=20,
                verbose_name="el alquiler permite animales",
            ),
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="outdoor_space",
            field=models.CharField(
                default="",
                max_length=500,
                verbose_name="patio, balcón o terraza y protecciones",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="household_members",
            field=models.CharField(default="", max_length=500, verbose_name="quiénes viven"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="household_agreement",
            field=models.CharField(
                choices=[("yes", "Sí"), ("not_discussed", "Todavía no lo hablamos")],
                default="",
                max_length=20,
                verbose_name="convivientes de acuerdo",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="previous_pets",
            field=models.CharField(default="", max_length=500, verbose_name="experiencia previa"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="hours_alone",
            field=models.CharField(
                choices=[
                    ("less_than_4", "Menos de 4"),
                    ("4_to_8", "4 a 8"),
                    ("more_than_8", "Más de 8"),
                ],
                default="",
                max_length=20,
                verbose_name="horas por día solo/a",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="living_space",
            field=models.CharField(
                default="",
                max_length=500,
                verbose_name="dónde va a dormir y pasar el día",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="vacation_care",
            field=models.CharField(
                default="",
                max_length=500,
                verbose_name="quién lo cuida en viajes o vacaciones",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="contingency_plan",
            field=models.CharField(
                default="",
                max_length=500,
                verbose_name="qué haría si no puede seguir cuidándolo",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="adoption_reason",
            field=models.CharField(
                blank=True,
                max_length=1000,
                verbose_name="por qué quiere adoptar",
            ),
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="accepts_neutering",
            field=models.BooleanField(
                blank=True,
                help_text="Solo se pide si la mascota no está castrada; si ya lo está, queda vacío.",
                null=True,
                verbose_name="acepta castrar",
            ),
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="accepts_follow_up",
            field=models.BooleanField(default=True, verbose_name="acepta seguimiento"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="accepts_return_notice",
            field=models.BooleanField(
                default=True,
                verbose_name="avisa antes de darlo a otra persona",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="adoptionrequest",
            name="declares_truthful",
            field=models.BooleanField(default=True, verbose_name="declara datos verdaderos"),
            preserve_default=False,
        ),
        migrations.AddConstraint(
            model_name="adoptionrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("accepts_follow_up", True),
                    ("accepts_return_notice", True),
                    ("declares_truthful", True),
                ),
                name="adoption_request_requires_follow_up_notice_truthful",
            ),
        ),
        migrations.AddConstraint(
            model_name="adoptionrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("home_ownership", "rented"), models.Q(("rental_allows_pets", ""), _negated=True)),
                    models.Q(models.Q(("home_ownership", "rented"), _negated=True), ("rental_allows_pets", "")),
                    _connector="OR",
                ),
                name="adoption_request_rental_answer_only_when_rented",
            ),
        ),
        migrations.AddConstraint(
            model_name="adoptionrequest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("accepts_neutering__isnull", True),
                    ("accepts_neutering", True),
                    _connector="OR",
                ),
                name="adoption_request_neutering_true_or_empty",
            ),
        ),
    ]
