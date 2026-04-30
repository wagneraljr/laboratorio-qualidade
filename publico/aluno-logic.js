// =============================================================================
// aluno-logic.js — Lógica da Área do Aluno
// =============================================================================
// Este arquivo controla toda a interatividade da página do aluno:
// o editor de código, os dois modos de jogo (Livre e Competitivo),
// a comunicação com o servidor para buscar questões e avaliar respostas,
// e o sistema de pontuação ao final de uma maratona.
//
// CONCEITO DE QUALIDADE: Separação de Responsabilidades (SRP)
// O arquivo está organizado em seções com responsabilidades distintas:
//   1. Estado global
//   2. Inicialização
//   3. Controle de modos (Livre / Competitivo)
//   4. Lógica do Modo Livre
//   5. Lógica do Modo Competitivo
//   6. Avaliação de código
//   7. Tela de resultado final
// =============================================================================

// -----------------------------------------------------------------------------
// SEÇÃO 1: ESTADO GLOBAL DA PÁGINA
// -----------------------------------------------------------------------------
// Estas variáveis guardam o "estado atual" da sessão do aluno.
// Ficam no topo para serem facilmente encontradas e modificadas.

let editor       = null;    // Instância do editor de código CodeMirror
let modoAtual    = "livre"; // Modo ativo: "livre" ou "competitivo"
let questaoAtual = null;    // Objeto da questão sendo respondida no momento

// Estado exclusivo do Modo Competitivo
let playlistCompetitiva    = []; // Lista de questões sorteadas para a maratona
let indiceQuestaoAtual     = 0;  // Posição da questão atual dentro da playlist
let pontosTotais           = 0;  // Pontos acumulados durante a maratona
let pontosMaximosPossiveis = 0;  // Pontos possíveis acertando tudo na 1ª tentativa
let tentativasNestaQuestao = 0;  // Tentativas erradas na questão atual (gera desconto)
let questaoConcluida       = false; // Impede reavaliação após acerto no modo competitivo

// =============================================================================
// SEÇÃO 2: INICIALIZAÇÃO
// =============================================================================

// window.onload garante que o HTML esteja totalmente carregado antes de
// tentarmos encontrar elementos pelo ID ou instanciar o editor.
window.onload = function() {
    inicializarEditor();
};

// Configura o editor de código CodeMirror no textarea definido no HTML
function inicializarEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById("editor-codigo"), {
        lineNumbers: true,      // Exibe números de linha
        mode:        "javascript",
        theme:       "dracula",
        indentUnit:  4          // Indentação de 4 espaços ao pressionar Tab
    });

    // Bloqueios Anti-Cola para o Modo Competitivo
    // No modo livre, copiar e colar são permitidos normalmente.
    // No modo competitivo, queremos que o aluno realmente escreva o código.
    editor.on("copy",  function(cm, evento) {
        if (modoAtual === "competitivo") {
            evento.preventDefault();
            alert("Bloqueado: no modo competitivo você deve digitar o código!");
        }
    });

    editor.on("paste", function(cm, evento) {
        if (modoAtual === "competitivo") {
            evento.preventDefault();
            alert("Bloqueado: no modo competitivo você deve digitar o código!");
        }
    });
}

// Verifica se o professor está autenticado e redireciona para o painel admin.
// Tentamos acessar uma rota protegida: se o servidor redirecionar, não há sessão ativa.
async function irParaModoProfessor() {
    try {
        let resposta = await fetch("/api/admin/questoes");
        if (resposta.redirected || !resposta.ok) {
            window.location.href = "login.html";
        } else {
            window.location.href = "admin.html";
        }
    } catch (erro) {
        window.location.href = "login.html";
    }
}

// =============================================================================
// SEÇÃO 3: CONTROLE DE MODOS
// =============================================================================

