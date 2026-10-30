# Ativação do BackScan Web

Estado em 29/10/2026 (São Paulo): conexão adiada por decisão do usuário. O Supabase recusou o terceiro projeto gratuito ativo; nenhum projeto foi criado e nenhum banco existente foi alterado. As variáveis do projeto Vercel backscan-web permanecem vazias. Não adicionar valores fictícios ou credenciais de outro sistema.

## 1. Provisionar o projeto dedicado

- Organização autorizada: raylanfelipe (`qcgcxloxrrvmdjjrlsiq`). Nome: backscan-web. Região: São Paulo (`sa-east-1`).
- Primeiro resolver a capacidade da conta e consultar novamente o custo. Não pausar, excluir, migrar nem alterar R4Food ou Controle financeiro para contornar o limite.
- Confirmar o nome e o identificador do projeto novo antes de qualquer SQL. Os projetos `wgchpjumclfjwxxxwbgt` e `dvjgjhalheveohtcxifc` são excluídos do escopo e também bloqueados pela configuração do frontend.
- Inspecionar tabelas, buckets e políticas do projeto novo. O SQL foi preparado para um banco novo; se já existirem tabelas BackScan, revisar uma migração em vez de executar novamente o schema.
- Executar `sql/schema.sql` somente nesse projeto. O script é transacional e não modifica Auth/Storage de outros projetos. Verificar RLS, políticas e advisories de segurança após a execução.

## 2. Configurar acesso privado

- Desativar novos cadastros públicos e logins anônimos no Supabase Auth. Manter somente o provedor necessário (e-mail/senha).
- Criar manualmente contas autorizadas no painel Auth; não comitar senhas, tokens ou e-mails reais. O sistema não exige serviço de envio de e-mail para o login por senha de uma conta já confirmada.
- Para cada conta, adicionar o UUID real à lista de autorização pelo SQL Editor, com privilégios administrativos:

```sql
insert into public.authorized_users(user_id)
select id from auth.users where email = 'EMAIL_REAL_DA_CONTA'
on conflict (user_id) do nothing;
```

- Confirmar que exatamente a conta pretendida foi autorizada. A tabela não aceita inserções ou alterações pelo navegador. Criar uma conta no Auth sem adicioná-la a essa lista não libera o painel nem os dados.
- Para revogar acesso, remover sua linha de `public.authorized_users`. As políticas passam a negar novas operações, mesmo que o token ainda seja válido. Links assinados já emitidos podem continuar válidos por até 60 segundos; dados já baixados não são recolhidos.
- O cadastro público precisa ser desativado no serviço Auth mesmo com essa defesa adicional de RLS.

## 3. Configurar somente valores públicos na Vercel

| Variável | Valor permitido | Escopo inicial |
|---|---|---|
| `VITE_SUPABASE_URL` | Origem HTTPS exata do projeto novo, sem barra final | Preview, branch develop |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave moderna `sb_publishable_...` do mesmo projeto | Preview, branch develop |

Todos os valores `VITE_` são públicos no navegador. Nunca cadastrar senha de banco, token administrativo, chave `service_role`, `sb_secret_...` ou JWT legado nessas variáveis. Não é necessária nenhuma chave secreta para o aplicativo operar. O build recusa configuração parcial, chave privada/legada e os dois projetos excluídos do escopo.

Depois de salvar os dois valores, gerar um novo Preview da develop: variáveis Vite são incorporadas durante a compilação. Manter a proteção de acesso da Vercel. Só configurar Production e promover após os testes reais. Não publicar a main original nem fazer merge automático do PR #1.

## 4. Testar no projeto dedicado, com dados sintéticos

1. Abrir a aplicação sem sessão: deve mostrar login sem dados. Testar senha incorreta, usuário autorizado e uma conta Auth sem autorização; a última não deve abrir o painel.
2. Com a conta A autorizada, criar incidente de teste e anexar um TXT conhecido. Confirmar o conteúdo baixado, o hash SHA-256 e o registro do metadado no mesmo incidente. Repetir com PNG/PDF sintéticos. O hash registra integridade do arquivo recebido, sem provar a autoria ou a veracidade do conteúdo.
3. Com a conta B autorizada, tentar consultar, alterar e excluir o incidente, metadado e objeto de A por IDs/caminhos conhecidos: nenhum deve ser acessível.
4. Tentar upload anônimo, arquivo maior que 10 MB, tipo não permitido, caminho de outro proprietário/incidente e sobrescrita (`upsert`): todos devem ser rejeitados. Arquivo permitido novo deve funcionar.
5. Confirmar que URL pública não baixa o objeto e que a URL assinada funciona por 60 segundos e expira. Revogar A e verificar a negação de novas consultas/uploads/URLs assinadas com a sessão existente.
6. Simular falha ao gravar metadados: a interface tenta remover o upload recém-criado e informa se a limpeza falhar. Inspecionar órfãos antes de repetir envios interrompidos.
7. Validar logout e recarregamento, exportação CSV e navegador móvel. Remover apenas dados/arquivos sintéticos pelas APIs autorizadas do Storage e tabelas do BackScan; nunca excluir objetos diretamente por SQL.

Não apagar incidentes/usuários diretamente sem planejar a remoção dos seus arquivos: cascatas de metadados não removem bytes no Storage. Não há exclusão de incidentes pela interface nesta versão.

## Referências

- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Políticas de Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Configuração de Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Variáveis de ambiente Vercel](https://vercel.com/docs/environment-variables)
