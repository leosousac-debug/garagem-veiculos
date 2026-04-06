# 🚗 GARAGEM VEÍCULOS — GUIA COMPLETO DE IMPLANTAÇÃO

---

## ESTRUTURA DO PROJETO

```
garagem-veiculos/
├── public/
│   ├── index.html       ← site completo (frontend)
│   └── logo.png         ← coloque sua logo aqui
├── api/
│   ├── auth.js          ← login admin
│   ├── veiculos.js      ← CRUD estoque (banco de dados)
│   └── upload.js        ← upload de fotos
├── package.json
└── vercel.json
```

---

## PASSO 1 — SUBIR O CÓDIGO NO GITHUB

1. Acesse https://github.com e crie uma conta (se não tiver)
2. Clique em **New repository**
3. Nome: `garagem-veiculos` → clique em **Create repository**
4. No seu computador, instale o Git: https://git-scm.com/downloads
5. Abra o terminal/prompt na pasta do projeto e execute:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/garagem-veiculos.git
git push -u origin main
```

> Substitua `SEU_USUARIO` pelo seu usuário do GitHub.

---

## PASSO 2 — CONFIGURAR VERCEL KV (banco de dados)

O site usa **Vercel KV** (Redis) para salvar os veículos permanentemente.

1. Acesse https://vercel.com e faça login
2. No painel, clique em **Storage** (menu lateral)
3. Clique em **Create Database** → escolha **KV**
4. Nome: `garagem-kv` → clique em **Create**
5. Quando criado, clique em **Connect to Project** e selecione seu projeto
6. As variáveis de ambiente são adicionadas automaticamente:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

---

## PASSO 3 — CONFIGURAR VERCEL BLOB (armazenamento de fotos)

1. No painel da Vercel, clique em **Storage** novamente
2. Clique em **Create Database** → escolha **Blob**
3. Nome: `garagem-fotos` → clique em **Create**
4. Conecte ao projeto → variável `BLOB_READ_WRITE_TOKEN` é adicionada automaticamente

---

## PASSO 4 — DEFINIR SENHA DO ADMIN

Esta é a senha que **somente você** usará para acessar o painel admin.

1. No painel da Vercel, vá em seu projeto → **Settings** → **Environment Variables**
2. Clique em **Add New**
3. Preencha:
   - **Key:** `ADMIN_PASSWORD`
   - **Value:** `SUA_SENHA_FORTE_AQUI` (ex: `GaragemV@2025#`)
   - **Environments:** marque Production, Preview e Development
4. Clique em **Save**

> ⚠️ NUNCA compartilhe essa senha. Ela é o único acesso ao painel admin.

---

## PASSO 5 — IMPORTAR PROJETO NA VERCEL

1. No painel da Vercel, clique em **Add New → Project**
2. Clique em **Import** no repositório `garagem-veiculos`
3. Em **Framework Preset**, selecione **Other**
4. Clique em **Deploy**

O deploy levará cerca de 1-2 minutos.

---

## PASSO 6 — COLOCAR A LOGO NO SITE

1. Renomeie sua logo para exatamente: `logo.png`
2. Coloque dentro da pasta `public/`
3. Faça commit e push:

```bash
git add public/logo.png
git commit -m "adicionando logo"
git push
```

A Vercel fará redeploy automático em segundos.

---

## PASSO 7 — DOMÍNIO PERSONALIZADO (opcional)

1. Na Vercel → seu projeto → **Settings** → **Domains**
2. Digite seu domínio (ex: `garageveiculos.com.br`) → **Add**
3. Siga as instruções para apontar o DNS no seu provedor de domínio
4. Aguarde propagação (até 48h, geralmente menos de 1h)

---

## COMO USAR O PAINEL ADMIN

1. Acesse seu site e clique no botão **⚙ ADMIN** no canto superior direito
2. Digite a senha que você configurou no Passo 4
3. O token de sessão dura 24h — após isso, faça login novamente

### Cadastrar veículo:
- Clique em **+ NOVO VEÍCULO**
- Preencha todos os campos
- Faça upload de até 10 fotos (a primeira vira capa)
- Clique em **SALVAR VEÍCULO**

### Editar veículo:
- Na lista, clique em **Editar** na linha do veículo
- Altere os campos desejados
- Clique em **ATUALIZAR VEÍCULO**

### Excluir veículo:
- Na lista, clique em **Excluir**
- Confirme na caixa de diálogo

---

## SEGURANÇA DO ADMIN

O painel admin é protegido por:

1. **Senha via variável de ambiente** — nunca fica exposta no código
2. **Token diário** — o token muda todo dia automaticamente
3. **Autenticação em todas as rotas da API** — sem o token, não é possível criar, editar ou excluir dados
4. **Sessão apenas no navegador** — fecha ao fechar o navegador (sessionStorage)

Para aumentar ainda mais a segurança (opcional), você pode usar o **Vercel Authentication**:
- Vá em **Settings → Deployment Protection**
- Ative **Password Protection** para a rota `/` ou configure **Vercel Access** com seu e-mail

---

## ATUALIZAR O SITE APÓS MUDANÇAS

Qualquer alteração no código:

```bash
git add .
git commit -m "descrição da mudança"
git push
```

A Vercel faz redeploy automático em ~1 minuto.

---

## CHECKLIST FINAL

- [ ] Repositório criado no GitHub
- [ ] Código enviado com `git push`
- [ ] Projeto importado na Vercel
- [ ] Vercel KV criado e conectado
- [ ] Vercel Blob criado e conectado
- [ ] Variável `ADMIN_PASSWORD` configurada
- [ ] Logo `logo.png` na pasta `public/`
- [ ] Primeiro deploy bem-sucedido
- [ ] Testou login admin
- [ ] Cadastrou primeiro veículo
- [ ] Testou upload de foto
- [ ] (Opcional) Domínio personalizado configurado

---

## SUPORTE

Em caso de erro, verifique:
- **Logs da API:** Vercel → seu projeto → **Deployments** → clique no deploy → **Functions**
- **Variáveis de ambiente:** Settings → Environment Variables (todas presentes?)
- **Storage:** Storage → KV → verifique se está conectado ao projeto

---

*Garagem Veículos — Araguari MG*
