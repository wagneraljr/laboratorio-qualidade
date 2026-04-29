// =============================================================================
// avaliadorCodigo.js — Motor de Avaliação e Análise de Código
// =============================================================================
// Este módulo é responsável por avaliar o código enviado pelo aluno.
// Ele realiza dois tipos de análise:
//
//   1. ANÁLISE ESTRUTURAL (via AST): verifica se o aluno realmente refatorou
//      o código — detecta variáveis com nomes ruins e complexidade excessiva.
//
//   2. ANÁLISE DE LÓGICA (via Máquina Virtual): executa os casos de teste
//      e compara os resultados com os valores esperados.
//
// CONCEITO DE TESTES: Este arquivo É um motor de testes — ele implementa
// na prática os mesmos princípios que aprendemos na teoria:
//   - Casos de Teste com Entrada e Saída Esperada
//   - Isolamento da execução (Sandbox / Máquina Virtual)
//   - Relatório de Falhas com mensagens descritivas
// =============================================================================

const vm    = require("vm");    // Módulo nativo para executar código em sandbox
const acorn = require("acorn"); // Biblioteca para analisar a estrutura do código (AST)

// =============================================================================
// PARTE 1: ANÁLISE ESTRUTURAL (AST — Abstract Syntax Tree)
// =============================================================================
//
// CONCEITO: O que é uma AST?
// Quando o computador "lê" um código JavaScript, ele não o trata como texto puro.
// Ele o converte em uma estrutura em árvore chamada AST (Árvore Sintática Abstrata),
// onde cada galho representa uma parte do código: declarações, expressões, variáveis.
// O Acorn faz exatamente essa conversão, e nós percorremos essa árvore para
// inspecionar o código do aluno de forma programática.

// Coleta todos os identificadores (nomes de variáveis e funções) de um código.
// Usada para comparar se o aluno renomeou as variáveis durante a refatoração.
function analisarVariaveis(codigo) {
    let variaveis = new Set(); // Set garante que não haverá nomes duplicados

    try {
        // acorn.parse() transforma o texto do código em uma AST (árvore)
        let ast = acorn.parse(codigo, { ecmaVersion: 2020 });

        // Função recursiva que percorre todos os "galhos" da árvore
        function caminhar(no) {
            // Condição de parada: nós nulos ou tipos primitivos não têm filhos
            if (!no || typeof no !== "object") return;

            // Arrays são coleções de nós (ex: lista de statements num bloco)
            // Precisamos iterar sobre cada um deles individualmente
            if (Array.isArray(no)) {
                for (let i = 0; i < no.length; i++) {
                    caminhar(no[i]);
                }
                return;
            }

            // Se este nó é um Identifier, guardamos o nome da variável/função
            if (no.type === "Identifier") {
                variaveis.add(no.name);
            }

            // Percorre os filhos deste nó, ignorando:
            //   - Propriedades herdadas do protótipo (hasOwnProperty)
            //   - Metadados de posição no código (start, end, type) — não são nós filhos
            for (let chave in no) {
                if (!Object.prototype.hasOwnProperty.call(no, chave)) continue;
                if (chave === "start" || chave === "end" || chave === "type") continue;
                caminhar(no[chave]);
            }
        }

        caminhar(ast);

    } catch (erro) {
        // Se o código tiver erro de sintaxe, o parse falha.
        // Ignoramos silenciosamente — a fase de execução vai reportar o erro.
    }

    return Array.from(variaveis).sort(); // Retorna como array ordenado para facilitar comparação
}

