"use client";

import { useCallback, useState } from "react";

import { AdoptionQuestionnaireModal } from "@/components/adoptions/AdoptionQuestionnaireModal";
import { AdoptionSuccessModal } from "@/components/adoptions/AdoptionSuccessModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { PetActions } from "@/components/pets/PetActions";
import type { PetDetail } from "@/lib/pets/types";

const ADOPT_BUTTON_ID = "btn-pet-adopt";

function focusAdoptButton() {
  document.getElementById(ADOPT_BUTTON_ID)?.focus();
}

/**
 * Acciones de la ficha con el recorrido de adopción: "¡Adoptame!" abre el cuestionario
 * de 4 pasos y, al enviarlo, el modal "¡Datos enviados correctamente!".
 */
export function PetAdoptionFlow({ pet }: { pet: PetDetail }) {
  const { user } = useAuth();
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "";

  const handleCloseQuestionnaire = useCallback(() => {
    setIsQuestionnaireOpen(false);
    focusAdoptButton();
  }, []);

  const handleSubmitted = useCallback(() => {
    setIsQuestionnaireOpen(false);
    setIsSuccessOpen(true);
  }, []);

  const handleCloseSuccess = useCallback(() => {
    setIsSuccessOpen(false);
    focusAdoptButton();
  }, []);

  return (
    <>
      <PetActions pet={pet} onAdoptClick={() => setIsQuestionnaireOpen(true)} />
      <AdoptionQuestionnaireModal
        isOpen={isQuestionnaireOpen}
        pet={pet}
        prefill={{ fullName, email: user?.email ?? "" }}
        onClose={handleCloseQuestionnaire}
        onSubmitted={handleSubmitted}
      />
      <AdoptionSuccessModal
        isOpen={isSuccessOpen}
        petName={pet.name}
        onClose={handleCloseSuccess}
      />
    </>
  );
}
