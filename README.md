# BackScan Web — V0.1

Fork de raylanfelipe1/backscan. Esta branch substitui a página de comprovante fictício e o mecanismo de envio de localização ao Telegram por um **painel privado de registro de ameaças e evidências**.

## O que já está implementado
- Interface responsiva hospedável pela Vercel (Vite + JavaScript).
- Login Supabase Auth (sem criação pública de contas).
- Cadastro e listagem de incidentes, com data, canal, contato e relato.
- Upload de imagens, PDF ou texto (até 10 MB) em bucket privado.
- Hash SHA-256 calculado no navegador e vinculado à evidência.
- Links assinados temporários para consultar arquivos e exportação CSV.
- Políticas RLS e isolamento por usuário no SQL.

**Não há recursos de rastreamento encoberto, geolocalização, envio de mensagens ou integração com Telegram.**

## Configuração de banco separado
1. Crie um projeto Supabase **exclusivo** para o BackScan. Não reutilize o banco do R4Food nem do R4Finance.
2. No SQL Editor desse novo projeto, execute uma única vez sql/schema.sql.
3. Em Authentication, desative novos cadastros públicos e crie somente os usuários autorizados a acessar o painel.
4. Use a URL do projeto e sua chave PUBLICÁVEL. Nunca exponha secret keys/service_role no frontend.

## Deploy na Vercel
1. Importe raylanfelipe1/backscan e configure Vite (Build: npm run build; Output: dist).
2. Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em Preview e Production.
3. Use inicialmente a branch develop em Preview. **Não publique a main antiga**: ela contém uma interface enganosa e código de localização/Telegram.
4. Rode npm install e npm run build. Verifique que o painel exige login.
5. Confirme a RLS tentando acessar dados de outra conta e que upload/download não são públicos.

## Desenvolvimento local
- Requer Node.js 22.12 ou superior.
- Copie .env.example para .env.local e configure os valores públicos.
- Execute npm install, npm run dev.
- Execute npm run check, npm run build.

## Segurança e limites
- Não comite arquivos de evidência reais; envie-os apenas por um banco já configurado com RLS.
- O painel é um gerenciador de evidências, não uma ferramenta para identificar usuários de WhatsApp.
- IP, GPS e identidade não são inferidos nem coletados pela aplicação.
- O CSV exportado contém dados sensíveis; armazene-o em local seguro.
- Não há backend Telegram ou servidor Express; Vercel entrega o frontend e o Supabase expõe dados somente conforme RLS.