// Alterna entre o Modo Livre e o Modo Competitivo, atualizando toda a interface.
//
// CONCEITO DE QUALIDADE: Centralizar mudanças de estado
// Toda atualização visual relacionada à troca de modo acontece aqui.
// Se um terceiro modo for adicionado no futuro, há um único lugar para editar.
function selecionarModo(modo) {
    // Detecta a transição ANTES de atualizar modoAtual.
    // Assim conseguimos executar lógica específica de "saída" do competitivo.
    let saiuDoCompetitivo = (modoAtual === "competitivo" && modo !== "competitivo");

    modoAtual = modo;

    let ehLivre       = (modo === "livre");
    let ehCompetitivo = (modo === "competitivo");

    // Atualiza as abas de seleção
    document.getElementById("aba-livre").className = ehLivre       ? "aba ativa" : "aba";
    document.getElementById("aba-comp").className  = ehCompetitivo ? "aba ativa" : "aba";

    // Mostra apenas o painel de configuração do modo ativo
    document.getElementById("config-livre").style.display = ehLivre       ? "block" : "none";
    document.getElementById("config-comp").style.display  = ehCompetitivo ? "block" : "none";

    // Atualiza o painel de status do jogador
    document.getElementById("display-modo").innerText            = ehLivre ? "Treinamento Livre" : "Modo Competitivo";
    document.getElementById("display-competitivo").style.display = ehCompetitivo ? "block" : "none";

    // Botão de gabarito só aparece no modo livre
    // (no competitivo, revelar o gabarito faria parte do desafio não ter sentido)
    document.getElementById("btn-gabarito").style.display = ehLivre       ? "block" : "none";
    document.getElementById("btn-pular").style.display    = ehCompetitivo ? "block" : "none";

    // Ao sair do competitivo, limpamos toda a sessão da maratona.
    // Isso evita reaproveitar playlist, índice e pontuação antigos ao voltar depois.
    if (saiuDoCompetitivo) {
        resetarEstadoCompetitivo();
    }

    limparAmbiente();
}

// Reseta todas as variáveis e indicadores visuais da maratona competitiva.
function resetarEstadoCompetitivo() {
    playlistCompetitiva    = [];
    indiceQuestaoAtual     = 0;
    pontosTotais           = 0;
    pontosMaximosPossiveis = 0;
    tentativasNestaQuestao = 0;
    questaoConcluida       = false;

    // Também limpamos o painel para impedir "efeito fantasma" da sessão anterior.
    document.getElementById("comp-progresso").innerText  = "0/0";
    document.getElementById("comp-nivel").innerText      = "-";
    document.getElementById("comp-pontos").innerText     = "0";
    document.getElementById("comp-tentativas").innerText = "0";
}

// Reseta o editor e os textos para o estado inicial (sem questão carregada)
function limparAmbiente() {
    questaoAtual = null;
    document.getElementById("titulo-missao").innerText  = "Aguardando...";
    document.getElementById("missao-texto").innerText   = "Configure e inicie um desafio.";
    document.getElementById("terminal-aluno").innerText = "Aguardando execução...";
    document.getElementById("btn-avaliar").innerText             = "Verificar Resposta ▶️";
    document.getElementById("btn-avaliar").style.backgroundColor = "var(--if-verde)";
    editor.setValue("");
}

// =============================================================================
// SEÇÃO 4: MODO LIVRE
// =============================================================================

// Busca uma questão aleatória do servidor com base no tipo e dificuldade escolhidos
async function buscarQuestaoLivre() {
    let tipo = document.getElementById("tipo-livre").value;
    let dif  = document.getElementById("dif-livre").value;

    // CONCEITO DE TESTES: Tratamento de Exceção em Operação de Rede
    // fetch() pode lançar uma exceção se não houver conexão com o servidor.
    // O try/catch garante que o aluno receba uma mensagem clara em vez de
    // a página quebrar silenciosamente sem nenhum feedback.
    try {
        let resposta = await fetch("/api/missao-aleatoria", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ tipo: tipo, dificuldade: dif })
        });

        if (resposta.ok) {
            let json = await resposta.json();
            questaoAtual = json.dados;
            carregarQuestao();
        } else if (resposta.status === 404) {
            document.getElementById("terminal-aluno").innerText =
                "⚠️ Nenhuma questão encontrada para este perfil. Tente outro tipo ou dificuldade.";
        } else {
            document.getElementById("terminal-aluno").innerText =
                "⚠️ Erro ao buscar questão. Tente novamente.";
        }
    } catch (erro) {
        document.getElementById("terminal-aluno").innerText =
            "⚠️ Erro de conexão com o servidor. O servidor está rodando?";
    }
}

