"use client";

import { useState } from "react";

import { AdoptionReviewCard } from "@/components/staff/AdoptionReviewCard";
import { ApproveAdoptionModal } from "@/components/staff/ApproveAdoptionModal";
import { RejectAdoptionModal } from "@/components/staff/RejectAdoptionModal";
import {
  ReviewActions,
  ReviewQueueView,
} from "@/components/staff/ReviewQueueView";
import { useReviewQueue } from "@/components/staff/useReviewQueue";
import { fetchAdoptionReviewQueue } from "@/lib/adoptions/api";
import { getApplicantName } from "@/lib/adoptions/review";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";

type ReviewAction = "approve" | "reject";

interface PendingReview {
  action: ReviewAction;
  request: AdoptionRequestReview;
}

/** Cola de solicitudes de adopción pendientes, de la más vieja a la más nueva. */
export function AdoptionReviewQueue() {
  const queue = useReviewQueue(fetchAdoptionReviewQueue);
  const [review, setReview] = useState<PendingReview | null>(null);

  function startReview(action: ReviewAction, request: AdoptionRequestReview) {
    queue.setNotice(null);
    setReview({ action, request });
  }

  function handleClose() {
    setReview(null);
    queue.reloadIfStale();
  }

  function handleReviewed(message: string) {
    setReview(null);
    queue.completeReview(message);
  }

  return (
    <>
      <ReviewQueueView
        queue={queue}
        loadingMessage="Cargando solicitudes..."
        errorTitle="No pudimos cargar las solicitudes"
        emptyTitle="No hay solicitudes pendientes."
        emptyText="Cuando alguien se postule para adoptar, la solicitud aparece acá."
        summary={(count) =>
          `${count === 1 ? "1 solicitud pendiente" : `${count} solicitudes pendientes`} · de la más vieja a la más nueva`
        }
        paginationLabel="Paginación de solicitudes"
        getKey={(request) => request.id}
        renderItem={(request) => (
          <AdoptionReviewCard request={request}>
            <ReviewActions
              rejectLabel="Desaprobar"
              approveLabel="Aprobar"
              onReject={() => startReview("reject", request)}
              onApprove={() => startReview("approve", request)}
            />
          </AdoptionReviewCard>
        )}
      />

      {review?.action === "approve" ? (
        <ApproveAdoptionModal
          request={review.request}
          onClose={handleClose}
          onFailed={queue.markStale}
          onApproved={() =>
            handleReviewed(
              `✅ Aprobaste la solicitud de ${getApplicantName(review.request)} para ${review.request.pet.name}.`,
            )
          }
        />
      ) : null}
      {review?.action === "reject" ? (
        <RejectAdoptionModal
          request={review.request}
          onClose={handleClose}
          onFailed={queue.markStale}
          onRejected={() =>
            handleReviewed(
              `Desaprobaste la solicitud de ${getApplicantName(review.request)} para ${review.request.pet.name}. Va a ver el motivo en su solicitud.`,
            )
          }
        />
      ) : null}
    </>
  );
}
