"use client";

import { createOpportunity } from "@/lib/dashboard/actions";
import { OpportunityForm } from "../../components/OpportunityForm";
import type { OpportunityFormData } from "../../components/OpportunityForm";

export function OpportunityForm_New({
  initialData,
}: {
  initialData?: OpportunityFormData;
}) {
  const handleSubmit = async (formData: FormData) => {
    return await createOpportunity(formData);
  };

  return (
    <OpportunityForm
      initialData={initialData}
      mode="create"
      onSubmitAction={handleSubmit}
      cancelHref="/dashboard"
    />
  );
}
