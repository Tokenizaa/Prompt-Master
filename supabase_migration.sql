-- Tabela de Perfis (Extensão de auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadm')),
  is_authorized BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Perfis
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para Perfis
CREATE POLICY "Perfis são visíveis para o próprio usuário" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Superadm pode ver e gerenciar todos os perfis" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadm'
    )
  );

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tabela de Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type TEXT NOT NULL,
  context TEXT NOT NULL,
  generated_prompt TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Prompts
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Políticas para Prompts
CREATE POLICY "Usuários veem seus próprios prompts se autorizados" ON prompts
  FOR SELECT USING (
    (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)) OR 
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadm') AND is_authorized = true
    )
  );

CREATE POLICY "Usuários inserem seus próprios prompts se autorizados" ON prompts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)
  );

CREATE POLICY "Usuários atualizam seus próprios prompts se autorizados" ON prompts
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)
  );

CREATE POLICY "Usuários deletam seus próprios prompts se autorizados" ON prompts
  FOR DELETE USING (
    (auth.uid() = user_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)) OR 
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadm' AND is_authorized = true
    )
  );

-- Trigger para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  
  INSERT INTO public.profiles (id, display_name, role, is_authorized)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'display_name',
    CASE 
      WHEN user_count = 0 THEN 'superadm' 
      ELSE 'user' 
    END,
    CASE 
      WHEN user_count = 0 THEN true 
      ELSE false 
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Mensagens
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas para Mensagens
CREATE POLICY "Mensagens são visíveis para todos os usuários autorizados" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)
  );

CREATE POLICY "Usuários autorizados podem inserir mensagens" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)
  );

-- Habilitar a extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela para a base de conhecimento (RAG)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(3072), -- Dimensão do gemini-embedding-2-preview
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Knowledge Chunks
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Políticas para Knowledge Chunks
CREATE POLICY "Leitura para usuários autorizados" ON knowledge_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_authorized = true)
  );

-- 1. Remover a função antiga para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, float8, integer);

-- 2. Criar a função com tipos explícitos
CREATE OR REPLACE FUNCTION match_knowledge_chunks (
  query_embedding VECTOR(3072),
  match_threshold FLOAT8,
  match_count INTEGER
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT8
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_chunks.id,
    knowledge_chunks.content,
    knowledge_chunks.metadata,
    1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
