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
        className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: "#FF2B00" }}
      >
        <Pencil size={14} aria-hidden />
        Editar cadastro
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