// Verifica se o código do aluno segue boas práticas de código limpo.
// Retorna uma lista de problemas encontrados.
function analisarCodigoLimpo(codigo) {
    let problemas = [];
    let complexidadeCiclomatica = 1; // Toda função começa com complexidade 1

    try {
        let ast = acorn.parse(codigo, { ecmaVersion: 2020 });

        function caminhar(no) {
            if (!no || typeof no !== "object") return;

            if (Array.isArray(no)) {
                for (let i = 0; i < no.length; i++) {
                    caminhar(no[i]);
                }
                return;
            }

            // REGRA 1 — Complexidade Ciclomática (relacionada ao SRP)
            // Cada estrutura de decisão ou laço adiciona +1 ao contador.
            // Uma função com muitas decisões está provavelmente fazendo coisas demais.
            if (
                no.type === "IfStatement"    ||
                no.type === "ForStatement"   ||
                no.type === "WhileStatement" ||
                no.type === "SwitchCase"
            ) {
                complexidadeCiclomatica++;
            }

            // REGRA 2 — Números Mágicos
            // Um "número mágico" é um valor numérico solto no código sem explicação.
            // Ex: if (preco > 150) — por que 150? O ideal é: const PRECO_MINIMO = 150.
            // Verificamos os dois lados de expressões binárias (ex: a + b, x > y).
            if (no.type === "BinaryExpression") {
                let ladoEsquerdo = no.left;
                let ladoDireito  = no.right;

                // 0 e 1 são exceções aceitas — são muito comuns e geralmente óbvios
                if (ladoEsquerdo.type === "Literal" && typeof ladoEsquerdo.value === "number") {
                    if (ladoEsquerdo.value !== 0 && ladoEsquerdo.value !== 1) {
                        problemas.push(
                            `Número Mágico detectado: O valor '${ladoEsquerdo.value}' está solto na lógica. ` +
                            `Atribua-o a uma constante com nome descritivo (ex: const TAXA = ${ladoEsquerdo.value}).`
                        );
                    }
                }

                if (ladoDireito.type === "Literal" && typeof ladoDireito.value === "number") {
                    if (ladoDireito.value !== 0 && ladoDireito.value !== 1) {
                        problemas.push(
                            `Número Mágico detectado: O valor '${ladoDireito.value}' está solto na lógica. ` +
                            `Atribua-o a uma constante com nome descritivo.`
                        );
                    }
                }
            }

            // Continua percorrendo os filhos do nó atual
            for (let chave in no) {
                if (!Object.prototype.hasOwnProperty.call(no, chave)) continue;
                if (chave === "start" || chave === "end" || chave === "type") continue;
                caminhar(no[chave]);
            }
        }

        caminhar(ast);

        // Verifica o limite de complexidade APÓS percorrer toda a árvore
        // Um valor acima de 4 sugere que a função está quebrando o SRP
        if (complexidadeCiclomatica > 4) {
            problemas.push(
                `Quebra de Responsabilidade (SRP): Sua função tem Complexidade Ciclomática ${complexidadeCiclomatica}. ` +
                `Ela está tomando decisões demais (muitos ifs/loops). Divida-a em funções menores e mais focadas.`
            );
        }

    } catch (erro) {
        // Erro de sintaxe: ignoramos aqui, a execução vai reportar
    }

    return problemas;
}

// =============================================================================
// PARTE 2: MOTOR DE TESTES (Execução em Máquina Virtual)
// =============================================================================

