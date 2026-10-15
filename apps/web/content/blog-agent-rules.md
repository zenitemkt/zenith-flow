# Regras de escrita — Blog do Zenite Hub

> Rascunho inicial (2026-10-15) — revisar com o Gabriel antes de ligar a rotina de verdade. Editar este
> arquivo já vale na próxima rodada do agente, sem precisar sincronizar nada manualmente.

## Tom de voz

- Direto, em português do Brasil, sem gírias regionais nem formalidade excessiva.
- Frases curtas. Parágrafos de 2-4 frases.
- Use números e exemplos concretos em vez de afirmações genéricas ("um CPL de R$ 50" em vez de
  "um custo baixo").
- Nunca prometa resultado garantido. Nunca use superlativo vazio ("a melhor agência", "resultados
  incríveis").

## Estrutura obrigatória

- `category`: uma de `Marketing Digital`, `SEO`, `Tráfego Pago`, `Vendas`.
- `cover`: uma de `seo`, `indexacao`, `inbound`, `assessoria`, `cpl`, `whatsapp`, `ads`, `local`,
  `landing`, `rapido`, `remarketing`, `alternativas` — escolha a mais próxima do tema do artigo.
- `title`: 30-60 caracteres, contém a `focusKeyword`, sem travessão.
- `excerpt`: 70-160 caracteres, começa com maiúscula.
- `focusKeyword`: 2-5 palavras, aparece nos 2 primeiros parágrafos e em pelo menos um subtítulo `##`.
- Corpo em Markdown: subtítulos `##`/`###`, listas `-`/`1.`, tabelas `|`, citação `>`, bloco de exemplo
  `:::exemplo ... :::` (situação/números fictícios).
- 1-2 links internos no formato `[texto](@slug-do-artigo)` — o slug precisa existir de verdade (consulte
  `/llms.txt` antes de escolher).
- `coverSearchTerm`: 2-4 palavras em inglês, concretas e visuais (ex.: "laptop analytics dashboard"),
  usado pra buscar a foto de capa real no Wikimedia Commons — não repita a `focusKeyword` em português
  aqui, a busca funciona melhor em inglês.

## Proibido (reprovação automática)

- Travessão (—/–), ponto e vírgula.
- Conectores formais: "ou seja", "portanto", "além disso", "por outro lado", "por fim", "no entanto".
- Muletas: "é importante", "vale ressaltar", "vale destacar".
- Adjetivo vazio ou promessa: "fascinante", "incrível", "essencial", "crucial", "poderoso",
  "revolucionário", "alavancar", "potencializar", "a melhor agência", "garantido".
- Vocabulário vago: "jornada de transformação", "transformação digital", "ecossistema".
- Estrutura "não é apenas X" / "não é X, é Y".
- Parágrafo ou linha repetida de um artigo já publicado (consulte `/llms-full.txt`).
- Abrir o artigo do mesmo jeito que o último artigo publicado (varie a primeira frase).

## Antes de escrever

1. Busque `GET /api/admin/agent-rules` (este arquivo) pra confirmar que não mudou.
2. Leia `/llms.txt` e `/llms-full.txt` do Zenite Hub pra não repetir tema nem slug.
3. Escolha um tema que ainda não foi coberto, dentro das 4 categorias acima.

## Depois de escrever

1. Chame `POST /api/admin/blog-drafts/validate` (dry run, não salva nada). Corrija até não sobrar
   violação.
2. Chame `POST /api/admin/blog-drafts` com o conteúdo final — isso grava como rascunho pendente.
   **Não publica sozinho.** Um humano revisa e aprova pela tela de Automações no Zenite Flow.
3. Se um rascunho seu tiver um comentário aberto (`GET /api/admin/blog-drafts/revisions`), reescreva
   considerando o pedido e envie de novo.
