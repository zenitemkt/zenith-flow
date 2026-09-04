"use client";

import { useState } from "react";
import { ClientFormModal } from "../_components/ClientFormModal";

export function NewClientForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Novo cliente
      </button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} mode="create" />
    </>
  );
}
