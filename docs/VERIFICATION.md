# Verificação — preparação do BackScan Web

Data: 29/10/2026, fuso America/Sao_Paulo.

## Baseline inspecionada

- GitHub `raylanfelipe1/backscan`, develop em `6a9bcaa447c395004a60efeead620a80c283d333`.
- Main em `c049881caf60e7901ca4b11fd3f7e2a3a9cdbb9f`, preservada.
- PR #1 aberto, develop → main. Não houve merge.
- Vercel `backscan-web`: implantação anterior `dpl_2bZuSxRFXy6ih3JMtZ5GnqN4HNAw`, READY, origem develop, target production. Proteção SSO habilitada. Nenhuma variável de ambiente configurada.
- Build original e verificação de sintaxe reproduzidos com sucesso antes das alterações.
- Criação do Supabase dedicado na organização raylanfelipe/região São Paulo recusada pelo limite de projetos gratuitos ativos. Conexão adiada por decisão expressa do usuário; não houve alterações nos outros bancos.

## Verificação local concluída

`npm test`: 10 testes aprovados. Executam o schema real em PostgreSQL via PGlite, com tabelas mínimas de teste representando Auth e Storage.

- Proprietário pode criar e consultar seus incidentes; outra conta não lê, altera ou exclui esses registros.
- Conta sem autorização não cria incidentes, não envia objetos e não se autoautoriza.
- Anônimo não lê tabelas privadas nem envia objetos.
- Upload exige caminho de proprietário e incidente correto; metadado exige objeto existente, hash válido e vínculo consistente.
- Metadados/objetos não podem ser sobrescritos pelas permissões fornecidas.
- Outra conta não vê nem exclui evidências/objetos alheios.
- Revogação de autorização bloqueia novas operações com o mesmo UID.
- Bucket é privado, com limite de 10 MB e lista restrita de tipos.
- Configuração rejeita chaves privadas/legadas, URL inadequada e os bancos excluídos do escopo; build falha antes de gerar bundle com configuração insegura.

`npm run check` e `npm run build`: aprovados.

## Pendências reais

Não foram aplicadas migrações nem executados advisors em um Supabase remoto BackScan, pois o projeto não existe. Login por senha, upload/download de bytes pelo serviço Storage, limites de MIME/tamanho no serviço e expiração de links assinados **não estão certificados** pelos testes locais.

O fluxo que falta verificar é: navegador → Supabase Auth → autorização/RLS → incidente → upload Storage → metadado → download assinado. Executar o roteiro de ACTIVATION.md quando o projeto dedicado estiver disponível.

Navegador local: página sem configuração exibe apenas o aviso de preparação, sem dados ou formulário operacional. Console sem avisos/erros na verificação.
