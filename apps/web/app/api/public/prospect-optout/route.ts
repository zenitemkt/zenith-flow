import { optOutProspect } from "@/lib/prospecting/outreach";

/** Link "sair da lista" dos e-mails de prospecção (GET pelo navegador, POST pelo descadastro em 1 clique do Gmail/Outlook). */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function page(message: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zenite</title></head><body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#101828;text-align:center"><p style="font-size:17px">${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!TOKEN_RE.test(token)) return page("Link inválido.", 400);
  await optOutProspect({ optOutToken: token });
  return page("Pronto. Você não vai mais receber nossos e-mails.");
}

export const GET = handle;
export const POST = handle;
