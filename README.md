# BackScan Web — V0.1

Painel privado de incidentes e evidências, desenvolvido na branch `develop`. A `main` original permanece preservada e não deve ser publicada por este fluxo.

## Situação atual

A interface compila e as políticas SQL passaram por testes locais de isolamento. A conexão real está **pendente**: o Supabase recusou a criação do projeto dedicado por limite de dois projetos gratuitos ativos. O usuário optou por concluir a preparação e adiar a conexão. Nenhum banco R4Food/Finance foi alterado e nenhum valor Supabase foi configurado na Vercel.

Consulte [ativação e testes reais](docs/ACTIVATION.md) e [limites da verificação](docs/VERIFICATION.md).

## Recursos

- Login por senha e autorização administrativa explícita, sem formulário público de cadastro.
- Incidentes privados por usuário, histórico e CSV com neutralização de fórmulas.
- Upload de PNG, JPEG, WebP, PDF e TXT até 10 MB em bucket privado.
- Metadados vinculados ao arquivo, proprietário e incidente, com hash SHA-256.
- Acesso a arquivos por links assinados de 60 segundos.
- RLS para tabelas e Storage; revogação de autorização verificada a cada operação.

Não há coleta de GPS, comprovantes fictícios, rastreamento encoberto ou integração com Telegram.

## Desenvolvimento

Requer Node.js 22.12+ (Vercel usa Node 24). Execute:

```sh
npm ci
npm run check
npm test
npm run build
npm run dev
```

Sem variáveis de ambiente, a aplicação mostra serviço em preparação. Após criar o projeto exclusivo, preencher `.env.local` usando `.env.example`. Somente a URL HTTPS do projeto e sua chave `sb_publishable_...` são aceitas. Nunca colocar segredos em variáveis `VITE_`.

`npm test` executa PostgreSQL em memória com PGlite e tabelas mínimas de Auth/Storage. Testa o mesmo `sql/schema.sql` usado na ativação, sem se conectar a bancos remotos. O script é exclusivo para um projeto novo; não é uma migração incremental para bancos já configurados.

O hash identifica os bytes anexados; não autentica o conteúdo nem identifica usuários de WhatsApp. Os relatórios e arquivos podem conter dados sensíveis e devem permanecer sob controle dos usuários autorizados.
