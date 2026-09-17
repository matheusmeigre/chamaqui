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
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
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
  choices?: Array<{ message?: { content?: string } }>;
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

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        // Temperatura baixa: a tarefa é reescrever com fidelidade, não criar.
        temperature: 0.2,
        max_completion_tokens: 1200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Auxílio com IA falhou:", response.status, detail);
      if (response.status === 429) {
        return {
          ok: false,
          error: "O auxílio com IA atingiu o limite de uso no momento. Tente de novo em instantes.",
        };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "O auxílio com IA não está autorizado neste ambiente." };
      }
      return { ok: false, error: "Não foi possível revisar o texto agora. Tente novamente." };
    }

    const payload = (await response.json()) as GroqResponse;
    const suggestion = unwrap(payload.choices?.[0]?.message?.content ?? "");

    if (!suggestion) {
      return { ok: false, error: "A IA não devolveu uma sugestão. Tente novamente." };
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
