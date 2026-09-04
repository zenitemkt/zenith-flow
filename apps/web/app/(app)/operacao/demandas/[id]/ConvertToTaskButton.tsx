"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

interface ProjectOption {
  id: string;
  name: string;
}

export function ConvertToTaskButton({
  requestId,
  requestTitle,
  projects,
}: {
  requestId: string;
  requestTitle: string;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState(requestTitle);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingNew, setCreatingNew] = useState(projects.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/requests/${requestId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskTitle,
        projectId: creatingNew ? null : projectId,
        newProjectName: creatingNew ? newProjectName : "",
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível converter a demanda.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/operacao/projetos/${body.projectId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Converter em tarefa
      </button>
      <Modal open={open} onClose={close} title="Converter em tarefa">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Título da tarefa"
            name="taskTitle"
            required
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />

          {projects.length > 0 && !creatingNew && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-select" className="text-sm font-medium text-[#344054]">
                Projeto
              </label>
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="self-start text-xs font-medium text-[#6847F5] hover:underline"
              >
                + Criar novo projeto
              </button>
            </div>
          )}

          {creatingNew && (
            <div className="flex flex-col gap-1.5">
              <FormField
                label="Nome do novo projeto"
                name="newProjectName"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCreatingNew(false)}
                  className="self-start text-xs font-medium text-[#6847F5] hover:underline"
                >
                  Usar um projeto existente
                </button>
              )}
            </div>
          )}

          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Convertendo..." : "Converter"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
