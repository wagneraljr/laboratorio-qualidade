# Laboratório de Qualidade de Software

Projeto didático da disciplina Qualidade e Teste de Software, do IF Sudeste MG (Campus Juiz de Fora).

A plataforma oferece um laboratório completo para:
1. Geração de desafios de programação via IA.
2. Resolução dos desafios pelos alunos em editor web.
3. Avaliação automática com foco em lógica e qualidade de código.

## Visão Geral

O projeto possui dois perfis principais:
1. Professor: autentica no painel administrativo, gera desafios, edita banco de questões e calibra exercícios no sandbox.
2. Aluno: seleciona modo de treino, resolve desafios no editor e recebe feedback automático.

Fluxo simplificado:
1. Professor acessa a área administrativa e autentica com senha.
2. O servidor pode gerar novas questões usando Google Gemini.
3. As questões ficam no banco local em JSON.
4. O aluno recebe uma missão, envia o código e o avaliador executa testes.

## Organização Didática do Código

O próprio código foi organizado para ser didático:
1. Arquivos com seções claras e comentários explicativos por responsabilidade.
2. Separação explícita entre regras de negócio, acesso a dados, autenticação e interface.
3. Estrutura orientada a estudo, manutenção e evolução incremental em sala de aula.

Exemplos dessa abordagem:
1. servidor/app.js organiza o backend por seções (configuração, autenticação, rotas do aluno e rotas do professor).
2. servidor/avaliadorCodigo.js separa análise estrutural (AST) e testes de execução (VM).
3. Frontend em publico com lógica separada por tela (aluno, admin, sandbox) e CSS centralizado em estilo.css.

## Índice de Estudo

Para facilitar revisão de prova e estudo guiado em sala, o projeto possui um glossário de conceitos:
1. CONCEITOS.md: índice dos padrões/conceitos aplicados com descrição curta e arquivos de referência.

## Estrutura do Projeto

1. publico: páginas HTML, scripts de interface e folha de estilos global.
2. servidor: API Express, gerador de desafios por IA, avaliador e banco de questões.
3. package.json: dependências Node.js.
4. requisitos.txt: resumo de requisitos e instalação.

## Stack e Dependências

1. Node.js + Express.
2. Cookie Parser para autenticação com cookie assinado.
3. Dotenv para variáveis de ambiente.
4. Google Generative AI para geração de exercícios.
5. Acorn para análise sintática (AST) no avaliador.
6. CodeMirror (via CDN) no frontend.

## Atualização Importante de Configuração (.env)

Houve mudança de configuração obrigatória no ambiente.

Além de GEMINI_API_KEY e ADMIN_PASSWORD, agora o servidor exige também SESSION_SECRET.

Variáveis obrigatórias:
1. GEMINI_API_KEY: chave de acesso da API generativa.
2. ADMIN_PASSWORD: senha de autenticação da área administrativa.
3. SESSION_SECRET: segredo usado para assinar o cookie de autenticação.

Exemplo de .env:

```env
GEMINI_API_KEY=sua_chave
ADMIN_PASSWORD=sua_senha_admin
SESSION_SECRET=um_segredo_longo_e_aleatorio
```

Observação:
1. Se SESSION_SECRET não estiver definido, o servidor encerra a inicialização (fail fast) para evitar execução insegura.

## Mudanças e Reforços de Segurança

O projeto foi reforçado com práticas importantes de segurança:
1. Cookie de autenticação assinado com SESSION_SECRET.
2. Cookie com flags de proteção: httpOnly, secure e sameSite strict.
3. Rotas administrativas protegidas por middleware de autenticação.
4. Sanitização de dados enviados ao aluno em endpoint público (remoção de campos sensíveis como gabarito e nome da função no modo competitivo).
5. Execução de código do aluno em sandbox VM com timeout para reduzir risco de travamento e abuso.
6. Bloqueio de acesso visual imediato ao painel admin no frontend até validação de sessão.

## Robustez e Qualidade de Entrada de Dados

O backend agora valida entrada de forma explícita nas rotas críticas.

Principais reforços:
1. Verificação de tipo, faixa e campos obrigatórios (ex.: dificuldade de 1 a 5, quantidade positiva).
2. Retorno HTTP 400 com mensagem didática quando o payload é inválido.
3. Retorno HTTP 404 para operações em questão inexistente (ex.: atualizar/excluir ID não encontrado).

Exemplos de erros tratados:
1. dificuldade: "abc"
2. quantidade: -5
3. idQuestao ausente ou não numérico
4. payload de questão sem campos obrigatórios

Benefício didático:
1. Demonstra na prática validação defensiva de API, princípio básico de qualidade de software.

## Desempenho no Acesso ao Banco de Questões

Para reduzir custo de leitura/parse do JSON a cada submissão:
1. O banco é carregado em memória na inicialização do servidor.
2. Rotas de leitura usam o cache em memória.
3. O cache é recarregado após rotas de escrita (criar, atualizar, excluir, abastecer).

Benefício:
1. Melhor tempo de resposta em cenários com muitas submissões de alunos.

## Endpoints Principais

Autenticação:
1. POST /api/login
2. POST /api/logout

Aluno:
1. POST /api/missao-aleatoria
2. POST /api/avaliar
3. GET /api/banco-publico

Professor (protegido):
1. GET /api/admin/questoes
2. POST /api/admin/abastecer
3. POST /api/admin/questoes/criar
4. POST /api/admin/questoes/atualizar
5. DELETE /api/admin/questoes/:id
6. POST /api/admin/sandbox/testar

## Instalação e Execução Local

1. Instale Node.js LTS (18+ recomendado).
2. Instale dependências:

```bash
npm install
```

3. Crie o arquivo .env na raiz com as 3 variáveis obrigatórias.
4. Inicie o servidor:

```bash
node servidor/app.js
```

5. Acesse as interfaces:
1. Área do aluno em http://localhost:3000/aluno.html
2. Login do professor em http://localhost:3000/login.html
3. Painel admin em http://localhost:3000/admin.html

## Troubleshooting Rápido

Se o comando node servidor/app.js encerrar com código 1:
1. Verifique se o arquivo .env existe na raiz do projeto.
2. Confirme se SESSION_SECRET está definido (obrigatório).
3. Confira se ADMIN_PASSWORD e GEMINI_API_KEY também estão preenchidos.
4. Revise o terminal: mensagens de "ERRO CRÍTICO" no boot indicam configuração ausente.

## Notas Operacionais

1. O banco de questões fica em servidor/bancoQuestoes.json.
2. A geração em lote inclui espera entre requisições para reduzir chance de rate limit da API de IA.
3. Para ambiente de produção, use HTTPS e segredos fortes no .env.

## Contribuição

Contribuições são bem-vindas via pull request, com foco em:
1. melhoria de cobertura de testes;
2. robustez de validações;
3. evolução da didática do laboratório.

Professor Wagner de Almeida Junior  
IF Sudeste MG - Campus Juiz de Fora

