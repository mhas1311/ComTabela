# 📊 ComTabela - Controle Financeiro Pessoal

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.4.5-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-2.105.4-3ECF8E.svg)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3.0-38B2AC.svg)](https://tailwindcss.com/)

> Um aplicativo moderno de controle financeiro pessoal que ajuda você a gerenciar despesas, categorizar transações e visualizar padrões de gastos com uma interface elegante e intuitiva.

## 📖 Resumo em Inglês

**ComTabela** is a modern personal finance tracking application built with React, Vite, and Supabase. It helps users manage expenses, categorize transactions, and visualize spending patterns through an elegant and intuitive dark-themed interface. Features include secure authentication, interactive dashboard, transaction management, category system, and responsive design.

## ✨ Funcionalidades

- 🔐 **Autenticação Segura**: Login, cadastro com medidor de força e recuperação de senha com Supabase Auth
- 📊 **Dashboard Interativo**: Fluxo de caixa (6 meses), despesas por categoria (Recharts), múltiplas contas/carteiras e modo privacidade
- 💳 **Gerenciamento de Transações**: Lançamentos únicos, parcelados e fixos mensais, filtros avançados, busca e exportação (CSV, Excel e PDF)
- 🏷️ **Categorias e Metas**: Organização visual e tetos mensais de gastos por categoria
- 💼 **Módulo Operações**: Calculadora EV/Kelly, diário de entradas EV+ (P&L vs. EV esperado) e gestão de estoque de revenda
- 📱 **Responsivo**: Sidebar no desktop, barra inferior no mobile e visão em cards adaptativa
- 🔒 **Segurança**: Isolamento por `user_id`, proteção contra CSV Injection e Row Level Security (RLS) no Supabase

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** - Biblioteca JavaScript para interfaces
- **Vite** - Build tool rápido e moderno
- **Tailwind CSS** - Estilização e sistema de design
- **Recharts** - Gráficos interativos de fluxo de caixa e performance
- **Lucide React** - Ícones modernos e consistentes
- **React Router** - Roteamento para SPA

### Backend & Banco
- **Supabase** - Plataforma backend-as-a-service
- **PostgreSQL** - Banco de dados relacional
- **Supabase Auth** - Autenticação e autorização
- **Row Level Security** - Segurança a nível de linha

### Ferramentas de Desenvolvimento
- **ESLint** - Linting e padronização de código
- **Vite Plugin React** - Integração React com Vite

## 📋 Pré-requisitos

Antes de começar, você vai precisar ter instalado em sua máquina:

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Uma conta no [Supabase](https://supabase.com/)

## 🚀 Instalação e Configuração

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/comtabela.git
cd comtabela
```

### 2. Instale as dependências
```bash
npm install
# ou
yarn install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

### 4. Configure o Supabase

1. Acesse seu [painel do Supabase](https://supabase.com/dashboard)
2. Crie um novo projeto ou use um existente
3. Vá para o **SQL Editor**
4. Execute o script de políticas em [`SUPABASE_POLICY.md`](./SUPABASE_POLICY.md) para configurar a segurança das tabelas

### 5. Execute o projeto
```bash
npm run dev
# ou
yarn dev
```

O aplicativo estará disponível em `http://localhost:5173`

## 📁 Estrutura do Projeto

```
comtabela/
├── public/                 # Arquivos estáticos
├── src/
│   ├── assets/             # Imagens e recursos
│   ├── components/         # Layout unificado, modais, skeletons e exportação
│   │   ├── AppLayout.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── ExportButton.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── Skeleton.jsx
│   ├── contexts/           # Autenticação, notificações e workspace isolado
│   │   ├── AuthContext.jsx
│   │   ├── ToastContext.jsx
│   │   └── WorkspaceContext.jsx
│   ├── lib/                # Cliente Supabase, datas locais e sanitizadores
│   │   ├── date.js
│   │   ├── formatters.js
│   │   └── supabase.js
│   ├── pages/              # Páginas da aplicação
│   │   ├── Categories.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx
│   │   ├── Operations.jsx
│   │   └── Transactions.jsx
│   ├── index.css           # Sistema de design e tokens CSS
│   ├── App.jsx             # Roteamento e provedores
│   └── main.jsx            # Ponto de entrada
├── SUPABASE_POLICY.md      # Esquema SQL e políticas RLS do Supabase
├── package.json            # Dependências e scripts
├── vite.config.js          # Configuração do Vite
└── README.md               # Este arquivo
```

## 📜 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Visualiza o build de produção localmente
- `npm run lint` - Executa o linter ESLint

## 🔧 Configuração do Supabase

Para que o aplicativo funcione corretamente, é necessário configurar as políticas de segurança no Supabase. Consulte o arquivo [`SUPABASE_POLICY.md`](./SUPABASE_POLICY.md) para obter as instruções detalhadas.

As tabelas principais do projeto são:
- `categories` - Categorias de despesas/receitas
- `transactions` - Transações financeiras

## 🤝 Contribuição

Contribuições são sempre bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---