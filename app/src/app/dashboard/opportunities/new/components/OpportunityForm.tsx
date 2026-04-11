"use client";

import { createOpportunity } from "@/lib/dashboard/actions";
import { OpportunityForm } from "../../components/OpportunityForm";

export function OpportunityForm_New() {
  const handleSubmit = async (formData: FormData) => {
    return await createOpportunity(formData);
  };

  return (
    <OpportunityForm
      mode="create"
      onSubmitAction={handleSubmit}
      cancelHref="/dashboard"
    />
  );
}
