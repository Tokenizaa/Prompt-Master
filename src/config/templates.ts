import { Scale, Zap, GraduationCap, Layout, Terminal, Database, LucideIcon } from 'lucide-react';

export interface Template {
  title: string;
  iconName: string;
  description: string;
  prompt: string;
}

export const DEFAULT_TEMPLATES: Template[] = [
  {
    title: "Auditor Frontend",
    iconName: "Layout",
    description: "Auditoria React, Hooks e Performance.",
    prompt: "Preciso de uma auditoria detalhada neste componente React. Foque em performance, uso de hooks e boas práticas de TypeScript."
  },
  {
    title: "Auditor Backend",
    iconName: "Terminal",
    description: "Segurança de API e Arquitetura Node.js.",
    prompt: "Analise este código de backend Node.js buscando vulnerabilidades de segurança, problemas de escalabilidade e melhorias no tratamento de erros."
  },
  {
    title: "DBA Architect",
    iconName: "Database",
    description: "Otimização de Queries e Segurança RLS.",
    prompt: "Audite este esquema de banco de dados e estas queries. Verifique índices, normalização e políticas de segurança RLS."
  },
  {
    title: "Compliance LGPD",
    iconName: "Scale",
    description: "Auditoria de textos e políticas de dados.",
    prompt: "Preciso de um assistente especialista em LGPD para auditar políticas de privacidade e termos de uso."
  }
];

export const ICON_MAP: Record<string, LucideIcon> = {
  Scale,
  Zap,
  GraduationCap,
  Layout,
  Terminal,
  Database
};
