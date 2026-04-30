# Glossario de Conceitos do Projeto

Este arquivo funciona como um indice de estudo: cada linha resume um conceito aplicado no projeto e aponta onde ele aparece.

| Conceito | Descricao (1 linha) | Onde aparece |
|---|---|---|
| SRP (Single Responsibility Principle) | Cada modulo ou funcao deve ter responsabilidade clara e focada. | servidor/app.js, servidor/geradorIA.js, publico/aluno-logic.js, publico/admin-logic.js |
| Fail Fast (Falha Rapida) | Encerrar cedo quando uma pre-condicao critica falha evita estados inseguros. | servidor/app.js, servidor/avaliadorCodigo.js |
| Middleware de Autenticacao | Funcao intermediaria que protege rotas antes de chegar ao handler final. | servidor/app.js |
| Cookies seguros de sessao | Uso combinado de httpOnly, sameSite, signed e secure para proteger sessao. | servidor/app.js |
| Cache em memoria | Carregar dados uma vez e reutilizar em leitura para reduzir I/O repetido. | servidor/app.js |
| Isolamento de ponto de falha | Envolver I/O/rede em try/catch para evitar quebra geral da aplicacao. | servidor/app.js, publico/aluno-logic.js, publico/admin-logic.js |
| Validacao de entrada | Verificar tipo, faixa e obrigatoriedade antes de processar requisicoes. | servidor/app.js, servidor/geradorIA.js |
| Merge seguro com Object.assign | Atualiza campos sem perder dados antigos que nao vieram no payload. | servidor/app.js |
| Contratos de API (Contract Testing) | Validar formato minimo esperado de dados externos antes de aceitar. | servidor/geradorIA.js |
| Smoke Test | Executar casos reais rapidamente para checar se o fluxo principal funciona. | servidor/geradorIA.js |
| Backoff exponencial | Repetir tentativas com espera crescente para lidar com falhas temporarias. | servidor/geradorIA.js |
| Tolerancia a falhas de API externa | Seguir operacao mesmo com erros pontuais de servicos de terceiros. | servidor/geradorIA.js, servidor/app.js |
| AST (Abstract Syntax Tree) | Representacao em arvore do codigo para analise estrutural automatica. | servidor/avaliadorCodigo.js |
| Complexidade ciclomatica | Medida da quantidade de caminhos logicos; ajuda a detectar funcoes inchadas. | servidor/avaliadorCodigo.js |
| Numeros magicos | Literais sem significado nomeado; substituir por constantes melhora legibilidade. | servidor/avaliadorCodigo.js, publico/aluno-logic.js |
| Sandbox (maquina virtual) | Executar codigo em ambiente isolado para reduzir riscos de seguranca. | servidor/avaliadorCodigo.js, servidor/app.js (rota de sandbox) |
| Caso de teste (entrada/saida esperada) | Define entradas e resultados esperados para validar comportamento. | servidor/avaliadorCodigo.js, publico/admin-logic.js |
| Isolamento por caso de teste | Cada teste roda em contexto novo para evitar contaminacao entre execucoes. | servidor/avaliadorCodigo.js |
| Regex (Expressao Regular) | Padrao textual para extrair informacoes de strings, como nome de funcao. | publico/admin-logic.js |
| Separacao entre dados e apresentacao | Estado e renderizacao separados tornam manutencao e depuracao mais simples. | publico/admin-logic.js |
| Paginacao | Divide listas grandes em paginas para melhorar leitura e navegacao. | publico/admin-logic.js, publico/estilo.css |
| Defesa contra XSS | Preferir textContent/createElement para nao executar HTML injetado. | publico/admin-logic.js, servidor/app.js |
| Estado de interface centralizado | Mudancas de modo e limpeza de ambiente em pontos unicos evitam inconsistencias. | publico/aluno-logic.js |
| Constantes nomeadas | Nomes semanticos substituem valores soltos e deixam regras explicitas. | publico/aluno-logic.js, servidor/geradorIA.js |
| Funcoes pequenas e descritivas | Decomposicao em funcoes curtas melhora leitura, teste e reuso. | publico/aluno-logic.js, publico/admin-logic.js |
| Design tokens com variaveis CSS | Centraliza cores e medidas para manter consistencia visual global. | publico/estilo.css |
| Modais e feedback visual | Informar resultado de acoes com overlays, status e mensagens de retorno. | publico/aluno-logic.js, publico/estilo.css |
| CRUD | Operacoes basicas de criar, ler, atualizar e excluir dados persistidos. | publico/admin-logic.js, servidor/app.js |

## Como usar este glossario

1. Escolha um conceito na tabela.
2. Abra o arquivo indicado e procure pelos comentarios didaticos.
3. Relacione o conceito com o comportamento real da aplicacao (frontend e backend).
4. Volte neste indice para conectar conceitos complementares (ex.: validacao + fail fast + tratamento de excecao).
