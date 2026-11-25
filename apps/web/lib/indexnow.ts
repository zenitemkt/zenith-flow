/**
 * Protocolo IndexNow (Bing, Yandex, Seznam, Naver...) — avisa na hora que uma
 * página saiu/mudou, em vez de esperar o buscador redescobrir sozinho via
 * sitemap. A chave é pública (o arquivo de verificação fica hospedado no
 * próprio site, `INDEXNOW_KEY_LOCATION`), não é segredo. Nunca derruba a
 * publicação: falha aqui só vira log.
 */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY?.trim();
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION?.trim();
  if (!key || !keyLocation || urls.length === 0) return;
  const host = new URL(urls[0]!).host;
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
    });
    if (!response.ok && response.status !== 202) {
      console.error("indexnow_notify_failed", response.status, await response.text().catch(() => ""));
    }
  } catch (error) {
    console.error("indexnow_notify_failed", error);
  }
}
