import { GoogleGenAI } from "@google/genai";
import { supabase } from "../lib/supabase";

const KNOWLEDGE_BASE_URL = "https://docs.google.com/document/d/1fZe61vRrvE9Pqe-4dthsTjnAN7wmTeLCQoYWhppL45k/export?format=txt";

/**
 * Ingests the knowledge base from Google Docs, chunks it, generates embeddings,
 * and stores them in Supabase vector database.
 */
export async function ingestKnowledgeBase() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key do Gemini não configurada.");
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Fetch content from Google Docs as plain text
    const response = await fetch(KNOWLEDGE_BASE_URL);
    if (!response.ok) throw new Error("Falha ao buscar base de conhecimento do Google Docs.");
    const text = await response.text();

    // 2. Chunking strategy: split by paragraphs and filter small ones
    // In a production app, we'd use more sophisticated recursive character splitting
    const chunks = text
      .split('\n\n')
      .map(c => c.trim())
      .filter(c => c.length > 50);

    if (chunks.length === 0) throw new Error("Nenhum conteúdo válido encontrado no documento.");

    // 3. Clear existing chunks to avoid duplicates during re-ingestion
    // Note: In a multi-tenant app, we'd filter by user/org
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) console.warn("Erro ao limpar chunks antigos:", deleteError);

    // 4. Generate embeddings and store in Supabase
    // We process in batches to avoid rate limits and improve speed
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const embeddingResults = await Promise.all(
        batch.map(chunk => 
          ai.models.embedContent({
            model: 'text-embedding-004',
            contents: [chunk],
            config: { outputDimensionality: 768 }
          })
        )
      );

      const records = batch.map((chunk, index) => ({
        content: chunk,
        embedding: embeddingResults[index].embeddings[0].values,
        metadata: { 
          source: "Google Docs",
          url: KNOWLEDGE_BASE_URL,
          chunk_index: i + index
        }
      }));

      const { error: insertError } = await supabase
        .from('knowledge_chunks')
        .insert(records);

      if (insertError) throw new Error(`Erro ao inserir chunks no Supabase: ${insertError.message}`);
    }

    return { status: 'success', chunksIngested: chunks.length };
  } catch (error: any) {
    console.error("Erro na ingestão RAG:", error);
    throw error;
  }
}

/**
 * Queries the knowledge base using vector search (embeddings) and generates
 * a response using the retrieved context.
 */
export async function queryKnowledgeBase(query: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key do Gemini não configurada.");
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Generate embedding for the user query
    const embeddingResult = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [query],
      config: { outputDimensionality: 768 }
    });
    const queryEmbedding = embeddingResult.embeddings[0].values;

    // 2. Perform vector similarity search in Supabase
    // We try a higher threshold first for precision, then fallback if needed
    let matchThreshold = 0.6;
    let { data: matches, error: searchError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: 5,
    });

    // If no precise matches found, try a more relaxed threshold
    if (!searchError && (!matches || matches.length === 0)) {
      matchThreshold = 0.35;
      const { data: fallbackMatches, error: fallbackError } = await supabase.rpc('match_knowledge_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: 5,
      });
      matches = fallbackMatches;
      searchError = fallbackError;
    }

    if (searchError) throw new Error(`Erro na busca vetorial: ${searchError.message}`);

    // 3. Construct context from matches
    const context = matches && matches.length > 0
      ? matches.map((m: any) => m.content).join('\n\n---\n\n')
      : "Nenhum contexto relevante encontrado na base de conhecimento.";

    // 4. Generate final response with context augmentation
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: `
        Você é o "Meta-Architect (AI)", um especialista em Engenharia de Prompts e Meta-Arquitetura de Personas.
        Sua missão é responder à CONSULTA utilizando exclusivamente os paradigmas e guias organizacionais fornecidos no CONTEXTO abaixo.
        
        # CONTEXTO RECUPERADO DA BASE DE CONHECIMENTO:
        ${context}
        
        # CONSULTA DO USUÁRIO:
        ${query}
        
        # DIRETRIZES DE RESPOSTA:
        1. Se a informação não estiver no contexto, informe que não encontrou dados específicos na base de conhecimento atual.
        2. Use uma linguagem técnica, porém clara, seguindo o tom de voz da Meta-Arquitetura.
        3. Estruture sua resposta com seções claras (ex: Análise, Recomendação, Exemplo).
      `,
    });
    
    return response.text;
  } catch (error: any) {
    console.error("Erro na consulta RAG:", error);
    throw error;
  }
}