// Exibe o gabarito da questão atual no terminal (apenas disponível no Modo Livre)
function mostrarGabarito() {
    if (!questaoAtual) return;
    document.getElementById("terminal-aluno").innerText =
        ">> GABARITO SUGERIDO:\n\n" + questaoAtual.codigoLimpo;
}

// =============================================================================
// SEÇÃO 5: MODO COMPETITIVO (Maratona)
// =============================================================================

// Inicia uma nova maratona: busca o banco público, filtra, embaralha e começa
async function iniciarCompeticao() {
    let qtd = parseInt(document.getElementById("comp-qtd").value);
    let min = parseInt(document.getElementById("comp-min").value);
    let max = parseInt(document.getElementById("comp-max").value);

    try {
        let resposta = await fetch("/api/banco-publico");

        if (!resposta.ok) {
            alert("Erro ao carregar o banco de desafios. Tente novamente.");
            return;
        }

        let banco = await resposta.json();

        // Filtra apenas questões de correção dentro da faixa de dificuldade configurada.
        // O modo competitivo usa correção de bugs pois tem resultado objetivo (certo/errado).
        playlistCompetitiva = banco.filter(function(questao) {
            return questao.tipo        === "correcao" &&
                   questao.dificuldade >= min         &&
                   questao.dificuldade <= max;
        });

        // Embaralha a lista para que cada maratona tenha uma ordem diferente.
        // sort com função aleatória não é perfeitamente uniforme, mas é simples
        // e suficiente para fins didáticos.
        playlistCompetitiva.sort(function() { return Math.random() - 0.5; });

        // Limita à quantidade desejada pelo aluno
        playlistCompetitiva = playlistCompetitiva.slice(0, qtd);

        if (playlistCompetitiva.length === 0) {
            alert("Nenhuma questão encontrada para esta faixa. Tente outra dificuldade.");
            return;
        }

        // Reinicia todo o estado da maratona antes de começar
        pontosTotais           = 0;
        indiceQuestaoAtual     = 0;
        pontosMaximosPossiveis = calcularPontosMaximos(playlistCompetitiva);

        proximaQuestaoComp();

    } catch (erro) {
        console.error("Falha ao iniciar maratona:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Calcula a pontuação máxima possível para a playlist sorteada.
//
// CONCEITO DE QUALIDADE: Extrair cálculos em funções com nome descritivo
// "calcularPontosMaximos(playlist)" é mais legível do que um loop solto
// dentro de iniciarCompeticao() — deixa claro o que está sendo calculado.
function calcularPontosMaximos(playlist) {
    let total = 0;
    for (let questao of playlist) {
        total += questao.dificuldade * 100;
    }
    return total;
}

// Carrega a próxima questão da playlist, ou finaliza a maratona se acabou
function proximaQuestaoComp() {
    if (indiceQuestaoAtual >= playlistCompetitiva.length) {
        finalizarMaratona();
        return;
    }

    questaoAtual           = playlistCompetitiva[indiceQuestaoAtual];
    tentativasNestaQuestao = 0;
    questaoConcluida       = false;

    // Atualiza o painel de status do competitivo
    document.getElementById("comp-progresso").innerText  = `${indiceQuestaoAtual + 1}/${playlistCompetitiva.length}`;
    document.getElementById("comp-nivel").innerText      = questaoAtual.dificuldade;
    document.getElementById("comp-pontos").innerText     = pontosTotais;
    document.getElementById("comp-tentativas").innerText = "0";

    carregarQuestao();
}

// Permite ao aluno pular a questão atual sem ganhar pontos nela
function pularQuestao() {
    if (!questaoAtual || questaoConcluida) return;

    if (confirm("Pular esta questão? Você ganhará 0 pontos nela.")) {
        indiceQuestaoAtual++;
        proximaQuestaoComp();
    }
}

// =============================================================================
// SEÇÃO 6: AVALIAÇÃO DE CÓDIGO
// =============================================================================

// Preenche o editor e os textos da missão com os dados da questão atual
function carregarQuestao() {
    document.getElementById("titulo-missao").innerText           = questaoAtual.titulo;
    document.getElementById("missao-texto").innerText            = questaoAtual.missao;
    document.getElementById("btn-avaliar").innerText             = "Verificar Resposta ▶️";
    document.getElementById("btn-avaliar").style.backgroundColor = "var(--if-verde)";
    editor.setValue(questaoAtual.codigoSujo);
}

// Envia o código do editor para o servidor avaliar e exibe o resultado no terminal.
//
// CONCEITO DE TESTES: Este é o ponto central de avaliação da plataforma.
// O servidor executa os casos de teste contra o código e retorna:
//   { sucesso: true/false, erros: ["mensagem de cada falha"] }
// Esta função trata três situações distintas:
//   1. Sucesso (todos os testes passaram)
//   2. Falha nos testes (código executou mas resultado errado)
//   3. Falha de conexão (servidor inacessível)
async function enviarCodigo() {
    if (!questaoAtual) return;

    // No modo competitivo, após acertar, o botão vira "Próxima Questão"
    if (questaoConcluida && modoAtual === "competitivo") {
        indiceQuestaoAtual++;
        proximaQuestaoComp();
        return;
    }

    let terminal = document.getElementById("terminal-aluno");

    // CONCEITO DE TESTES: Isolamento do Ponto de Falha
    // Apenas o fetch fica dentro do try/catch — ele é a única operação que pode
    // lançar exceção por razões externas (rede, servidor fora do ar).
    // A lógica de processar o resultado fica fora, pois não tem esse risco.
    let resposta, resultado;
    try {
        resposta = await fetch("/api/avaliar", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ idQuestao: questaoAtual.id, codigo: editor.getValue() })
        });

        if (!resposta.ok) throw new Error("Erro do servidor: " + resposta.status);
        resultado = await resposta.json();

    } catch (erro) {
        terminal.innerText = "⚠️ Erro de conexão com o servidor. Verifique sua rede e tente novamente.";
        return;
    }

    // Delega o processamento para funções específicas de acordo com o resultado
    if (resultado.sucesso) {
        processarAcerto(terminal);
    } else {
        processarErro(terminal, resultado.erros);
    }
}

