"use client";

import { useState } from "react";

import { PetReviewCard } from "@/components/staff/PetReviewCard";
import {
  type PetReviewAction,
  PetReviewModal,
} from "@/components/staff/PetReviewModal";
import { PetUrgencyControl } from "@/components/staff/PetUrgencyControl";
import {
  ReviewActions,
  ReviewQueueView,
} from "@/components/staff/ReviewQueueView";
import { useReviewQueue } from "@/components/staff/useReviewQueue";
import { fetchPetReviewQueue } from "@/lib/pets/review";
import type { PetReviewItem } from "@/lib/pets/types";

interface PendingReview {
  action: PetReviewAction;
  pet: PetReviewItem;
}

/** Cola de publicaciones en revisión: primero las urgentes, después de la más vieja a la más nueva. */
export function PetReviewQueue() {
  const queue = useReviewQueue(fetchPetReviewQueue);
  const [review, setReview] = useState<PendingReview | null>(null);

  function startReview(action: PetReviewAction, pet: PetReviewItem) {
    queue.setNotice(null);
    setReview({ action, pet });
  }

  function handleClose() {
    setReview(null);
    queue.reloadIfStale();
  }

  function handleReviewed(action: PetReviewAction, pet: PetReviewItem) {
    setReview(null);
    queue.completeReview(
      action === "approve"
        ? `✅ Aprobaste la publicación de ${pet.name}. Ya está en el catálogo.`
        : `Rechazaste la publicación de ${pet.name}.`,
    );
  }

  return (
    <>
      <ReviewQueueView
        queue={queue}
        loadingMessage="Cargando publicaciones..."
        errorTitle="No pudimos cargar las publicaciones"
        emptyTitle="No hay publicaciones en revisión."
        emptyText="Cuando alguien publique una mascota para adopción, aparece acá."
        summary={(count) =>
          `${count === 1 ? "1 publicación en revisión" : `${count} publicaciones en revisión`} · primero las urgentes`
        }
        paginationLabel="Paginación de publicaciones"
        getKey={(pet) => pet.id}
        renderItem={(pet) => (
          <PetReviewCard
            pet={pet}
            urgency={
              <PetUrgencyControl
                pet={pet}
                onChanged={(updated) =>
                  queue.replaceItem((item) => item.id === updated.id, updated)
                }
              />
            }
          >
            <ReviewActions
              rejectLabel="Rechazar"
              approveLabel="Aprobar"
              onReject={() => startReview("reject", pet)}
              onApprove={() => startReview("approve", pet)}
            />
          </PetReviewCard>
        )}
      />

      {review ? (
        <PetReviewModal
          action={review.action}
          pet={review.pet}
          onClose={handleClose}
          onFailed={queue.markStale}
          onReviewed={() => handleReviewed(review.action, review.pet)}
        />
      ) : null}
    </>
  );
}
