const groups = [
  {
    title: "Visão geral",
    items: [{ id: "home", label: "Home", icon: "H" }],
  },
  {
    title: "Produção",
    items: [
      { id: "operacao", label: "Operação", icon: "O", tabs: ["Quadro", "Minha semana", "Recorrências", "Fornecedores"] },
      { id: "conteudo", label: "Conteúdo", icon: "C", tabs: ["Planejamento", "Calendário", "Biblioteca", "Aprovações"] },
      { id: "comercial", label: "Comercial", icon: "V", tabs: ["Leads", "Pipeline", "Propostas", "Campanhas"] },
    ],
  },
  {
    title: "Gestão",
    items: [
      { id: "financeiro", label: "Financeiro", icon: "F", tabs: ["Visão geral", "Receber", "Pagar", "Cobranças", "DRE", "Caixa"] },
      { id: "pessoas", label: "Pessoas", icon: "P", tabs: ["Equipe", "Capacidade", "Horas", "Férias", "Vagas", "eNPS"] },
      { id: "relatorios", label: "Relatórios", icon: "R" },
    ],
  },
  {
    title: "Clientes",
    items: [{ id: "clientes", label: "Clientes", icon: "CL", tabs: ["Carteira", "Risco", "Onboarding", "Arquivos", "NPS", "Cohort"] }],
  },
  {
    title: "Inteligência",
    items: [
      { id: "automacoes", label: "Automações", icon: "A" },
      { id: "zenite-ai", label: "Zenite AI", icon: "AI" },
    ],
  },
  {
    title: "Recursos",
    items: [
      { id: "portal", label: "Portal do Cliente", icon: "PC", tabs: ["Início", "Aprovações", "Calendário", "Solicitações", "Financeiro"] },
      { id: "integracoes", label: "Integrações", icon: "I" },
      { id: "configuracoes", label: "Configurações", icon: "S" },
    ],
  },
];

const tasks = [
  { lane: "Entrada", client: "9FOURGYM", title: "Briefing campanha de setembro", due: "Hoje", tag: "Tráfego", risk: "warn" },
  { lane: "Entrada", client: "Morada", title: "Pedido de landing page", due: "Amanhã", tag: "Site", risk: "" },
  { lane: "Produção", client: "Bike and Fly", title: "Carrossel produto novo", due: "12/09", tag: "Design", risk: "" },
  { lane: "Produção", client: "9FOURGYM", title: "Relatório de performance", due: "13/09", tag: "BI", risk: "" },
  { lane: "Revisão", client: "Clínica Delta", title: "Reel institucional v2", due: "Ontem", tag: "Vídeo", risk: "danger" },
  { lane: "Aprovação", client: "Morada", title: "Calendário editorial", due: "Hoje", tag: "Conteúdo", risk: "warn" },
];

const clients = [
  ["9FOURGYM", "Ativo", "92", "Saudável", "18/20 entregas", "R$ 8.500"],
  ["Morada", "Onboarding", "81", "Saudável", "12/14 entregas", "R$ 6.200"],
  ["Bike and Fly", "Ativo", "67", "Atenção", "9/13 entregas", "R$ 5.400"],
  ["Clínica Delta", "Pausado", "43", "Alto risco", "5/12 entregas", "R$ 3.900"],
];

const screen = document.querySelector("#screen");
const mainNav = document.querySelector("#mainNav");

function buildNav() {
  mainNav.innerHTML = groups
    .map(
      (group) => `
        <section class="nav-group">
          <p class="nav-group-title">${group.title}</p>
          ${group.items
            .map(
              (item) => `
                <button class="nav-item" data-route="${item.id}" type="button">
                  <span class="nav-icon">${item.icon}</span>
                  <span class="label">${item.label}</span>
                </button>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");

  mainNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (!button) return;
    location.hash = button.dataset.route;
    document.querySelector(".sidebar").classList.remove("open");
  });
}