// Executa os casos de teste contra o código do aluno e retorna o resultado.
//
// CONCEITO DE TESTES: Esta função implementa o ciclo clássico de teste:
//   Para cada caso de teste:
//     1. Define a ENTRADA (parâmetros)
//     2. Executa o código do aluno
//     3. Compara a SAÍDA REAL com a SAÍDA ESPERADA
//     4. Registra o resultado (acerto ou falha com detalhes)
//
// Parâmetros:
//   codigoDoAluno      — o código JavaScript enviado pelo aluno
//   nomeDaFuncao       — o nome da função que será chamada em cada teste
//   testes             — array de objetos { parametros, saidaEsperada }
//   codigoSujoOriginal — se não for null, ativa a análise estrutural (refatoração)
function executarTestes(codigoDoAluno, nomeDaFuncao, testes, codigoSujoOriginal = null) {
    let acertos       = 0;
    let mensagensErro = [];

    // -------------------------------------------------------------------------
    // FASE 1: Análise Estrutural (apenas para questões de Refatoração)
    // -------------------------------------------------------------------------
    // Executamos esta fase ANTES dos testes de lógica. Se o código não passou
    // na análise estrutural, não faz sentido continuar para os testes.
    // Isso se chama "Fail Fast" — falhar cedo com uma mensagem específica.
    if (codigoSujoOriginal !== null) {

        // Verifica se o aluno renomeou as variáveis
        let variaveisOriginais = analisarVariaveis(codigoSujoOriginal);
        let variaveisDoAluno   = analisarVariaveis(codigoDoAluno);

        // JSON.stringify transforma os arrays em strings para comparação simples
        if (JSON.stringify(variaveisOriginais) === JSON.stringify(variaveisDoAluno)) {
            return {
                sucesso:      false,
                totalAcertos: 0,
                totalTestes:  testes.length,
                erros: [
                    "Falha de Refatoração: Você não renomeou as variáveis! " +
                    "Os identificadores estão idênticos ao código original."
                ]
            };
        }

        // Verifica boas práticas de código limpo
        let problemasEncontrados = analisarCodigoLimpo(codigoDoAluno);
        if (problemasEncontrados.length > 0) {
            // Reportamos apenas o primeiro problema por vez para não sobrecarregar o aluno
            return {
                sucesso:      false,
                totalAcertos: 0,
                totalTestes:  testes.length,
                erros:        [problemasEncontrados[0]]
            };
        }
    }

    // -------------------------------------------------------------------------
    // FASE 2: Testes de Lógica (Execução em Sandbox)
    // -------------------------------------------------------------------------
    //
    // CONCEITO DE TESTES: Sandbox (Caixa de Areia)
    // Executar código desconhecido diretamente no servidor seria perigoso —
    // o aluno poderia deletar arquivos ou acessar dados sigilosos.
    // O módulo `vm` do Node.js cria um contexto de execução isolado (sandbox):
    // o código do aluno roda ali dentro, sem acesso ao ambiente do servidor.
    //
    // CONCEITO DE TESTES: Caso de Teste
    // Cada objeto em `testes` representa um Caso de Teste com:
    //   - parametros:    os valores de entrada para a função
    //   - saidaEsperada: o resultado correto para essa entrada

    for (let i = 0; i < testes.length; i++) {
        let teste = testes[i];

        // CONCEITO DE TESTES: Isolamento por Caso de Teste
        // Criamos um sandbox NOVO para cada teste. Assim, um efeito colateral
        // do teste anterior (como uma variável global modificada) não contamina
        // os testes seguintes.
        try {
            let ambienteSeguro = {};
            vm.createContext(ambienteSeguro);

            // Primeiro, "ensinamos" o sandbox sobre o código do aluno
            vm.runInContext(codigoDoAluno, ambienteSeguro, { timeout: 1000 });

            // Depois, chamamos a função com os parâmetros do caso de teste.
            // O timeout de 1000ms evita que loops infinitos travem o servidor.
            let chamada           = nomeDaFuncao + "(" + teste.parametros + ")";
            let resultadoDoAluno  = vm.runInContext(chamada, ambienteSeguro, { timeout: 1000 });

            // Comparamos usando JSON.stringify para que arrays e objetos também
            // sejam comparados pelo conteúdo, não pela referência de memória.
            // Ex: [1,2,3] === [1,2,3] seria false sem stringify
            let saidaCorreta = JSON.stringify(resultadoDoAluno) === JSON.stringify(teste.saidaEsperada);

            if (saidaCorreta) {
                acertos++;
            } else {
                // Monta uma mensagem de falha com todos os detalhes relevantes:
                // o que foi passado, o que era esperado e o que o código retornou.
                mensagensErro.push(
                    `[Falha no Teste ${i + 1}]\n` +
                    ` 📥 Entrada:   (${teste.parametros})\n` +
                    ` 🏁 Esperado:  ${JSON.stringify(teste.saidaEsperada)}\n` +
                    ` 📤 Retornado: ${JSON.stringify(resultadoDoAluno)}`
                );
            }

        } catch (erro) {
            // Se o código do aluno lançar uma exceção (erro de sintaxe, variável
            // não definida, timeout por loop infinito), capturamos aqui e
            // reportamos como uma falha de teste — não como um crash do servidor.
            mensagensErro.push(
                `[Erro no Teste ${i + 1}]\n` +
                ` 📥 Entrada:  (${teste.parametros})\n` +
                ` 💥 Exceção:  ${erro.message}`
            );
        }
    }

    // Retorna o resultado consolidado de todos os testes
    return {
        sucesso:      acertos === testes.length, // true só se TODOS passaram
        totalAcertos: acertos,
        totalTestes:  testes.length,
        erros:        mensagensErro
    };
}

// Exporta apenas a função pública do módulo.
// analisarVariaveis e analisarCodigoLimpo são detalhes internos — não precisam
// ser acessados de fora deste arquivo.
module.exports = { executarTestes };