import React, { useState, useRef, useEffect } from 'react';
import { 
  Wand2, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  BookOpen, 
  ShieldCheck, 
  Layout,
  Terminal,
  MessageSquare,
  ChevronRight,
  Loader2,
  History,
  Settings,
  Database,
  Trash2,
  ExternalLink,
  AlertCircle,
  Search,
  Download,
  Star,
  Bookmark,
  Zap,
  GraduationCap,
  Scale,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Lock,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generatePrompt } from './services/geminiService';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { DEFAULT_TEMPLATES, ICON_MAP, Template } from './config/templates';
import * as LucideIcons from 'lucide-react';

interface GeneratedResult {
  id?: string;
  content: string;
  timestamp: Date;
  assistant_type: string;
  context: string;
  rating?: number;
}

type View = 'generator' | 'history' | 'settings';
type AuthView = 'login' | 'register';

export default function App() {
  const [activeView, setActiveView] = useState<View>('generator');
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>('user');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('login');
  
  const [assistantType, setAssistantType] = useState('');
  const [context, setContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyAllStatus, setCopyAllStatus] = useState(false);
  
  // Fallback Models State
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('hf_token') || '');
  const [grokKey, setGrokKey] = useState(() => localStorage.getItem('grok_key') || '');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('ollama_url') || 'http://localhost:11434');
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('active_model') || 'gemini');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const resultRef = useRef<HTMLDivElement>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);

  useEffect(() => {
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setIsSupabaseConfigured(false);
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async (userId: string, userEmail?: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_authorized')
        .eq('id', userId)
        .single();
      
      if (data) {
        setRole(userEmail === 'olfnetto@gmail.com' ? 'superadm' : data.role);
        setIsAuthorized(userEmail === 'olfnetto@gmail.com' ? true : data.is_authorized);
      } else if (userEmail === 'olfnetto@gmail.com') {
        // Fallback para o superadm se o perfil não existir ou falhar
        setRole('superadm');
        setIsAuthorized(true);
        
        // Tenta criar o perfil se ele não existir
        await supabase.from('profiles').upsert({
          id: userId,
          display_name: 'Superadm',
          role: 'superadm',
          is_authorized: true
        });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id, currentUser.email);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id, currentUser.email);
      else {
        setRole('user');
        setIsAuthorized(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('hf_token', hfToken);
    localStorage.setItem('grok_key', grokKey);
    localStorage.setItem('ollama_url', ollamaUrl);
    localStorage.setItem('active_model', activeModel);
  }, [hfToken, grokKey, ollamaUrl, activeModel]);

  useEffect(() => {
    if (user && activeView === 'admin' && role === 'superadm') {
      const fetchProfiles = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data) setProfiles(data);
      };
      fetchProfiles();
    }
  }, [user, activeView, role]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [templates] = useState<Template[]>(() => {
    const customTemplatesStr = (import.meta as any).env.VITE_CUSTOM_TEMPLATES;
    if (customTemplatesStr && typeof customTemplatesStr === 'string' && customTemplatesStr.trim().startsWith('[')) {
      try {
        return JSON.parse(customTemplatesStr);
      } catch (e) {
        console.error('Erro ao processar VITE_CUSTOM_TEMPLATES (JSON inválido):', e);
      }
    }
    return DEFAULT_TEMPLATES;
  });

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
    return <Icon className="w-4 h-4" />;
  };

  const handleRate = async (id: string | undefined, rating: number) => {
    if (!id || !user) return;
    
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ rating })
        .eq('id', id);
      
      if (error) throw error;
      
      if (result && result.id === id) {
        setResult({ ...result, rating });
      }
      setHistory(prev => prev.map(item => item.id === id ? { ...item, rating } : item));
    } catch (error) {
      console.error('Erro ao avaliar:', error);
    }
  };

  const handleCopyAll = () => {
    if (history.length === 0) return;
    const allPrompts = history.map(item => ({
      assistant_type: item.assistant_type,
      timestamp: item.timestamp.toISOString(),
      content: item.content
    }));
    
    const text = JSON.stringify(allPrompts, null, 2);
    navigator.clipboard.writeText(text);
    setCopyAllStatus(true);
    setTimeout(() => setCopyAllStatus(false), 2000);
  };

  const filteredHistory = history.filter(item => 
    item.assistant_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (user && activeView === 'history') {
      const fetchHistory = async () => {
        let query = supabase
          .from('prompts')
          .select('*')
          .order('created_at', { ascending: false });

        // Se não for admin/superadm, filtra apenas os próprios
        if (role === 'user') {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Erro ao buscar histórico:', error);
          return;
        }

        const historyData = data.map(item => ({
          id: item.id,
          content: item.generated_prompt,
          timestamp: new Date(item.created_at),
          assistant_type: item.assistant_type,
          context: item.context,
          rating: item.rating
        }));
        setHistory(historyData);
      };

      fetchHistory();

      const channel = supabase
        .channel('prompts-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'prompts'
        }, () => {
          fetchHistory();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, activeView, role]);

  const handleDelete = async (id: string | undefined) => {
    if (!id || !user) return;
    
    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const handleClearHistory = async () => {
    if (!user || !window.confirm('Tem certeza que deseja limpar todo o histórico? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context.trim() || !user) return;

    setIsLoading(true);
    setGenerationError(null);
    try {
      const generatedText = await generatePrompt(context, {
        activeModel,
        hfToken,
        grokKey,
        ollamaUrl
      });
      
      let identifiedType = 'Assistente Inteligente';
      const typeMatch = generatedText?.match(/Tipo de Assistente Identificado: (.*)/i);
      if (typeMatch && typeMatch[1]) {
        identifiedType = typeMatch[1].trim();
      }

      const promptData = {
        user_id: user.id,
        assistant_type: identifiedType,
        context: context,
        generated_prompt: generatedText
      };

      const { data, error } = await supabase
        .from('prompts')
        .insert([promptData])
        .select()
        .single();

      if (error) throw error;

      const newResult: GeneratedResult = {
        id: data.id,
        content: generatedText || 'Erro ao gerar o conteúdo.',
        timestamp: new Date(),
        assistant_type: identifiedType,
        context: context
      };

      setResult(newResult);
    } catch (error: any) {
      console.error('Erro ao gerar:', error);
      setGenerationError(error.message || 'Ocorreu um erro ao gerar o prompt. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao entrar:', err);
      setAuthError(err.message || 'Erro ao entrar. Tente novamente.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (password.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });
      if (error) throw error;
      setAuthError('Verifique seu e-mail para confirmar o cadastro.');
    } catch (err: any) {
      console.error('Erro ao criar conta:', err);
      setAuthError(err.message || 'Erro ao criar conta. Verifique os dados.');
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  if (!isSupabaseConfigured) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#0A0C10] text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="max-w-md w-full bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold">Configuração Necessária</h2>
          <p className="text-gray-500 dark:text-gray-400">
            As variáveis de ambiente do Supabase não foram encontradas. Por favor, adicione as seguintes chaves nas configurações do AI Studio:
          </p>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl text-left space-y-2 font-mono text-xs">
            <p className="text-blue-600 dark:text-blue-400">VITE_SUPABASE_URL</p>
            <p className="text-blue-600 dark:text-blue-400">VITE_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-sm text-gray-500">
            Após adicionar as chaves, a página será atualizada automaticamente.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F1115] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F1115] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold">Prompt Architect <span className="text-blue-600">Pro</span></h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
              {authView === 'login' ? 'Bem-vindo de volta! Entre para acessar seu histórico.' : 'Crie sua conta para organizar seus prompts.'}
            </p>
          </div>

          <form onSubmit={authView === 'login' ? handleSignIn : handleSignUp} className="space-y-4">
            {authView === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nome</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {authView === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {authView === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {authView === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (user && !isAuthorized && !authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#0A0C10] text-white' : 'bg-gray-50 text-gray-900'}`}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold">Aguardando Aprovação</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Sua conta foi criada com sucesso, mas precisa ser autorizada pelo administrador antes de você acessar o sistema.
          </p>
          <div className="pt-4">
            <button 
              onClick={handleSignOut}
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" /> Sair da Conta
            </button>
          </div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Status: Pendente</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F1115] text-[#1A1A1A] dark:text-gray-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16191F] sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('generator')}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wand2 className="text-white w-5 h-5" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">Prompt Architect <span className="text-blue-600 dark:text-blue-400">Pro</span></h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => setActiveView('generator')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'generator' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Gerador
              </button>
              <button 
                onClick={() => setActiveView('history')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'history' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Histórico
              </button>
              <button 
                onClick={() => setActiveView('settings')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'settings' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Configurações {role === 'superadm' && <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">Admin</span>}
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <div className={`w-2 h-2 rounded-full ${role === 'superadm' ? 'bg-purple-500' : role === 'admin' ? 'bg-blue-500' : 'bg-green-500'}`} />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                {user.user_metadata?.display_name || user.email?.split('@')[0]}
                {role !== 'user' && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-tighter ${role === 'superadm' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {role}
                  </span>
                )}
              </span>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeView === 'generator' && (
            <motion.div 
              key="generator"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Left Column: Input Form */}
              <div className="lg:col-span-5 space-y-8">
                <section>
                  <h2 className="text-2xl font-bold mb-2">Crie seu Assistente</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    Defina o propósito e forneça o contexto necessário. Nossa IA aplicará frameworks como CO-STAR e delimitadores estruturais para você.
                  </p>
                </section>

                {/* Templates Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                    <Bookmark className="w-3 h-3" /> Templates Recomendados
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {templates.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setContext(t.prompt)}
                        className="p-3 text-left rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#16191F] hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {getIcon(t.iconName)}
                          </div>
                          <span className="text-xs font-bold">{t.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                      <BookOpen className="w-3 h-3" /> Descrição, Contexto e Fontes
                    </label>
                    <textarea
                      placeholder="Descreva o que o assistente deve fazer, cole links, referências ou diretrizes específicas..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white dark:bg-[#16191F] dark:text-white min-h-[240px] resize-none"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-gray-400 italic">
                      A IA identificará automaticamente o papel ideal com base na sua descrição.
                    </p>
                  </div>

                  {generationError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Erro na Geração</p>
                        <p className="text-xs opacity-80">{generationError}</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !context.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Gerar Prompt Estruturado
                      </>
                    )}
                  </button>
                </form>

                {/* Features Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#16191F] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-green-500 mb-2" />
                    <h3 className="text-xs font-bold uppercase mb-1">Segurança</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Proteção contra injeção de prompts.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#16191F] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <Layout className="w-5 h-5 text-purple-500 mb-2" />
                    <h3 className="text-xs font-bold uppercase mb-1">CO-STAR</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Framework estrutural de alta performance.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  {!result && !isLoading ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="h-full min-h-[400px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                        <Terminal className="text-gray-400 dark:text-gray-500 w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Aguardando sua entrada</h3>
                      <p className="text-gray-400 dark:text-gray-500 text-sm max-w-xs">
                        Preencha os campos ao lado para gerar um prompt de sistema profissional e otimizado.
                      </p>
                    </motion.div>
                  ) : isLoading ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full min-h-[400px] bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className="relative mb-8">
                        <div className="w-20 h-20 border-4 border-blue-100 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Arquitetando Prompt...</h3>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">Aplicando técnicas de CO-STAR e Few-Shot.</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      ref={resultRef}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-xl overflow-hidden flex flex-col h-full"
                    >
                      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Prompt Gerado</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {result?.id && (
                            <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-4">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => handleRate(result.id, star)}
                                  className={`p-0.5 transition-colors ${star <= (result.rating || 0) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-200'}`}
                                >
                                  <Star className={`w-4 h-4 ${star <= (result.rating || 0) ? 'fill-current' : ''}`} />
                                </button>
                              ))}
                            </div>
                          )}
                          <button 
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiado!' : 'Copiar Prompt'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-8 overflow-y-auto max-h-[600px] prose prose-sm prose-blue dark:prose-invert max-w-none">
                        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                          {result?.content}
                        </div>
                      </div>

                      <div className="mt-auto px-8 py-4 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30">
                        <p className="text-[10px] text-blue-600/60 dark:text-blue-400/60 font-medium uppercase tracking-widest">
                          Gerado em {result?.timestamp.toLocaleTimeString()} • Sincronizado com a Nuvem
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeView === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Histórico de Prompts</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Visualize e recupere prompts gerados anteriormente.</p>
                </div>
                <div className="flex items-center gap-3">
                  {history.length > 0 && (
                    <>
                      <button 
                        onClick={handleClearHistory}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#16191F] border border-red-200 dark:border-red-900/30 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-red-600 dark:text-red-400 shadow-sm"
                        title="Limpar Todo o Histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Limpar Tudo</span>
                      </button>
                      <button 
                        onClick={handleCopyAll}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-600 dark:text-gray-300 shadow-sm"
                      >
                        {copyAllStatus ? <Check className="w-4 h-4 text-green-500" /> : <Download className="w-4 h-4" />}
                        <span className="hidden sm:inline">{copyAllStatus ? 'Copiado!' : 'Exportar Tudo'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {history.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input 
                    type="text"
                    placeholder="Pesquisar por tipo de assistente ou conteúdo..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white dark:bg-[#16191F] dark:text-white shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}

              {history.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
                  <History className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 dark:text-gray-600">Nenhum prompt salvo ainda.</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 border border-gray-200 dark:border-gray-800 rounded-3xl bg-gray-50 dark:bg-gray-800/30">
                  <Search className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 dark:text-gray-600">Nenhum resultado encontrado para "{searchTerm}".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredHistory.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                          {item.assistant_type}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {item.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4 mb-6 font-mono bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex-grow">
                        {item.content}
                      </p>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`w-3 h-3 ${star <= (item.rating || 0) ? 'text-amber-400 fill-current' : 'text-gray-200 dark:text-gray-700'}`} 
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setResult(item);
                              setActiveView('generator');
                            }}
                            className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            Ver Detalhes <ChevronRight className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(item.content);
                            }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Copiar Prompt"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            title="Deletar do Histórico"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Configurações do Sistema</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Gerencie seu perfil, modelos de IA e permissões.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Profile & Models */}
                <div className="lg:col-span-7 space-y-8">
                  {/* Profile Section */}
                  <div className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                        {user.user_metadata?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{user.user_metadata?.display_name || 'Usuário'}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cargo</p>
                        <p className="text-sm font-medium capitalize">{role}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                        <p className="text-sm font-medium text-green-600">Ativo</p>
                      </div>
                    </div>
                  </div>

                  {/* Fallback Models Section */}
                  <div className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <h3 className="text-lg font-bold">Modelos & Fallbacks</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Modelo Ativo</label>
                        <select 
                          value={activeModel}
                          onChange={(e) => setActiveModel(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500"
                        >
                          <option value="gemini">Google Gemini (Padrão)</option>
                          <option value="hf">Hugging Face (Fallback)</option>
                          <option value="grok">xAI Grok (Fallback)</option>
                          <option value="ollama">Ollama (Local)</option>
                        </select>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hugging Face Token</label>
                          <input 
                            type="password"
                            value={hfToken}
                            onChange={(e) => setHfToken(e.target.value)}
                            placeholder="hf_..."
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Grok API Key</label>
                          <input 
                            type="password"
                            value={grokKey}
                            onChange={(e) => setGrokKey(e.target.value)}
                            placeholder="xai-..."
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ollama URL</label>
                          <input 
                            type="text"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            placeholder="http://localhost:11434"
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16191F] dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Theme & Admin */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold">Preferências</h3>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        {theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-blue-400" />}
                        <div>
                          <p className="text-sm font-medium">Tema Visual</p>
                          <p className="text-[11px] text-gray-500">Alterne entre claro e escuro.</p>
                        </div>
                      </div>
                      <button 
                        onClick={toggleTheme}
                        className="px-4 py-2 bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                      >
                        {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">Sincronização</p>
                          <p className="text-[11px] text-gray-500">Seu histórico está seguro no Supabase.</p>
                        </div>
                      </div>
                      <div className="w-10 h-5 bg-green-500 rounded-full relative">
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={handleSignOut}
                      className="w-full py-3 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Sair da Conta
                    </button>
                  </div>
                </div>
              </div>

              {/* Admin Section (Unified) */}
              {role === 'superadm' && (
                <div className="space-y-6 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                    <h2 className="text-2xl font-bold">Painel Administrativo</h2>
                  </div>
                  
                  <div className="bg-white dark:bg-[#16191F] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Usuário</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {profiles.map((profile) => (
                            <tr key={profile.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                    {profile.display_name?.[0]?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">{profile.display_name || 'Sem nome'}</p>
                                    <p className="text-[10px] text-gray-400">{profile.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${
                                    profile.role === 'superadm' ? 'bg-purple-100 text-purple-600' : 
                                    profile.role === 'admin' ? 'bg-blue-100 text-blue-600' : 
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {profile.role}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase w-fit ${
                                    profile.is_authorized ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    {profile.is_authorized ? 'Autorizado' : 'Pendente'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {profile.id !== user.id && (
                                  <div className="flex items-center justify-end gap-2">
                                    {!profile.is_authorized && (
                                      <button 
                                        onClick={async () => {
                                          const { error } = await supabase
                                            .from('profiles')
                                            .update({ is_authorized: true })
                                            .eq('id', profile.id);
                                          if (!error) {
                                            setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_authorized: true } : p));
                                          }
                                        }}
                                        className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 transition-colors"
                                      >
                                        Autorizar
                                      </button>
                                    )}
                                    <select 
                                      value={profile.role}
                                      onChange={async (e) => {
                                        const newRole = e.target.value;
                                        const { error } = await supabase
                                          .from('profiles')
                                          .update({ role: newRole })
                                          .eq('id', profile.id);
                                        if (!error) {
                                          setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
                                        }
                                      }}
                                      className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none focus:border-blue-500 dark:text-white"
                                    >
                                      <option value="user">User</option>
                                      <option value="admin">Admin</option>
                                      <option value="superadm">Superadm</option>
                                    </select>
                                    <button 
                                      onClick={async () => {
                                        if (confirm('Tem certeza que deseja remover este usuário?')) {
                                          const { error } = await supabase
                                            .from('profiles')
                                            .delete()
                                            .eq('id', profile.id);
                                          if (!error) {
                                            setProfiles(prev => prev.filter(p => p.id !== profile.id));
                                          }
                                        }
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
