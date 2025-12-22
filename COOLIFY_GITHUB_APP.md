# Deploy no Coolify via GitHub App (frontend e backend separados)

Guia rapido para subir o Worklenz no Coolify usando a integracao oficial com o GitHub (GitHub App) e criando dois servicos independentes: `backend` e `frontend`. O fluxo abaixo evita depender do docker-compose e usa diretamente os Dockerfiles que ja estao no repositorio.

## Visao geral do repositorio
- Dockerfile do backend: `worklenz-backend/Dockerfile` (porta 3000).
- Dockerfile do frontend: `worklenz-frontend/Dockerfile` (porta 5000).
- Variaveis de exemplo:
  - Backend: `worklenz-backend/.env.template`
  - Frontend: `worklenz-frontend/.env.example`
- Compose pronto para referencia (nao obrigatorio aqui): `coolify-compose.yml`.

## Pre-requisitos
- Coolify em funcionamento com o GitHub App instalado e autorizado para este repositorio.
- Banco PostgreSQL acessivel (pode ser um recurso do proprio Coolify) e um bucket S3 ou R2.
- Dois dominios ou subdominios publicos (ex.: `api.seudominio.com` e `app.seudominio.com`).

## Passo a passo no Coolify

1) Criar projeto e conectar o repo  
   - Projects > + New Project.  
   - Add Resource > Git Repository > escolha o repo via GitHub App e a branch (geralmente `main`).  
   - Mantenha o autodeploy se quiser que cada push na branch dispare um deploy.

2) Servico backend (API)  
   - Tipo: Git Repository / Dockerfile.  
   - Repository path: `worklenz-backend` (monorepo).  
   - Dockerfile: `Dockerfile` (context `.`).  
   - Exposed port: `3000`.  
   - Health check sugerido: HTTP em `/health` ou `/` na porta 3000.  
   - Pre-deploy command (Coolify): `cd /app && bash scripts/predeploy.sh` (roda migrations antes do deploy).  
   - O container executa migrations no start via `scripts/entrypoint.sh` (desativar: `SKIP_DB_MIGRATE=true`, ajustar espera: `DB_MIGRATE_WAIT_SECONDS=30`, baseline: `MIGRATE_BASELINE=false`).  
   - Variaveis obrigatorias (Environment):
     - `NODE_ENV=production`
     - `PORT=3000`
     - `DB_HOST` (host do Postgres no Coolify ou externo)
     - `DB_PORT=5432`
     - `DB_USER`
     - `DB_PASSWORD`
     - `DB_NAME`
     - `SESSION_SECRET` (valor forte)
     - `JWT_SECRET` (valor forte)
     - `SERVER_CORS` = URL publica do frontend (ex.: `https://app.seudominio.com`)
     - `SOCKET_IO_CORS` = mesma URL do frontend
     - `FRONTEND_URL` = mesma URL do frontend
     - `STORAGE_PROVIDER=s3`
     - `S3_ACCESS_KEY_ID`
     - `S3_SECRET_ACCESS_KEY`
     - `S3_BUCKET`
     - `S3_REGION` (para R2 use `auto`)
     - `S3_URL` (endpoint S3, ex.: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
     - `WEB_APP_URL` = URL publica do frontend
     - (opcional SMTP) `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`
   - Gerar secrets com `openssl` (use direto no valor da env, sem aspas):
     - `SESSION_SECRET`: `openssl rand -hex 64`
     - `JWT_SECRET`: `openssl rand -hex 64`
     - `DB_PASSWORD` (se for criar um usuario proprio): `openssl rand -base64 24`
   - Se usar Postgres gerenciado pelo Coolify, crie o recurso de banco e aponte `DB_HOST` para o host interno indicado pelo Coolify.
   - Deploy o backend primeiro e confirme que sobe sem erro.

3) Servico frontend (React)  
   - Tipo: Git Repository / Dockerfile.  
   - Repository path: `worklenz-frontend`.  
   - Dockerfile: `Dockerfile` (context `.`).  
   - Exposed port: `5000`.  
   - Health check sugerido: HTTP em `/` porta 5000.  
   - Variaveis (Environment):
     - `VITE_API_URL=https://api.seudominio.com`
     - `VITE_SOCKET_URL=wss://api.seudominio.com`
     - (opcionais do `.env.example`: `VITE_APP_TITLE`, `VITE_ENABLE_GOOGLE_LOGIN`, etc., conforme necessidade)
   - Habilite deploy automatico se quiser que o frontend siga a mesma branch.

4) Dominios e SSL  
   - Em cada servico, configure o dominio:
     - Backend: `api.seudominio.com` -> porta 3000.
     - Frontend: `app.seudominio.com` -> porta 5000.
   - Ative HTTPS/SSL pelo Coolify (Let’s Encrypt).

5) Ordem de deploy  
   - Primeiro backend (para garantir que a API esteja no ar e com DB/S3 configurados).
   - Depois frontend (apontando para o dominio do backend).

## Erros comuns e como evitar
- Build falha ao baixar deps: garanta que o host tenha memoria suficiente (o build do frontend usa Node 22 e Vite).
- API sobe mas retorna 500: verifique `DB_*`, `JWT_SECRET`, `SESSION_SECRET` e credenciais S3.
- CORS/Socket bloqueado: confirme `SERVER_CORS`, `SOCKET_IO_CORS` e `FRONTEND_URL` com a URL HTTPS final.
- Bucket R2: use `S3_URL` sem o nome do bucket na URL (Coolify passa `S3_BUCKET` separado).

## Se preferir usar Compose
- O arquivo `coolify-compose.yml` ja contem backend, frontend, Postgres e rotina de backup. Basta escolher o tipo Docker Compose no Coolify e colar o conteudo do arquivo, ajustando as mesmas variaveis de ambiente acima. Use essa opcao apenas se quiser gerir todos os containers juntos.
