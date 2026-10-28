# Deploy do Farol no Firebase Hosting

## Arquitetura do deploy

O Firebase Hosting publica somente o frontend React gerado em `web/dist`. O Supabase continua responsável por autenticação, banco de dados e pela Edge Function `classificar-risco`.

O arquivo `firebase.json` redireciona todas as rotas para `index.html`. Isso é necessário para que rotas como `/clientes/novo` e `/clientes/123` funcionem quando abertas diretamente.

## 1 Criar o projeto no Firebase

1. Acesse <https://console.firebase.google.com/>.
2. Clique em `Adicionar projeto`.
3. Escolha um identificador, por exemplo `farol-cs-alpha`.
4. O Google Analytics é opcional para esta entrega.
5. Dentro do projeto, abra `Hosting` e clique em `Começar`.
6. Anote o ID exato do projeto exibido em `Configurações do projeto`.

Use Firebase Hosting, não Firebase App Hosting. Este projeto é uma SPA estática criada com Vite e não precisa de Cloud Run.

## 2 Fazer um primeiro teste local

Na raiz do repositório:

```powershell
cd web
npm ci
npm run build
cd ..
npx firebase-tools login
npx firebase-tools deploy --only hosting --project SEU_PROJECT_ID
```

Ao final, o Firebase informa endereços semelhantes a:

- `https://SEU_PROJECT_ID.web.app`
- `https://SEU_PROJECT_ID.firebaseapp.com`

O arquivo `.firebaserc` não é necessário porque o projeto é informado explicitamente no comando e pelo secret do workflow.

## 3 Criar a conta de serviço do GitHub

1. No Firebase, abra `Configurações do projeto`.
2. Abra `Contas de serviço`.
3. Clique em `Gerar nova chave privada` e confirme.
4. Guarde o JSON baixado temporariamente. Não copie o arquivo para o repositório e nunca faça commit dele.

Para menor privilégio, uma conta criada especificamente no Google Cloud IAM para o workflow é preferível. Para a Alpha, a chave gerada pelo Firebase é o caminho mais curto.

## 4 Configurar os GitHub Secrets

No repositório do GitHub, abra `Settings`, `Secrets and variables`, `Actions` e `New repository secret`.

Crie estes quatro secrets:

| Secret | Conteúdo |
| --- | --- |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase, por exemplo `farol-cs-alpha` |
| `FIREBASE_SERVICE_ACCOUNT` | Todo o conteúdo do JSON da conta de serviço |
| `VITE_SUPABASE_URL` | Mesmo valor usado no `web/.env` local |
| `VITE_SUPABASE_ANON_KEY` | Mesmo valor usado no `web/.env` local |

A chave `anon` do Supabase é usada pelo navegador e faz parte do build. Ela não substitui RLS e nunca deve ser trocada pela `service_role`.

## 5 Executar o CI CD

O workflow está em `.github/workflows/firebase-hosting.yml`.

- Pull request para `main`: executa `npm ci`, lint e build; em PRs do próprio repositório, publica um preview temporário por sete dias.
- Push ou merge em `main`: executa as mesmas verificações e publica no canal de produção `live`.
- Execução manual: pode ser iniciada em `Actions`, `CI e deploy no Firebase Hosting`, `Run workflow`.

Fluxo recomendado:

```powershell
git checkout -b deploy/firebase
git add firebase.json .firebaseignore .github/workflows/firebase-hosting.yml docs/DEPLOY_FIREBASE.md
git commit -m "ci: configura deploy no Firebase Hosting"
git push -u origin deploy/firebase
```

Depois, abra um pull request para `main`. O primeiro preview somente funcionará depois que os quatro secrets estiverem configurados.

## 6 Autorizar o domínio no Supabase

No painel do Supabase, abra `Authentication`, `URL Configuration`.

1. Defina `Site URL` como `https://SEU_PROJECT_ID.web.app`.
2. Adicione `https://SEU_PROJECT_ID.web.app/**` em `Redirect URLs`.
3. Se usar também o domínio `firebaseapp.com`, adicione-o da mesma forma.
4. Mantenha `http://localhost:5173/**` para desenvolvimento local.

Isso é especialmente importante para confirmação de e-mail e recuperação de senha.

## 7 Conferir depois do primeiro deploy

1. Abrir a URL de produção.
2. Criar ou acessar uma conta de analista.
3. Atualizar a página diretamente em `/clientes/novo` para validar o rewrite da SPA.
4. Cadastrar um cliente.
5. Importar os CSVs de teste.
6. Abrir painel e detalhes.
7. Executar `Atualizar análises`.
8. Conferir no GitHub Actions se CI e deploy ficaram verdes.

## Problemas comuns

- Tela em branco: conferir se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem nos GitHub Secrets e gerar novo deploy.
- Rota retorna 404 ao atualizar: conferir o bloco `rewrites` do `firebase.json`.
- Deploy recebe erro de permissão: gerar novamente a conta de serviço ou conferir o secret `FIREBASE_SERVICE_ACCOUNT`.
- Login redireciona para localhost: corrigir `Site URL` e `Redirect URLs` no Supabase.
- Workflow não inicia: confirmar que o arquivo está na branch enviada ao GitHub e que GitHub Actions está habilitado.
