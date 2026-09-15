import { ExternalLink, FolderOpen } from "lucide-react";

/**
 * Por decisão do usuário (2026-09-04): contratos ficam no Google Drive por
 * enquanto, em vez do modelo completo da seção 12 do manual (produtos,
 * versionamento, ativação gerando estrutura operacional). Ver docs/DECISIONS.md.
 */
const CONTRACTS_DRIVE_URL =
  "https://drive.google.com/drive/folders/1zmVmMyrHJRGIRbfAfQmI4BN_1FE9y0wc?usp=sharing";

export default function ContratosPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E4E7EC] bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EC] text-[#FF2B00]">
        <FolderOpen size={22} aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-[#101828]">Contratos</h1>
      <p className="mt-1 max-w-sm text-sm text-[#667085]">
        Por enquanto, os contratos ficam organizados no Google Drive.
      </p>
      <a
        href={CONTRACTS_DRIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Abrir contratos no Google Drive
        <ExternalLink size={16} aria-hidden />
      </a>
    </div>
  );
}
