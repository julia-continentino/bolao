# Minhas Demandas

Agenda pessoal de projetos com timesheet automático. Funciona em qualquer navegador, sem precisar do Claude.

Endereço depois de publicado: `https://julia-continentino.github.io/bolao/demandas/`

Os dados ficam no Firebase que o bolão já usa (projeto `bolao-copa-2026-98887`), numa área separada (`demandas_users/<seu usuário>`). Só quem entra com o seu e-mail e senha vê os seus dados.

## Configuração (uma vez só, no console do Firebase)

Acesse https://console.firebase.google.com e abra o projeto **bolao-copa-2026**.

### 1. Ativar login por e-mail e senha
Authentication → Primeiros passos (ou "Sign-in method") → **E-mail/senha** → Ativar → Salvar.

### 2. Autorizar o endereço do site
Authentication → Configurações → **Domínios autorizados** → Adicionar domínio → `julia-continentino.github.io`.

### 3. Proteger os dados nas regras do Firestore
Firestore Database → **Regras**. Mantenha o que já existe para o bolão e adicione o bloco `demandas_users` dentro de `match /databases/{database}/documents { ... }`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Regras do bolão (o bolão usa as coleções "participants" e "meta")
    match /participants/{document=**} { allow read, write: if true; }
    match /meta/{document=**}         { allow read, write: if true; }

    // Minhas Demandas: cada usuário só lê e grava a própria área
    match /demandas_users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

**Importante:** se as regras atuais tiverem um bloco genérico como
`match /{document=**} { allow read, write: if true; }` (modo de teste), ele libera tudo para qualquer pessoa, inclusive as suas demandas. Troque esse bloco genérico pelas duas linhas do bolão acima. Depois clique em **Publicar**.

### 4. Primeiro acesso
Abra o site, digite seu e-mail e uma senha (mínimo 6 caracteres) e clique em **Primeiro acesso: criar senha**. Nos outros computadores, use **Entrar** com o mesmo e-mail e senha.

## Uso
- **Agenda:** adicione o que vai fazer. Clique em **Começar** ao iniciar e no quadradinho ao terminar. O site registra os horários sozinho.
- **Timesheet:** calculado automaticamente por semana ou mês, por projeto e por dia. Exporta CSV ou copia para o Excel.
- **Projetos:** escopo (PPA, Impairment, Marcação de Cota, Valuation, Business Plan), datas, etapas LEAP, e-mails e anotações.
- Funciona sem internet: as alterações ficam salvas no navegador e sobem quando a conexão voltar.
