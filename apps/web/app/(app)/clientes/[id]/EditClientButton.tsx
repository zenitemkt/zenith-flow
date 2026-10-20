"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ClientFormModal, type ClientFormValues } from "../_components/ClientFormModal";

export function EditClientButton({
  clientId,
  initialValues,
  hasAvatar,
  hasBanner,
}: {
  clientId: string;
  initialValues: Partial<ClientFormValues>;
  hasAvatar?: boolean;
  hasBanner?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
      >
        <Pencil size={14} aria-hidden />
        Editar dados
      </button>
      <ClientFormModal
        open={open}
        onClose={() => setOpen(false)}
        mode="edit"
        clientId={clientId}
        initialValues={initialValues}
        hasAvatar={hasAvatar}
        hasBanner={hasBanner}
      />
    </>
  );
}
