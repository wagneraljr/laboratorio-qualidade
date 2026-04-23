# Laboratório de Qualidade de Software

Projeto desenvolvido para a disciplina **Qualidade e Teste de Software** — IF Sudeste MG, Campus Juiz de Fora.

Este laboratório fornece uma plataforma educativa onde um servidor gera automaticamente trechos de código (com bugs ou que precisam de refatoração) usando uma API de IA. Os alunos acessam esses desafios via interface web, implementam correções ou refatorações e submetem suas soluções para avaliação automática.

**Principais objetivos**

- Proporcionar exercícios práticos de correção de bugs e refatoração.
- Permitir avaliação automatizada de soluções (funcionalidade + qualidade de código).
- Apoiar atividades práticas em sala e trabalhos dirigidos.

**Visão geral do fluxo**

1. O professor autentica-se no painel (interface `publico/admin.html`) e solicita geração de desafios.
2. O backend (`servidor/geradorIA.js`) consulta uma API generativa (Gemini) para compor exercícios em JavaScript e salva as questões em `servidor/bancoQuestoes.json`.
3. O aluno acessa `publico/aluno.html`, solicita uma missão por tipo/dificuldade e recebe um objeto com `codigoSujo`, `missao`, `testes` etc.
4. O aluno edita o código no editor integrando (CodeMirror) e submete para avaliação. O endpoint `/api/avaliar` executa a avaliação por meio de `servidor/avaliadorCodigo.js`.

Componentes importantes:

- `publico/` — frontend estático (páginas do professor e do aluno, scripts do cliente e estilos).
- `servidor/` — Node/Express backend (app.js, geradorIA.js, avaliadorCodigo.js, bancoQuestoes.json).
- `servidor/geradorIA.js` — gera desafios usando `process.env.GEMINI_API_KEY`.
- `servidor/avaliadorCodigo.js` — motor de avaliação (execução em VM + análise AST com `acorn`).

Como a geração funciona

- O gerador constrói um prompt direcionado e pede à IA um JSON contendo campos como `titulo`, `missao`, `codigoSujo`, `codigoLimpo`, `tipo`, `dificuldade`, `nomeDaFuncao` e `testes`.
- Regras importantes definidas no prompt (ex.: usar `function` tradicional, `for` clássico, manter o nome da função idêntico etc.).
- O módulo realiza tentativas com backoff exponencial em caso de falha de comunicação com a API.

Variáveis de ambiente esperadas

- `GEMINI_API_KEY` — chave de acesso à API generativa (usada por `servidor/geradorIA.js`).
- `ADMIN_PASSWORD` — senha do painel administrativo (usada em `/api/login`).

OBS: O arquivo `.env` deve conter essas variáveis e NÃO deve ser enviado ao repositório (já incluído em `.gitignore`).

Instalação e execução (local)

1. Requisitos mínimos:

- Node.js (recomendado: versão LTS, ex.: 18.x ou superior)
- npm (vem com o Node.js)

2. Instalar dependências:

Você pode instalar as dependências listadas em `package.json` executando:

```bash
cd laboratorio-qualidade
npm install
```
3. Crie um arquivo `.env` na raiz do projeto com, pelo menos, as variáveis abaixo:

```
GEMINI_API_KEY=insira_sua_chave_aqui
ADMIN_PASSWORD=uma_senha_segura
```

4. Inicie o servidor:

```bash
node servidor/app.js
```

5. Acesse as interfaces no browser:

- Painel do professor: http://localhost:3000/admin.html
- Área do aluno: http://localhost:3000/aluno.html

Uso — professor

- Autentique-se no painel administrativo usando a senha definida em `ADMIN_PASSWORD`.
- Use a seção "Gerar Novos Desafios" para solicitar à IA a criação em lote de exercícios (escolha tipo, dificuldade e quantidade).
- As questões geradas são salvas em `servidor/bancoQuestoes.json` e ficam imediatamente disponíveis para os alunos.

Uso — aluno

- No painel do aluno, escolha tipo (correção ou refatoração) e dificuldade e clique para buscar no banco.
- Edite o `codigoSujo` no editor, teste e submeta. O servidor retorna um relatório com o número de testes aprovados e mensagens de erro.

Formato de retorno da avaliação (`/api/avaliar`)

O endpoint responde com um objeto similar a:

```json
{
  "sucesso": true,
  "totalAcertos": 3,
  "totalTestes": 3,
  "erros": []
}
```

Ou em caso de falhas de refatoração/código limpo:

```json
{
  "sucesso": false,
  "totalAcertos": 0,
  "totalTestes": 3,
  "erros": ["Falha de Refatoração: Você não renomeou as variáveis..."]
}
```

Edição manual do banco de questões

- É possível adicionar/editar questões diretamente em `servidor/bancoQuestoes.json`. Cada entrada deve seguir o formato usado pelo gerador (veja `bancoQuestoes.json` de exemplo).

Exemplo mínimo de objeto de questão:

```json
{
  "titulo": "Título do desafio",
  "missao": "Instruções claras para o aluno",
  "codigoSujo": "function soma(a,b){ return a-b }",
  "codigoLimpo": "function soma(a,b){ return a+b }",
  "tipo": "correcao",
  "dificuldade": 2,
  "nomeDaFuncao": "soma",
  "testes": [ { "parametros": "[1,2]", "saidaEsperada": 3 } ],
  "id": 123456789
}
```

Notas sobre avaliação automática

- Para `tipo: "refatoracao"` o avaliador compara variáveis e executa um linter simples (complexidade, números "mágicos"). Se o aluno não alterar nomes de variáveis ou se o linter detectar problemas, a submissão é reprovada mesmo que os testes passem.
- A execução de código é feita em uma VM com timeout para evitar travamentos.

Boas práticas e segurança

- Não compartilhe chaves privadas; guarde-as em `.env` (já listado em `.gitignore`).
- Evite expor a chave da API em repositórios públicos.
- Use limites/quotas na geração por IA e monitore custos (a geração em lote faz esperas entre requisições).

Contribuição

- Sugestões de melhoria e correções podem ser feitas via pull request. Antes de contribuir, execute `npm install` e teste localmente.

Professor Wagner de Almeida Junior
IF Sudeste MG — Campus Juiz de Fora

