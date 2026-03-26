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
