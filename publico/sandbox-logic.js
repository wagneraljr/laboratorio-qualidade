// =============================================================================
// sandbox-logic.js — Lógica do Laboratório de Calibração (Professor)
// =============================================================================
// Esta página é uma ferramenta exclusiva do professor para ajustar questões
// antes de disponibilizá-las aos alunos. Ela permite:
//
//   - Visualizar e editar o código sujo (o que o aluno recebe) e o gabarito
//   - Executar os casos de teste contra qualquer um dos dois lados
//   - Salvar as alterações de volta no banco de questões
//
// CONCEITO DE QUALIDADE: Ferramenta de Suporte à Qualidade
// O sandbox é ele mesmo um exemplo de prática de qualidade de software:
// o professor testa manualmente o exercício antes de "publicá-lo" para os
// alunos — assim como um desenvolvedor testa o código antes de fazer deploy.
// =============================================================================

// -----------------------------------------------------------------------------
// ESTADO GLOBAL
// -----------------------------------------------------------------------------

let questaoAtual = null; // Objeto completo da questão sendo calibrada
let cmSujo       = null; // Instância do editor CodeMirror do código sujo
let cmLimpo      = null; // Instância do editor CodeMirror do gabarito

// =============================================================================
// SEÇÃO 1: CARREGAMENTO DA QUESTÃO
// =============================================================================

// Lê o ID da URL e busca a questão correspondente no servidor.
// Chamada automaticamente quando a página termina de carregar (window.onload).
async function carregarQuestao() {
    // A URL do sandbox é: sandbox.html?id=1710000
    // URLSearchParams facilita a leitura de parâmetros de query string
    let urlParams = new URLSearchParams(window.location.search);
    let id        = urlParams.get("id");

    if (!id) {
        alert("ID da questão não encontrado na URL.");
        return;
    }

    // CONCEITO DE TESTES: Tratamento de Exceção em Operação de Rede
    // A requisição ao servidor pode falhar por problemas de conexão ou
    // porque a sessão do professor expirou. O try/catch garante que esses
    // casos sejam tratados de forma controlada, com mensagem ao usuário.
    try {
        let resposta = await fetch("/api/admin/questoes");

        if (!resposta.ok) {
            document.getElementById("titulo-questao").innerText = "Erro ao carregar: sessão expirada?";
            return;
        }

        let banco = await resposta.json();

        // Busca no banco a questão que tem o ID informado na URL.
        // O operador == (em vez de ===) permite comparar string com número
        // sem conversão explícita — o ID na URL chega como string.
        questaoAtual = banco.find(function(q) { return q.id == id; });

        if (questaoAtual) {
            document.getElementById("titulo-questao").innerText = "Calibrando: " + questaoAtual.titulo;
            document.getElementById("missao-texto").innerText   = questaoAtual.missao;
            inicializarEditores();
        } else {
            document.getElementById("titulo-questao").innerText = "Questão não encontrada no banco.";
        }

    } catch (erro) {
        console.error("Erro ao carregar banco:", erro);
        document.getElementById("titulo-questao").innerText = "Erro de conexão com o servidor.";
    }
}

// =============================================================================
// SEÇÃO 2: INICIALIZAÇÃO DOS EDITORES
// =============================================================================

// Transforma os dois textareas do HTML em editores CodeMirror completos
// e preenche cada um com o código da questão carregada.
//
// Esta função só é chamada APÓS questaoAtual estar preenchida,
// garantindo que os editores sempre tenham um valor inicial válido.
function inicializarEditores() {
    cmSujo = CodeMirror.fromTextArea(document.getElementById("editor-sujo"), {
        lineNumbers: true,
        mode:        "javascript",
        theme:       "dracula"
    });
    cmSujo.setValue(questaoAtual.codigoSujo);

    cmLimpo = CodeMirror.fromTextArea(document.getElementById("editor-limpo"), {
        lineNumbers: true,
        mode:        "javascript",
        theme:       "dracula"
    });
    cmLimpo.setValue(questaoAtual.codigoLimpo);
}

// =============================================================================
// SEÇÃO 3: EXECUÇÃO DE TESTES
// =============================================================================