// Trata a resposta quando o aluno acertou todos os testes
function processarAcerto(terminal) {
    if (modoAtual === "livre") {
        terminal.innerText = "✅ PERFEITO! Código validado com sucesso.";
        return;
    }

    // Modo competitivo: calcula pontos com penalidade proporcional às tentativas erradas.
    //
    // CONCEITO DE QUALIDADE: Constantes com nomes descritivos (sem "números mágicos")
    // PONTOS_BASE, PENALIDADE_POR_ERRO e PONTOS_MINIMOS tornam a fórmula legível.
    // Compare: Math.max(10, dif * 100 - tentativas * 20) — o que significa cada número?
    const PONTOS_BASE         = questaoAtual.dificuldade * 100;
    const PENALIDADE_POR_ERRO = 20;
    const PONTOS_MINIMOS      = 10; // Garante que acertar sempre vale algo

    let desconto     = tentativasNestaQuestao * PENALIDADE_POR_ERRO;
    let pontosGanhos = Math.max(PONTOS_MINIMOS, PONTOS_BASE - desconto);

    pontosTotais    += pontosGanhos;
    questaoConcluida = true;

    document.getElementById("comp-pontos").innerText             = pontosTotais;
    document.getElementById("btn-avaliar").innerText             = "Próxima Questão ➡️";
    document.getElementById("btn-avaliar").style.backgroundColor = "#2980b9";

    terminal.innerText = `✅ ACERTOU! +${pontosGanhos} pontos ganhos.\n\nClique no botão azul para avançar.`;
}

