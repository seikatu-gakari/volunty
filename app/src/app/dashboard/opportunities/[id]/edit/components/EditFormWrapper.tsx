"use client";

import { updateOpportunity } from "@/lib/dashboard/actions";
import { OpportunityForm } from "../../../components/OpportunityForm";
import type { OpportunityFormData } from "../../../components/OpportunityForm";

interface EditFormWrapperProps {
  opportunityId: string;
  initialData: OpportunityFormData;
}

export function EditFormWrapper({
  opportunityId,
  initialData,
}: EditFormWrapperProps) {
  const handleSubmit = async (formData: FormData) => {
    return await updateOpportunity(opportunityId, formData);
  };

  return (
    <OpportunityForm
      initialData={initialData}
      mode="edit"
      onSubmitAction={handleSubmit}
      cancelHref={`/dashboard/opportunities/${opportunityId}`}
    />
  );
}