// Executa os casos de teste contra o código do lado indicado ("sujo" ou "limpo")
// e exibe o resultado no terminal correspondente.
//
// CONCEITO DE TESTES: Este é o núcleo do sandbox.
// O professor usa esta função para verificar se:
//   1. O código SUJO realmente tem os bugs que deveriam estar lá
//      (ele deve FALHAR nos testes)
//   2. O código LIMPO (gabarito) realmente resolve o problema
//      (ele deve PASSAR em todos os testes)
//
// Parâmetro "lado": "sujo" ou "limpo" — determina qual editor será testado
async function testarCodigo(lado) {
    let codigoParaTestar = (lado === "sujo") ? cmSujo.getValue() : cmLimpo.getValue();
    let terminal         = document.getElementById("terminal-" + lado);

    terminal.innerText = "⏳ Executando testes...";
    terminal.classList.remove("erro"); // Remove destaque de erro anterior

    // CONCEITO DE TESTES: Avaliação Diferenciada por Contexto
    // Para questões de REFATORAÇÃO, ativamos a análise AST apenas quando
    // testamos o gabarito (lado "limpo") — queremos verificar se o gabarito
    // tem boas práticas (variáveis renomeadas, sem números mágicos, etc.).
    // Não ativamos no lado sujo, pois ele falharia na análise propositalmente.
    let forcarAST = (lado === "limpo" && questaoAtual.tipo === "refatoracao");

    let payload = {
        codigo:             codigoParaTestar,
        nomeDaFuncao:       questaoAtual.nomeDaFuncao,
        testes:             questaoAtual.testes,
        forcarAvaliacaoAST: forcarAST,
        codigoSujoOriginal: questaoAtual.codigoSujo // Necessário para a análise AST comparar
    };

    try {
        let resposta = await fetch("/api/admin/sandbox/testar", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload)
        });

        let resultado = await resposta.json();

        if (resultado.sucesso) {
            exibirSucesso(terminal, resultado);
        } else {
            exibirFalha(terminal, resultado);
        }

    } catch (erro) {
        // CONCEITO DE TESTES: Distinguir tipos de falha
        // Este erro é de CONEXÃO (rede/servidor fora do ar), diferente de
        // uma falha de TESTE (código executou mas resultado foi errado).
        // Mensagens diferentes ajudam o professor a diagnosticar corretamente.
        terminal.classList.add("erro");
        terminal.innerText = "❌ Erro de conexão com o servidor de avaliação.";
    }
}

// Monta e exibe a mensagem de sucesso com a lista de casos validados
function exibirSucesso(terminal, resultado) {
    let log = `✅ SUCESSO ABSOLUTO! (${resultado.totalTestes}/${resultado.totalTestes} testes passaram)\n\nCasos Validados:\n`;

    for (let i = 0; i < questaoAtual.testes.length; i++) {
        let teste = questaoAtual.testes[i];
        log += `[Teste ${i + 1}] 📥 Entrada: (${teste.parametros}) ➡️ 📤 Saída Esperada: ${JSON.stringify(teste.saidaEsperada)}\n`;
    }

    terminal.innerText = log;
}

// Monta e exibe a mensagem de falha com o placar e os erros detalhados
function exibirFalha(terminal, resultado) {
    terminal.classList.add("erro");
    terminal.innerText =
        `❌ FALHA (${resultado.totalAcertos}/${resultado.totalTestes} testes passaram):\n\n` +
        resultado.erros.join("\n\n");
}

// =============================================================================
// SEÇÃO 4: SALVAR ALTERAÇÕES
// =============================================================================

// Salva o conteúdo atual dos editores de volta no banco de questões do servidor.
//
// CONCEITO DE QUALIDADE: Atualização Parcial (Merge)
// Enviamos o objeto questaoAtual completo, mas apenas com os campos de código
// atualizados. O servidor fará o merge com os demais campos (testes, tipo, etc.)
// preservando tudo que não foi editado aqui no sandbox.
async function salvarAlteracoesSandbox() {
    // Atualiza o objeto local com o conteúdo atual dos editores antes de enviar
    questaoAtual.codigoSujo  = cmSujo.getValue();
    questaoAtual.codigoLimpo = cmLimpo.getValue();

    try {
        let resposta = await fetch("/api/admin/questoes/atualizar", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(questaoAtual)
        });

        if (resposta.ok) {
            alert("✅ Questão atualizada com sucesso no banco de dados!");
        } else {
            alert("❌ Erro ao salvar no servidor. Tente novamente.");
        }

    } catch (erro) {
        console.error("Falha ao salvar:", erro);
        alert("❌ Erro de conexão ao tentar salvar. O servidor está rodando?");
    }
}

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================

window.onload = carregarQuestao;