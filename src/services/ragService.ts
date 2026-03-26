import { GoogleGenAI } from "@google/genai";

const KNOWLEDGE_BASE_URL = "https://docs.google.com/document/d/1fZe61vRrvE9Pqe-4dthsTjnAN7wmTeLCQoYWhppL45k/edit?usp=sharing";

export async function queryKnowledgeBase(query: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key do Gemini não configurada.");
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Você é um especialista em Engenharia de Prompts e Meta-Arquitetura de Personas.
      Sua base de conhecimento é este documento: ${KNOWLEDGE_BASE_URL}
      
      Siga rigorosamente as diretrizes e guias organizacionais deste documento para responder à seguinte consulta:
      
      CONSULTA: ${query}
      
      Sua resposta deve ser estruturada de acordo com os paradigmas avançados descritos na base de conhecimento.
    `,
    config: {
      tools: [{urlContext: {}}]
    },
  });
  
  return response.text;
}
