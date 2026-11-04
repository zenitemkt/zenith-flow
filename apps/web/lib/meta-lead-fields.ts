/** Campos padrão da Meta viram campos do lead; perguntas personalizadas vão pro resumo. */
export function mapLeadFields(fieldData: Array<{ name: string; values?: string[] }> | undefined) {
  const out: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    city: string | null;
    service: string | null;
    investment: string | null;
    employees: string | null;
    interest: string | null;
    extras: string[];
  } = { name: null, email: null, phone: null, company: null, city: null, service: null, investment: null, employees: null, interest: null, extras: [] };
  let first: string | null = null;
  let last: string | null = null;
  for (const field of fieldData ?? []) {
    const value = (field.values ?? []).join(", ").trim();
    if (!value) continue;
    const key = field.name.toLowerCase();
    if (key === "full_name" || key === "nome_completo") out.name = value;
    else if (key === "first_name") first = value;
    else if (key === "last_name") last = value;
    else if (key === "email" || key === "work_email") out.email ??= value;
    else if (key === "phone_number" || key === "work_phone_number") out.phone ??= value;
    else if (key === "company_name") out.company = value;
    else if (key === "city") out.city = value;
    else {
      // Pergunta personalizada: cai no mesmo campo do formulário do site pelo texto da pergunta.
      const plain = key.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (/servic/.test(plain)) out.service ??= value;
      else if (/invest|verba|orcamento|budget/.test(plain)) out.investment ??= value;
      else if (/funcionari|colaborador|equipe|employee/.test(plain)) out.employees ??= value;
      else if (/interesse|objetivo|desafio/.test(plain)) out.interest ??= value;
      out.extras.push(`${field.name.replace(/_/g, " ")}: ${value}`);
    }
  }
  out.name ??= [first, last].filter(Boolean).join(" ") || null;
  return out;
}

