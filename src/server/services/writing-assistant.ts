// ----------------------------------------------------------------------------
// Assistente de escrita — revisão da descrição do chamado
//
// É assistência à escrita, não conversa: o solicitante relata o problema do
// jeito que sabe e recebe o mesmo relato mais claro. A IA melhora o texto que
// existe — nunca inventa causa, comportamento ou informação técnica que o
// usuário não escreveu, porque um chamado com fato inventado custa mais caro à
// triagem do que um chamado mal escrito.
//
// O provedor é a Groq (camada gratuita), pela API compatível com o formato
// OpenAI. Sem GROQ_API_KEY o recurso simplesmente não é oferecido: abrir
// chamado nunca depende dele.
// ----------------------------------------------------------------------------

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// Modelo disponível na camada gratuita da Groq. A oferta muda com o tempo e
// varia por conta: GET /openai/v1/models lista o que a chave alcança, e
// GROQ_MODEL troca este padrão sem mexer no código.
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 25_000;

export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 4000;

const SYSTEM_PROMPT = [
  "Você revisa descrições de chamados de suporte técnico escritas por usuários leigos, em português do Brasil.",
  "",
  "Sua única tarefa é melhorar o texto recebido:",
  "- corrija erros ortográficos e gramaticais;",
  "- deixe o texto claro, objetivo e bem organizado;",
  "- estruture melhor as informações que o usuário forneceu;",
  "- preserve integralmente o contexto, a intenção e o significado do relato;",
  "- nunca invente fatos, causas, comportamentos, mensagens de erro, nomes de tela, versões, datas ou qualquer informação técnica que não esteja no texto original;",
  "- nunca remova uma informação relevante;",
  "- nunca altere classificações nem conclusões técnicas do relato;",
  "- quando o texto já estiver claro, faça apenas pequenos ajustes.",
  "",
  "Responda somente com a descrição revisada. Use passos numerados apenas se o relato original já for uma sequência de passos.",
  "Não escreva saudações, títulos, aspas em volta do texto, nem comentários sobre o que você mudou.",
].join("\n");

export type ImprovedDescription =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** Sem chave configurada o botão não aparece: o recurso é opcional. */
export function isWritingAssistantEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

type GroqResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
};

/** O modelo às vezes devolve o texto entre aspas; o campo não as quer. */
function unwrap(text: string): string {
  const trimmed = text.trim();
  const opens = trimmed.startsWith('"') || trimmed.startsWith("“");
  const closes = trimmed.endsWith('"') || trimmed.endsWith("”");
  if (trimmed.length > 1 && opens && closes) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function improveDescription(original: string): Promise<ImprovedDescription> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "O auxílio com IA não está configurado neste ambiente." };
  }

  const text = original.trim();
  if (text.length < DESCRIPTION_MIN_LENGTH) {
    return {
      ok: false,
      error: `Escreva um pouco mais (ao menos ${DESCRIPTION_MIN_LENGTH} caracteres) antes de pedir ajuda à IA.`,
    };
  }
  if (text.length > DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `A descrição passou de ${DESCRIPTION_MAX_LENGTH.toLocaleString("pt-BR")} caracteres: revise-a manualmente.`,
    };
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        // Temperatura baixa: a tarefa é reescrever com fidelidade, não criar.
        temperature: 0.2,
        // Reescrever não pede deliberação: o esforço mínimo corta a latência
        // sem prejudicar o resultado.
        reasoning_effort: "low",
        // O orçamento acompanha o tamanho do relato. Um teto fixo ou sufoca o
        // texto longo ou estoura o limite por minuto da camada gratuita.
        max_completion_tokens: Math.min(2000, 500 + Math.ceil(text.length / 2)),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      // A mensagem do provedor é a única pista de causa quando algo muda do
      // lado dele: vai inteira para o log, sempre.
      const detail = await response.text();
      console.error(
        `Auxílio com IA falhou: HTTP ${response.status} · modelo "${model}" · ${detail}`
      );
      if (response.status === 429) {
        return {
          ok: false,
          error: "O auxílio com IA atingiu o limite de uso no momento. Tente de novo em instantes.",
        };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "O auxílio com IA não está autorizado neste ambiente." };
      }
      // Modelo removido da oferta, renomeado ou fora do alcance da chave — o
      // caso mais provável de quebra silenciosa, e que só se resolve mexendo na
      // configuração. Dizer "tente novamente" aqui seria mentira.
      if (response.status === 404) {
        return {
          ok: false,
          error: `O modelo de IA configurado ("${model}") não está disponível. Ajuste GROQ_MODEL no ambiente.`,
        };
      }
      return { ok: false, error: "Não foi possível revisar o texto agora. Tente novamente." };
    }

    const payload = (await response.json()) as GroqResponse;
    const choice = payload.choices?.[0];
    const suggestion = unwrap(choice?.message?.content ?? "");

    if (!suggestion) {
      return { ok: false, error: "A IA não devolveu uma sugestão. Tente novamente." };
    }

    // Resposta cortada no meio: melhor recusar do que oferecer ao usuário uma
    // descrição pela metade para substituir a dele.
    if (choice?.finish_reason === "length") {
      return {
        ok: false,
        error: "A revisão ficou incompleta porque o relato é muito longo. Divida-o ou revise manualmente.",
      };
    }

    return { ok: true, text: suggestion };
  } catch (error) {
    console.error("Auxílio com IA falhou:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, error: "A revisão demorou demais e foi interrompida. Tente novamente." };
    }
    return { ok: false, error: "Não foi possível revisar o texto agora. Tente novamente." };
  }
}
