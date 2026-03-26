import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `
# ROLE
Você é o "Prompt Architect Pro", um Arquiteto de Software Sênior e Especialista em Engenharia de Prompts de Nível Enterprise. Sua missão é transformar descrições simples em "Esqueletos Modulares" de prompts altamente estruturados, utilizando frameworks avançados para maximizar a precisão e o raciocínio dos modelos de linguagem.

# CONHECIMENTO BASE E TÉCNICAS MANDATÓRIAS
Você deve aplicar rigorosamente as seguintes técnicas em cada prompt gerado:

1. **Framework CO-STAR**: 
   - [CONTEXT]: Contexto detalhado do problema ou cenário.
   - [OBJECTIVE]: O que a IA deve alcançar especificamente.
   - [STYLE]: Estilo de escrita (ex: técnico, criativo, executivo).
   - [TONE]: Tom de voz (ex: consultivo, direto, empático).
   - [AUDIENCE]: Para quem a resposta é destinada.
   - [RESPONSE]: Formato final da resposta.

2. **Delimitadores XML (<tag>)**: 
   - Use tags XML para isolar módulos de instrução, dados de entrada e restrições. Isso ajuda o modelo a distinguir unidades de significado.
   - Exemplo: <instrucoes_logicas>, <restricoes_literais>, <exemplos_formato>.

3. **Cadeia de Pensamento (Chain-of-Thought)**: 
   - Instrua explicitamente o assistente gerado a "pensar passo a passo" antes de fornecer a resposta final.

4. **Literalismo de Instrução e Proibições**: 
   - Seja explícito sobre o que é PROIBIDO. Use listas negativas para evitar comportamentos indesejados.

5. **Dicas Direcionais (DSP)**: 
   - Incorpore frameworks específicos da área (ex: AIDA para marketing, SOLID para código, ABNT para acadêmico) como estímulos direcionais.

6. **Harnessing Agêntico (Persistência)**: 
   - Inclua instruções de persistência como "Mantenha o processamento até que [condição] seja satisfeita" para tarefas complexas.

# ESTRUTURA DO PROMPT GERADO (ESQUELETO MODULAR)
Sua saída deve seguir esta hierarquia Markdown:

# [ROLE]
(Definição da Persona com autoridade e especialidade)

# [CONTEXT]
(Cenário detalhado e delimitadores de dados)

# [OBJECTIVE]
(Tarefa principal clara e mensurável)

# [INSTRUCTIONS]
(Uso de Chain-of-Thought e blocos XML para módulos específicos)
<modulo_1> ... </modulo_1>
<modulo_2> ... </modulo_2>

# [CONSTRAINTS & PROHIBITIONS]
(Lista explícita de restrições literais)

# [STYLE & TONE]
(Definição baseada no CO-STAR)

# [RESPONSE FORMAT]
(Estrutura final esperada: Markdown, JSON, Código, etc.)

# FORMATO DE SAÍDA DO ARQUITETO
1. **Análise de Estrutura**: Breve explicação técnica de por que essa arquitetura foi escolhida (mencione CO-STAR, XML e DSP).
2. **O Prompt Mestre**: O prompt final dentro de um bloco de código Markdown.

Sua resposta deve começar com: "Tipo de Assistente Identificado: [Nome do Tipo]"
`;

export interface AIConfig {
  activeModel: string;
  hfToken?: string;
  grokKey?: string;
  ollamaUrl?: string;
}

export async function generatePrompt(context: string, config?: AIConfig) {
  const activeModel = config?.activeModel || 'gemini';
  
  const userPrompt = `
    Contexto e Fontes Fornecidos: ${context}
    
    Com base no contexto acima:
    1. Identifique e defina o "Tipo de Assistente" ideal (ex: Especialista em SEO, Tutor de Matemática, Consultor Jurídico).
    2. Gere o prompt de sistema otimizado seguindo suas diretrizes de arquiteto, incorporando esse papel definido.
    
    Sua resposta deve começar com: "Tipo de Assistente Identificado: [Nome do Tipo]"
    Seguido pela explicação técnica e o bloco de código com o prompt final.
  `;

  switch (activeModel) {
    case 'hf':
      return generateWithHuggingFace(userPrompt, config?.hfToken);
    case 'grok':
      return generateWithGrok(userPrompt, config?.grokKey);
    case 'ollama':
      return generateWithOllama(userPrompt, config?.ollamaUrl);
    case 'gemini':
    default:
      return generateWithGemini(userPrompt);
  }
}

async function generateWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key do Gemini não configurada.");
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    return response.text || "Erro: Resposta vazia do Gemini.";
  } catch (error: any) {
    if (error.message?.includes("Quota exceeded")) {
      throw new Error("Limite de uso do Gemini atingido. Tente novamente mais tarde.");
    }
    throw error;
  }
}

async function generateWithHuggingFace(prompt: string, token?: string) {
  const hfToken = token || process.env.HUGGINGFACE_TOKEN;
  if (!hfToken) throw new Error("Token do Hugging Face não configurado nas configurações ou no .env.");
  
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
  
  const response = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ inputs: fullPrompt, parameters: { max_new_tokens: 1000 } }),
    }
  );
  
  const result = await response.json();
  if (result.error) throw new Error(`HF Error: ${result.error}`);
  return result[0]?.generated_text || result.generated_text || "Erro na resposta do Hugging Face.";
}

async function generateWithGrok(prompt: string, apiKey?: string) {
  const groqKey = apiKey || process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("API Key do Grok não configurada nas configurações ou no .env.");
  
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: "grok-beta",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      stream: false
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(`Grok Error: ${result.error.message}`);
  return result.choices?.[0]?.message?.content || "Erro na resposta do Grok.";
}

async function generateWithOllama(prompt: string, url?: string) {
  const ollamaUrl = url || (import.meta as any).env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
  const model = (import.meta as any).env.VITE_OLLAMA_MODEL || "llama3";
  const temperature = parseFloat((import.meta as any).env.VITE_OLLAMA_TEMPERATURE || "0.7");

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        system: SYSTEM_PROMPT,
        prompt: prompt,
        stream: false,
        options: {
          temperature: temperature
        }
      })
    });

    const result = await response.json();
    return result.response || "Erro na resposta do Ollama.";
  } catch (err) {
    throw new Error(`Erro ao conectar com Ollama: ${err instanceof Error ? err.message : 'Verifique se o Ollama está rodando localmente.'}`);
  }
}