// Trata a resposta quando o aluno errou algum teste
function processarErro(terminal, erros) {
    tentativasNestaQuestao++;

    if (modoAtual === "competitivo") {
        document.getElementById("comp-tentativas").innerText = tentativasNestaQuestao;
    }

    terminal.innerText = "❌ FALHA NOS TESTES:\n\n" + erros.join("\n");
}

// =============================================================================
// SEÇÃO 7: TELA DE RESULTADO FINAL (Maratona)
// =============================================================================

// Calcula o desempenho final e exibe o modal com medalha e liga conquistadas.
//
// CONCEITO DE QUALIDADE: Funções pequenas com responsabilidade única
// finalizarMaratona() é o "orquestrador" — ela chama funções menores que
// calculam cada parte do resultado. Isso torna o código mais fácil de ler,
// testar e modificar individualmente.
function finalizarMaratona() {
    let { liga, corLiga } = calcularLiga();
    let { medalha, icone } = calcularMedalha();

    let porcentagem = (pontosTotais / pontosMaximosPossiveis) * 100;
    let mediaDif    = calcularMediaDificuldade();
    let mensagem    = gerarMensagemFinal(liga, medalha);

    document.getElementById("insignia-icone").innerText        = icone;
    document.getElementById("insignia-titulo").innerText       = `Medalha de ${medalha} - Liga ${liga}`;
    document.getElementById("insignia-titulo").style.color     = corLiga;
    document.getElementById("insignia-desc").innerText         =
        `${mensagem}\n\n` +
        `Pontos: ${pontosTotais} de ${pontosMaximosPossiveis}\n` +
        `Precisão: ${porcentagem.toFixed(1)}% | Dificuldade Média: ${mediaDif.toFixed(1)}`;

    document.getElementById("modal-resultado").style.display = "flex";
}

// Calcula a média de dificuldade das questões enfrentadas na maratona.
// A LIGA é determinada pela dificuldade enfrentada — não pela pontuação.
function calcularMediaDificuldade() {
    let soma = 0;
    for (let questao of playlistCompetitiva) {
        soma += questao.dificuldade;
    }
    return soma / playlistCompetitiva.length;
}

// Determina a liga com base na dificuldade média da maratona
function calcularLiga() {
    let mediaDif = calcularMediaDificuldade();

    if (mediaDif >= 4) {
        return { liga: "Elite (Avançada)",     corLiga: "#8e44ad" }; // Roxo
    } else if (mediaDif >= 2.5) {
        return { liga: "Profissional (Média)", corLiga: "#2980b9" }; // Azul
    } else {
        return { liga: "Iniciante",            corLiga: "#27ae60" }; // Verde
    }
}

// Determina a medalha com base na porcentagem de pontos obtidos.
//
// CONCEITO DE QUALIDADE: Constantes nomeadas no lugar de números mágicos.
// LIMIAR_OURO e LIMIAR_PRATA documentam os critérios de avaliação no próprio código.
function calcularMedalha() {
    const LIMIAR_OURO  = 90; // Porcentagem mínima para conquistar ouro
    const LIMIAR_PRATA = 60; // Porcentagem mínima para conquistar prata

    let porcentagem = (pontosTotais / pontosMaximosPossiveis) * 100;

    if (porcentagem >= LIMIAR_OURO) {
        return { medalha: "Ouro",   icone: "🥇" };
    } else if (porcentagem >= LIMIAR_PRATA) {
        return { medalha: "Prata",  icone: "🥈" };
    } else {
        return { medalha: "Bronze", icone: "🥉" };
    }
}

// Gera uma mensagem de incentivo personalizada com base na liga e medalha conquistadas
function gerarMensagemFinal(liga, medalha) {
    if (liga === "Iniciante" && medalha === "Ouro") {
        return "Domínio total do básico! Que tal subir para a Liga Profissional?";
    } else if (liga === "Elite (Avançada)") {
        return "Você enfrentou os maiores desafios do laboratório. Respeito máximo!";
    } else {
        return "Ótimo esforço. Continue praticando para subir de liga.";
    }
}

// Fecha o modal de resultado e volta ao Modo Livre
function fecharModalResultado() {
    document.getElementById("modal-resultado").style.display = "none";
    selecionarModo("livre");
}