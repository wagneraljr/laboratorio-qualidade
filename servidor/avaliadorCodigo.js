const vm = require("vm");
const acorn = require("acorn");

// Função existente de ler variáveis
function analisarVariaveis(codigo) {
    let variaveis = new Set();
    try {
        let ast = acorn.parse(codigo, { ecmaVersion: 2020 });
        function caminhar(no) {
            if (!no) return;
            if (no.type === "Identifier") variaveis.add(no.name);
            for (let chave in no) {
                if (typeof no[chave] === "object") caminhar(no[chave]);
            }
        }
        caminhar(ast);
    } catch (erro) {}
    return Array.from(variaveis).sort();
}

// --- NOVA FUNÇÃO: LINTER DE CÓDIGO LIMPO ---
function analisarCodigoLimpo(codigo) {
    let falhasCodigoLimpo = [];
    let complexidadeCiclomatica = 1;

    try {
        let ast = acorn.parse(codigo, { ecmaVersion: 2020 });

        function caminhar(no) {
            if (!no) return;

            // 1. Sintoma de SRP: Medindo a Complexidade Ciclomática
            if (no.type === "IfStatement" || no.type === "ForStatement" || no.type === "WhileStatement" || no.type === "SwitchCase") {
                complexidadeCiclomatica++;
            }

            // 2. Caçador de Números Mágicos (Procura literais numéricos soltos em expressões)
            if (no.type === "BinaryExpression") {
                // Checa o lado esquerdo da operação
                if (no.left.type === "Literal" && typeof no.left.value === "number") {
                    if (no.left.value !== 0 && no.left.value !== 1) { // 0 e 1 são exceções comuns em programação
                        falhasCodigoLimpo.push(`Número Mágico detectado: O valor '${no.left.value}' está solto na lógica. Atribua-o a uma variável com nome claro (ex: const TAXA = ${no.left.value}).`);
                    }
                }
                // Checa o lado direito da operação
                if (no.right.type === "Literal" && typeof no.right.value === "number") {
                    if (no.right.value !== 0 && no.right.value !== 1) {
                        falhasCodigoLimpo.push(`Número Mágico detectado: O valor '${no.right.value}' está solto na lógica. Atribua-o a uma variável com nome claro.`);
                    }
                }
            }

            for (let chave in no) {
                if (typeof no[chave] === "object") caminhar(no[chave]);
            }
        }
        
        caminhar(ast);

        // Define um limite de complexidade (Se for maior que 4, provavelmente está quebrando o SRP)
        if (complexidadeCiclomatica > 4) {
            falhasCodigoLimpo.push(`Quebra de Responsabilidade (SRP): Sua função está com Complexidade Ciclomática ${complexidadeCiclomatica}. Ela está tomando muitas decisões (vários ifs/loops). Divida isso em funções menores.`);
        }

    } catch (erro) {
        // Ignora erros de sintaxe aqui
    }

    return falhasCodigoLimpo;
}

// --- MOTOR DE TESTES ATUALIZADO ---
function executarTestes(codigoDoAluno, nomeDaFuncao, testes, codigoSujoOriginal = null) {
    let acertos = 0;
    let mensagensErro = [];

    // 1. AVALIAÇÃO ESTRUTURAL E CÓDIGO LIMPO (Refatoração)
    if (codigoSujoOriginal !== null) {
        let varsOriginal = analisarVariaveis(codigoSujoOriginal);
        let varsAluno = analisarVariaveis(codigoDoAluno);
        
        if (JSON.stringify(varsOriginal) === JSON.stringify(varsAluno)) {
            return {
                sucesso: false, totalAcertos: 0, totalTestes: testes.length,
                erros: ["Falha de Refatoração: Você não renomeou as variáveis para nomes descritivos!"]
            };
        }

        // --- RODA O NOVO LINTER DE CÓDIGO LIMPO ---
        let errosCodigoLimpo = analisarCodigoLimpo(codigoDoAluno);
        if (errosCodigoLimpo.length > 0) {
            return {
                sucesso: false, totalAcertos: 0, totalTestes: testes.length,
                // Retorna apenas o primeiro erro de código limpo para não assustar o aluno
                erros: [errosCodigoLimpo[0]] 
            };
        }
    }

    // 2. AVALIAÇÃO MATEMÁTICA (Máquina Virtual - Inalterada)
    for (let teste of testes) {
        try {
            let ambienteSeguro = {};
            vm.createContext(ambienteSeguro);
            vm.runInContext(codigoDoAluno, ambienteSeguro, { timeout: 1000 });
            let chamadaDaFuncao = nomeDaFuncao + "(" + teste.parametros.replace(/[\[\]]/g, "") + ")";
            let resultadoDoAluno = vm.runInContext(chamadaDaFuncao, ambienteSeguro, { timeout: 1000 });

            if (JSON.stringify(resultadoDoAluno) === JSON.stringify(teste.saidaEsperada)) {
                acertos++;
            } else {
                mensagensErro.push("Falha lógica: Esperava " + JSON.stringify(teste.saidaEsperada) + ", mas retornou " + JSON.stringify(resultadoDoAluno));
            }
        } catch (erro) {
            mensagensErro.push("Erro na execução: " + erro.message);
        }
    }

    return {
        sucesso: acertos === testes.length,
        totalAcertos: acertos,
        totalTestes: testes.length,
        erros: mensagensErro
    };
}

module.exports = { executarTestes };