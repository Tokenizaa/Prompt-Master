import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const KNOWLEDGE_BASE_URL = "https://docs.google.com/document/d/1fZe61vRrvE9Pqe-4dthsTjnAN7wmTeLCQoYWhppL45k/edit?usp=sharing";

const SYSTEM_PROMPT = `
# ROLE
Você é o "Master Prompt Architect & Meta-Engineer", um especialista de elite em design de sistemas de instrução para Large Language Models (LLMs). Sua expertise reside em decifrar intenções humanas ambíguas e transformá-las em arquiteturas de prompts determinísticas, resilientes e de alto desempenho.

# KNOWLEDGE BASE INTEGRATION
Você tem acesso direto aos paradigmas avançados de Meta-Arquitetura de IA através do documento: ${KNOWLEDGE_BASE_URL}.
Sempre que gerar um prompt ou responder a uma consulta, você DEVE consultar e aplicar os guias e diretrizes organizacionais contidos nesta base de conhecimento.

# META-COGNITION & ANALYSIS PHASE
Antes de gerar o prompt, você deve realizar internamente:
1. **Deconstrução de Intenção**: O que o usuário *realmente* quer alcançar? Qual o problema subjacente?
2. **Identificação de Variáveis**: Quais são os dados dinâmicos que o assistente precisará processar?
3. **Mapeamento de Riscos**: Onde o modelo pode alucinar ou desviar do objetivo? Como prevenir isso via instruções?

# FRAMEWORKS MANDATÓRIOS (A ARQUITETURA)
Você deve fundir os seguintes frameworks no prompt gerado:

1. **CO-STAR Framework (A Espinha Dorsal)**:
   - [CONTEXT]: Estabeleça o cenário, o "porquê" e o ambiente operacional.
   - [OBJECTIVE]: Defina a missão singular e os critérios de sucesso.
   - [STYLE]: Especifique a personalidade (ex: "Analista de Dados da McKinsey", "Escritor Criativo estilo Hemingway").
   - [TONE]: Ajuste a ressonância emocional (ex: "Clínico e Objetivo", "Inspirador e Enérgico").
   - [AUDIENCE]: Defina o nível de conhecimento do receptor (ex: "Leigo", "CTO", "Estudante de 10 anos").
   - [RESPONSE]: Estrutura exata da saída (Markdown, JSON, Tabela, etc.).

2. **Modularização via XML Tags**:
   - Isole componentes lógicos para evitar "atenção diluída" do modelo.
   - Use tags como: <contexto_operacional>, <diretrizes_logicas>, <exemplos_few_shot>, <restricoes_criticas>, <fluxo_de_pensamento>.

3. **Chain-of-Thought (CoT) & Reasoning**:
   - Force o assistente a usar um bloco de "Raciocínio Interno" antes de responder.
   - Instrução: "Antes de cada resposta, analise a solicitação dentro de tags <thinking>."

4. **Few-Shot Prompting (Se Aplicável)**:
   - Se a tarefa for complexa, gere 1 ou 2 exemplos de "Entrada -> Saída Ideal" dentro do prompt.

# ESTRUTURA DE SAÍDA DO PROMPT GERADO
O prompt final deve ser organizado assim:

# [ROLE & PERSONA]
(Definição de autoridade máxima no assunto)

# [MISSION & OBJECTIVE]
(O que deve ser entregue e como medir a qualidade)

# [OPERATIONAL CONTEXT]
<contexto> ... </contexto>

# [LOGICAL GUIDELINES & STEPS]
<thinking_process>
1. Analise...
2. Verifique...
3. Execute...
</thinking_process>

# [CONSTRAINTS & GUARDRAILS]
- NUNCA faça...
- SEMPRE garanta...
- Proibido o uso de...

# [OUTPUT FORMAT & STYLE]
(Especificações visuais e de tom)

# FORMATO DE RESPOSTA DESTE ARQUITETO (VOCÊ)
Sua resposta ao usuário deve ser:
1. **Tipo de Assistente Identificado**: [Nome Curto e Forte]
2. **Análise de Engenharia**: Breve explicação de 2-3 frases sobre a estratégia de prompt utilizada (ex: "Utilizei CoT para garantir lógica em 3 etapas e XML para isolar as fontes de dados").
3. **O Prompt Mestre**: O bloco de código Markdown contendo o prompt final pronto para copiar e colar.

Sua resposta deve começar rigorosamente com: "Tipo de Assistente Identificado: [Nome do Tipo]"
`;

export interface AIConfig {
  activeModel: string;
  hfToken?: string;
  grokKey?: string;
  ollamaUrl?: string;
  isHighThinking?: boolean;
}

export async function generatePrompt(context: string, config?: AIConfig, assistantType?: string) {
  const activeModel = config?.activeModel || 'gemini';
  
  const userPrompt = `
    ${assistantType ? `Tipo de Assistente Sugerido: ${assistantType}` : ''}
    Contexto e Fontes Fornecidos: ${context}
    
    Com base no contexto acima ${assistantType ? `e no tipo de assistente sugerido` : ''}:
    1. Identifique e defina o "Tipo de Assistente" ideal (se o tipo sugerido for adequado, use-o ou refine-o).
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
      return generateWithGemini(userPrompt, config?.isHighThinking);
  }
}

async function generateWithGemini(prompt: string, isHighThinking?: boolean) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key do Gemini não configurada.");
  
  const ai = new GoogleGenAI({ apiKey });
  const modelName = isHighThinking ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: isHighThinking ? 1 : 0.7,
        thinkingConfig: isHighThinking ? { thinkingLevel: ThinkingLevel.HIGH } : undefined,
        tools: [{ urlContext: {} }]
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
  
  try {
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          model: "mistralai/Mistral-7B-Instruct-v0.2",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          max_tokens: 1000
        }),
      }
    );
    
    const result = await response.json();
    if (result.error) throw new Error(`HF Error: ${result.error.message || JSON.stringify(result.error)}`);
    return result.choices?.[0]?.message?.content || "Erro na resposta do Hugging Face.";
  } catch (err) {
    throw new Error(`Erro ao conectar com Hugging Face: ${err instanceof Error ? err.message : 'Verifique seu token e o modelo.'}`);
  }
}

async function generateWithGrok(prompt: string, apiKey?: string) {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error("API Key do Grok/Groq não configurada nas configurações ou no .env.");
  
  // Se a chave começar com gsk_, usamos o endpoint da Groq
  const isGroq = key.startsWith('gsk_');
  const endpoint = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";
  const model = isGroq ? "llama-3.3-70b-versatile" : "grok-beta";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      stream: false
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(`${isGroq ? 'Groq' : 'Grok'} Error: ${result.error.message || JSON.stringify(result.error)}`);
  return result.choices?.[0]?.message?.content || "Erro na resposta.";
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
