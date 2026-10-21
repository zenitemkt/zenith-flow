import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | Zenite Hub",
  description: "Como a Zenite Hub trata dados pessoais no site e no portal.",
};

const CONTACT_EMAIL = "zenitemkt@proton.me";

/**
 * Página pública (sem login) exigida pela Meta no cadastro do app: mesma
 * política do site (hubzenite.com.br/politica-de-privacidade) + seção sobre os
 * dados de Facebook/Instagram usados pelo agendador de redes e as instruções de
 * exclusão (âncora #exclusao-de-dados, usada como "URL de instruções").
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 text-[#344054]">
      <article className="mx-auto max-w-2xl text-[15px] leading-relaxed">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FF2B00]">Zenite Hub</p>
          <h1 className="mt-1 text-3xl font-bold text-[#101828]">Política de Privacidade e Cookies</h1>
          <p className="mt-2 text-sm text-[#667085]">Última atualização: 21 de outubro de 2026</p>
        </header>

        <Section title="1. Quem é responsável pelos dados">
          <p>
            A Zenite Hub é a controladora dos dados pessoais tratados diretamente no site hubzenite.com.br e no portal
            portal.hubzenite.com.br. Para assuntos de privacidade, fale com a equipe pelo e-mail <Email />.
          </p>
        </Section>

        <Section title="2. Quais dados podemos coletar">
          <p>
            Quando você preenche o formulário de orçamento, podemos tratar nome, e-mail, telefone, empresa, cidade e
            informações sobre a necessidade comercial. Também podemos receber dados técnicos de navegação, como endereço IP,
            navegador, dispositivo, páginas visitadas, origem da visita e interações com o site, caso ferramentas de medição
            sejam ativadas.
          </p>
          <p>
            No portal, tratamos os dados de cadastro dos usuários (nome, e-mail e papel na conta) e os dados dos clientes
            atendidos pela agência, necessários para a prestação dos serviços de marketing.
          </p>
        </Section>

        <Section title="3. Para que usamos os dados">
          <ul className="list-disc space-y-1 pl-5">
            <li>responder solicitações e preparar propostas;</li>
            <li>retomar o contato solicitado pelo visitante;</li>
            <li>prestar os serviços contratados, incluindo aprovação e publicação de conteúdo;</li>
            <li>proteger o site e o portal contra abuso e falhas;</li>
            <li>medir o uso do site e melhorar conteúdo, navegação e campanhas;</li>
            <li>cumprir obrigações legais e exercer direitos.</li>
          </ul>
          <p>
            O tratamento pode se apoiar no consentimento, na execução de contrato ou em procedimentos preliminares
            relacionados a uma possível contratação, no cumprimento de obrigação legal ou no legítimo interesse, conforme o
            contexto e a legislação aplicável.
          </p>
        </Section>

        <Section title="4. Dados do Facebook e do Instagram (portal)">
          <p>
            Quando um cliente autoriza a conexão da sua Página do Facebook e da sua conta profissional do Instagram ao
            portal, por meio do Login do Facebook, recebemos apenas o necessário para publicar o conteúdo aprovado pelo
            próprio cliente:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>nome, identificador e foto da Página e da conta do Instagram vinculada;</li>
            <li>um token de acesso da Página, guardado de forma criptografada;</li>
            <li>o identificador e o link das publicações feitas pelo portal, para mostrar o status de cada uma.</li>
          </ul>
          <p>
            Esses dados são usados exclusivamente para agendar e publicar posts nas contas do próprio cliente. Não lemos
            mensagens, não coletamos dados de seguidores, não vendemos nem compartilhamos essas informações com terceiros e
            não as usamos para publicidade.
          </p>
        </Section>

        <Section title="5. Cookies, Google e Meta">
          <p>
            Cookies são pequenos arquivos ou identificadores armazenados no navegador. Cookies estritamente necessários podem
            ser usados para segurança, login e funcionamento. Se ferramentas não essenciais forem ativadas, o site poderá
            usar Google Analytics, Google Ads, Google Tag Manager e Meta Pixel para mensurar visitas e conversões, limitar
            repetição de anúncios, criar públicos e avaliar campanhas.
          </p>
          <p>
            Essas tecnologias podem registrar IP, identificadores do navegador ou dispositivo, páginas acessadas, eventos e
            origem da visita. Cookies de análise ou publicidade somente devem ser carregados conforme as escolhas
            apresentadas no gerenciador de cookies, quando aplicável. Você também pode apagar ou bloquear cookies nas
            configurações do navegador, embora isso possa afetar algumas funções.
          </p>
        </Section>

        <Section title="6. Com quem os dados podem ser compartilhados">
          <p>
            Não vendemos dados pessoais. O compartilhamento pode ocorrer, no limite necessário, com fornecedores que apoiam
            hospedagem, armazenamento, segurança, comunicação, medição e publicidade. Quando você decide enviar a mensagem
            preparada pelo formulário, os dados seguem pelo WhatsApp, sujeito aos termos e à política dessa plataforma.
            Dados também podem ser apresentados a autoridades quando houver obrigação legal.
          </p>
        </Section>

        <Section title="7. Armazenamento e segurança">
          <p>
            Guardamos dados pelo tempo necessário para atender a solicitação, prestar o serviço, manter registros comerciais
            e cumprir obrigações legais. Aplicamos medidas técnicas e organizacionais compatíveis com o risco, como
            criptografia de tokens e controle de acesso por papel, mas nenhum sistema é totalmente imune a incidentes.
          </p>
        </Section>

        <Section title="8. Seus direitos">
          <p>
            Nos termos da LGPD, você pode solicitar confirmação do tratamento, acesso, correção, informações sobre
            compartilhamento, portabilidade quando aplicável, anonimização, bloqueio ou eliminação, revogação do
            consentimento e oposição nos casos previstos em lei. Poderemos pedir informações para confirmar sua identidade
            antes de atender a solicitação.
          </p>
        </Section>

        <Section id="exclusao-de-dados" title="9. Como excluir seus dados">
          <p>Para remover a conexão com o Facebook e o Instagram e apagar os dados recebidos da Meta, você pode:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              no portal, abrir o perfil do cliente, seção <strong>Redes conectadas</strong>, e clicar em desconectar. O
              token é apagado na hora;
            </li>
            <li>
              no Facebook, acessar Configurações e privacidade → Configurações → Integrações comerciais, e remover o app
              Zenite Hub;
            </li>
            <li>
              ou enviar um e-mail para <Email /> pedindo a exclusão. Respondemos em até 15 dias com a confirmação.
            </li>
          </ol>
        </Section>

        <Section title="10. Contato e atualizações">
          <p>
            Envie pedidos relacionados aos seus dados para <Email />. Esta política poderá ser atualizada para refletir
            mudanças legais, técnicas ou operacionais; a data no topo indicará a versão vigente.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-7 scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold text-[#101828]">{title}</h2>
      {children}
    </section>
  );
}

function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#FF2B00] underline">
      {CONTACT_EMAIL}
    </a>
  );
}