function route() {
  return (location.hash || "#home").replace("#", "");
}

function currentItem(id = route()) {
  return groups.flatMap((group) => group.items).find((item) => item.id === id) || groups[0].items[0];
}

function pageHead(title, subtitle, action = "Criar novo") {
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">ZENITE MKT</p>
        <h1>${title}</h1>
        <p class="lead">${subtitle}</p>
      </div>
      <button class="primary-button" type="button">${action}</button>
    </div>
  `;
}

function tabs(item) {
  if (!item.tabs) return "";
  return `
    <div class="tabs">
      ${item.tabs.map((tab, index) => `<button class="tab ${index === 0 ? "active" : ""}" type="button">${tab}</button>`).join("")}
    </div>
  `;
}

function kpi(label, value, trend, tone = "") {
  return `
    <article class="card kpi">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
      <span class="trend ${tone}">${trend}</span>
    </article>
  `;
}

function bars(values) {
  return `
    <div class="chart">
      ${values
        .map((item) => `<div class="bar"><span style="height:${item.value}%"></span><small>${item.label}</small></div>`)
        .join("")}
    </div>
  `;
}

function attention(items) {
  return `
    <div class="attention-list">
      ${items
        .map(
          (item) => `
            <div class="attention">
              <div><strong>${item.title}</strong><small>${item.meta}</small></div>
              <span class="badge ${item.tone || ""}">${item.badge}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function home() {
  return `
    ${pageHead("Bom dia, Kevin", "Um cockpit executivo para enxergar operação, dinheiro, risco e próximas ações sem garimpar dado em várias telas.", "Perguntar à AI")}
    <div class="grid kpis">
      ${kpi("Receita prevista", "R$ 146,8 mil", "+12% vs. mês anterior")}
      ${kpi("Clientes ativos", "31", "2 em alto risco", "warn")}
      ${kpi("Aprovações pendentes", "11", "4 vencem hoje", "warn")}
      ${kpi("Faturas vencidas", "R$ 9,4 mil", "3 clientes", "danger")}
    </div>
    <div class="grid two" style="margin-top:16px">
      <section class="card">
        <div class="card-title"><h2>Receita e margem - 6 meses</h2><small>Competência</small></div>
        ${bars([
          { label: "Abr", value: 42 },
          { label: "Mai", value: 58 },
          { label: "Jun", value: 52 },
          { label: "Jul", value: 74 },
          { label: "Ago", value: 67 },
          { label: "Set", value: 84 },
        ])}
      </section>
      <section class="card">
        <div class="card-title"><h2>Precisa de atenção</h2><small>Drill-down em 1 clique</small></div>
        ${attention([
          { title: "Clínica Delta caiu para Health 43", meta: "Faturas atrasadas + entregas em revisão há 8 dias", badge: "Alto risco", tone: "danger" },
          { title: "11 peças aguardam decisão do cliente", meta: "4 vencem hoje no portal", badge: "Aprovação", tone: "warn" },
          { title: "7 cards passaram do prazo", meta: "3 dependem de fornecedor externo", badge: "Operação", tone: "danger" },
          { title: "Folhas de horas incompletas", meta: "2 pessoas não enviaram a semana", badge: "Pessoas" },
        ])}
      </section>
    </div>
    <div class="grid three" style="margin-top:16px">
      ${miniPanel("Financeiro", "DSO em 18 dias, cobrança em D+7 para 2 clientes.", "Abrir régua")}
      ${miniPanel("Comercial", "Pipeline com R$ 83 mil em proposta enviada.", "Ver funil")}
      ${miniPanel("Zenite AI", "Anomalia: margem menor em clientes com muito retrabalho.", "Ver fontes")}
    </div>
  `;
}

function miniPanel(title, text, cta) {
  return `<section class="card"><div class="card-title"><h3>${title}</h3><span class="badge">Resumo</span></div><p class="microcopy">${text}</p><button class="quiet-button" type="button">${cta}</button></section>`;
}

function operacao() {
  return `
    ${pageHead("Operação", "Quadro vivo da agência, com entrada, produção, revisão e aprovação. Cada card mostra cliente, prazo, responsável, bloqueios e checklist.", "Novo card")}
    ${tabs(currentItem())}
    <div class="board">
      ${["Entrada", "Produção", "Revisão", "Aprovação"]
        .map(
          (lane) => `
            <section class="lane">
              <div class="lane-head"><span>${lane}</span><small>${tasks.filter((task) => task.lane === lane).length}</small></div>
              ${tasks
                .filter((task) => task.lane === lane)
                .map(
                  (task) => `
                    <article class="task-card">
                      <span class="badge ${task.risk}">${task.client}</span>
                      <h3>${task.title}</h3>
                      <div class="task-meta">
                        <span class="badge">${task.tag}</span>
                        <span class="badge ${task.risk}">${task.due}</span>
                        <span class="badge">KB</span>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function clientes() {
  return `
    ${pageHead("Clientes", "Carteira orientada por saúde, entregas, relacionamento e próximo passo. A ficha 360 agrega tudo sem copiar dado entre módulos.", "Novo cliente")}
    ${tabs(currentItem())}
    <div class="client-layout">
      <section class="card">
        <div class="card-title"><h2>9FOURGYM</h2><span class="badge success">Ativo</span></div>
        <div class="score-ring"><span>92</span></div>
        <p class="microcopy">Health excelente. 18 de 20 entregas no prazo, nenhuma fatura vencida e NPS promotor.</p>
        <div class="timeline" style="margin-top:14px">
          ${attention([
            { title: "Próximo passo", meta: "Apresentar proposta de expansão de mídia", badge: "Hoje", tone: "success" },
            { title: "Último evento", meta: "Conteúdo aprovado no portal por Mariana", badge: "Auditado" },
          ])}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Carteira de clientes</h2><small>Filtro: todos os status</small></div>
        <div class="table-list">
          ${clients
            .map(
              ([name, status, score, band, progress, value]) => `
                <div class="row">
                  <div><strong>${name}</strong><small>${status} · ${progress} · ${value}/mês</small></div>
                  <span class="badge ${band === "Alto risco" ? "danger" : band === "Atenção" ? "warn" : "success"}">Health ${score}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function conteudo() {
  const days = Array.from({ length: 14 }, (_, index) => index + 1);
  return `
    ${pageHead("Conteúdo", "Planejamento, produção, versões e aprovação em um fluxo único. O cliente aprova no contexto certo, com histórico por versão.", "Nova peça")}
    ${tabs(currentItem())}
    <div class="grid two">
      <section class="card">
        <div class="card-title"><h2>Calendário editorial</h2><small>Setembro 2026</small></div>
        <div class="calendar">
          ${days
            .map(
              (day) => `
                <div class="day">
                  <strong>${day}/09</strong>
                  ${day === 4 ? '<div class="event">Reel · 9FOUR</div>' : ""}
                  ${day === 8 ? '<div class="event">Carrossel · Morada</div>' : ""}
                  ${day === 11 ? '<div class="event">Post · Bike</div>' : ""}
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Fila de aprovação</h2><small>Cliente</small></div>
        ${attention([
          { title: "Reel institucional v2", meta: "Clínica Delta · aguardando há 3 dias", badge: "Vence hoje", tone: "danger" },
          { title: "Carrossel lançamento", meta: "Bike and Fly · versão 1", badge: "Aguardando", tone: "warn" },
          { title: "Calendário outubro", meta: "Morada · 22 peças", badge: "No prazo", tone: "success" },
        ])}
      </section>
    </div>
  `;
}

function financeiro() {
  return `
    ${pageHead("Financeiro", "Competência, vencimento e caixa separados visualmente. Cada número explica fórmula, período e registros que o compõem.", "Nova entrada")}
    ${tabs(currentItem())}
    <div class="grid kpis">
      ${kpi("A receber", "R$ 54,2 mil", "9 faturas abertas")}
      ${kpi("A pagar", "R$ 21,7 mil", "5 fornecedores")}
      ${kpi("DSO", "18 dias", "Meta: 15 dias", "warn")}
      ${kpi("Resultado", "R$ 31,8 mil", "+8% margem")}
    </div>
    <div class="grid two" style="margin-top:16px">
      <section class="card"><div class="card-title"><h2>Caixa previsto x realizado</h2><small>6 meses</small></div>${bars([{label:"Abr",value:48},{label:"Mai",value:63},{label:"Jun",value:54},{label:"Jul",value:71},{label:"Ago",value:60},{label:"Set",value:88}])}</section>
      <section class="card"><div class="card-title"><h2>Régua de cobrança</h2><small>Automação assistida</small></div>${attention([
        {title:"D+7 · Clínica Delta", meta:"R$ 3.900 · gestor notificado", badge:"Escalar", tone:"danger"},
        {title:"D+1 · Studio Norte", meta:"R$ 2.100 · tarefa criada", badge:"Atraso", tone:"warn"},
        {title:"D-5 · Morada", meta:"R$ 6.200 · lembrete amigável", badge:"Agendado"},
      ])}</section>
    </div>
  `;
}

function comercial() {
  return `
    ${pageHead("Comercial", "Lead, pipeline, proposta, campanha e receita atribuída na mesma narrativa.", "Novo lead")}
    ${tabs(currentItem())}
    <div class="grid three">
      ${kpi("Leads 30 dias", "184", "+31%")}
      ${kpi("Pipeline aberto", "R$ 83 mil", "14 oportunidades")}
      ${kpi("Taxa lead-cliente", "12,4%", "Last non-direct")}
    </div>
    <div class="grid two" style="margin-top:16px">
      <section class="card"><div class="card-title"><h2>Funil comercial</h2><small>Por estágio</small></div>${bars([{label:"Novo",value:82},{label:"Diagnóstico",value:56},{label:"Proposta",value:38},{label:"Negociação",value:24},{label:"Ganho",value:16},{label:"Perdido",value:10}])}</section>
      <section class="card"><div class="card-title"><h2>Jornada de aquisição</h2><small>Zenite attribution</small></div>${attention([
        {title:"Google · campanha_brand", meta:"Primeiro toque · 40 sessões", badge:"R$ 18k"},
        {title:"Meta · remarketing_setembro", meta:"Último não direto antes da proposta", badge:"Crédito", tone:"success"},
        {title:"Direto", meta:"Ignorado no Last non-direct", badge:"Contexto"},
      ])}</section>
    </div>
  `;
}

function pessoas() {
  return `
    ${pageHead("Pessoas", "Capacidade sem vigilância invasiva: disponibilidade, carga, horas e ausências no contexto da operação.", "Registrar ausência")}
    ${tabs(currentItem())}
    <div class="grid kpis">
      ${kpi("Equipe ativa", "12", "2 em férias este mês")}
      ${kpi("Horas semana", "318h", "86% enviadas")}
      ${kpi("Carga alta", "3 pessoas", "Redistribuir", "warn")}
      ${kpi("eNPS", "61", "Campanha anônima")}
    </div>
    <div class="card" style="margin-top:16px"><div class="card-title"><h2>Capacidade por pessoa</h2><small>Semana atual</small></div>${bars([{label:"Ana",value:72},{label:"Bruno",value:91},{label:"Carol",value:58},{label:"Davi",value:86},{label:"Eva",value:42},{label:"Felipe",value:63}])}</div>
  `;
}

function portal() {
  return `
    ${pageHead("Portal do Cliente", "Uma visão white label e controlada: aprovações, calendário, solicitações, arquivos e financeiro permitido, sem custo interno.", "Ver como cliente")}
    ${tabs(currentItem())}
    <section class="portal-frame">
      <div class="portal-top"><strong>Portal 9FOURGYM</strong><span>Acesso do cliente</span></div>
      <div class="grid three" style="padding:18px">
        ${miniPanel("Aprovações", "3 peças aguardando decisão. Uma vence hoje.", "Abrir")}
        ${miniPanel("Calendário", "22 publicações previstas em setembro.", "Ver mês")}
        ${miniPanel("Financeiro", "Próxima fatura vence em 10/09, boleto anexado.", "Baixar PDF")}
      </div>
      <div style="padding:0 18px 18px">
        ${attention([
          { title: "Solicitação aberta", meta: "Ajustar CTA da landing page · em triagem", badge: "SLA 1d", tone: "warn" },
          { title: "Post aprovado", meta: "Mariana aprovou a versão 2", badge: "Auditado", tone: "success" },
        ])}
      </div>
    </section>
  `;
}

function automacoes() {
  return `
    ${pageHead("Automações", "Builder visual simples para gatilho, condição, espera e ação. Publicação versionada e logs explicáveis.", "Novo workflow")}
    <div class="grid two">
      <section class="card">
        <div class="card-title"><h2>Workflow: lead qualificado</h2><span class="badge success">Publicado v3</span></div>
        <div class="workflow">
          ${["Gatilho · lead.qualified", "Condição · orçamento maior que R$ 5.000", "Espera · próximo dia útil às 09:00", "Ação · criar tarefa para closer", "Ação · webhook CRM externo"]
            .map((step, index) => `<div class="step"><span class="step-number">${index + 1}</span><strong>${step}</strong><span class="badge">OK</span></div>`)
            .join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Saúde das execuções</h2><small>Últimas 24h</small></div>
        ${attention([
          { title: "128 execuções concluídas", meta: "Tempo médio 420ms", badge: "Saudável", tone: "success" },
          { title: "2 webhooks com retry", meta: "Fornecedor respondeu 429", badge: "Backoff", tone: "warn" },
          { title: "0 dead-letter", meta: "Nenhuma ação perdida", badge: "OK", tone: "success" },
        ])}
      </section>
    </div>
  `;
}

function generic() {
  const item = currentItem();
  return `
    ${pageHead(item.label, "Protótipo navegável desta área. A estrutura visual já prevê estados vazios, erro, filtros e drill-down, mesmo quando a lógica real entrar depois.", "Configurar")}
    ${tabs(item)}
    <div class="grid three">
      ${miniPanel("Status", "Área desenhada para nascer com próximo passo claro e dados de demonstração.", "Explorar")}
      ${miniPanel("Permissões", "O conteúdo respeita papel, workspace e escopo de cliente.", "Ver regra")}
      ${miniPanel("Observabilidade", "Cada ação crítica deve deixar histórico, fonte e data.", "Ver logs")}
    </div>
  `;
}

const renderers = {
  home,
  operacao,
  clientes,
  conteudo,
  financeiro,
  comercial,
  pessoas,
  portal,
  automacoes,
};

function render() {
  const id = route();
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === id);
  });
  screen.innerHTML = (renderers[id] || generic)();
}

function openPalette() {
  const palette = document.querySelector("#commandPalette");
  palette.hidden = false;
  document.querySelector("#paletteInput").focus();
}

function closePalette() {
  document.querySelector("#commandPalette").hidden = true;
}

buildNav();
render();

window.addEventListener("hashchange", render);
document.querySelector("#searchButton").addEventListener("click", openPalette);
document.querySelector("#commandPalette").addEventListener("click", (event) => {
  if (event.target.id === "commandPalette") closePalette();
});
document.querySelector("#mobileMenu").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openPalette();
  }
  if (event.key === "Escape") closePalette();
});
