// ==========================================
// 1. ESTADO GLOBAL DO ALUNO
// ==========================================
let editor;
let modoAtual = 'livre'; // 'livre' ou 'competitivo'
let questaoAtual = null;

// Variáveis da Competição
let playlistCompetitiva = [];
let indiceQuestaoAtual = 0;
let pontosTotais = 0;
let pontosMaximosPossiveis = 0;
let tentativasNestaQuestao = 0;
let questaoConcluida = false; // Trava para impedir re-envios após acerto/pulo

/// ==========================================
// 2. INICIALIZAÇÃO E UI
// ==========================================
window.onload = function() {
    let areaDeTexto = document.getElementById("editor-codigo");
    editor = CodeMirror.fromTextArea(areaDeTexto, {
        lineNumbers: true,
        mode: "javascript",
        theme: "dracula",
        indentUnit: 4
    });

    // --- SISTEMA ANTI-COLA (Apenas Modo Competitivo) ---
    
    // Bloqueia o "Ctrl + C" e Copiar pelo mouse
    editor.on("copy", function(cm, evento) {
        if (modoAtual === 'competitivo') {
            evento.preventDefault();
            dispararAlertaAntiCola("Copiar");
        }
    });

    // Bloqueia o "Ctrl + V" e Colar pelo mouse
    editor.on("paste", function(cm, evento) {
        if (modoAtual === 'competitivo') {
            evento.preventDefault();
            dispararAlertaAntiCola("Colar");
        }
    });

    // Bloqueia o "Ctrl + X" e Recortar pelo mouse
    editor.on("cut", function(cm, evento) {
        if (modoAtual === 'competitivo') {
            evento.preventDefault();
            dispararAlertaAntiCola("Recortar");
        }
    });
};

function dispararAlertaAntiCola(acao) {
    let terminal = document.getElementById("terminal-aluno");
    terminal.classList.add("erro");
    terminal.innerText = `⚠️ SISTEMA ANTI-FRAUDE: A ação de '${acao}' está desativada no Modo Competitivo!\n\nPara provar seu conhecimento, você deve digitar as soluções ou correções manualmente.`;
}

function selecionarModo(modo) {
    modoAtual = modo;
    
    // Atualiza Abas
    document.getElementById("aba-livre").classList.remove("ativa");
    document.getElementById("aba-comp").classList.remove("ativa");
    
    // Oculta/Mostra Paineis
    document.getElementById("config-livre").classList.remove("ativo");
    document.getElementById("config-comp").classList.remove("ativo");

    if (modo === 'livre') {
        document.getElementById("aba-livre").classList.add("ativa");
        document.getElementById("config-livre").classList.add("ativo");
        document.getElementById("display-modo").innerText = "Treinamento Livre";
        document.getElementById("display-competitivo").style.display = "none";
        
        // Botões do Editor
        document.getElementById("btn-gabarito").style.display = "block";
        document.getElementById("btn-pular").style.display = "none";
        document.getElementById("btn-avaliar").innerText = "Testar Código ▶️";
    } else {
        document.getElementById("aba-comp").classList.add("ativa");
        document.getElementById("config-comp").classList.add("ativo");
        document.getElementById("display-modo").innerText = "Modo Competitivo";
        document.getElementById("display-competitivo").style.display = "block";
        
        // Botões do Editor
        document.getElementById("btn-gabarito").style.display = "none";
        document.getElementById("btn-pular").style.display = "block";
    }
    
    limparPalco();
}

function limparPalco() {
    questaoAtual = null;
    document.getElementById("titulo-missao").innerText = "Aguardando...";
    document.getElementById("missao-texto").innerText = "Selecione as opções e inicie.";
    editor.setValue("");
    document.getElementById("terminal-aluno").innerText = "Aguardando execução...";
    document.getElementById("terminal-aluno").classList.remove("erro");
}

// Função para alternar de modo com verificação de login
async function irParaModoProfessor() {
    const terminal = document.getElementById("terminal-aluno");
    
    try {
        // Tenta acessar a rota protegida
        const resposta = await fetch("/api/admin/questoes");

        if (resposta.ok) {
            // Se o professor estiver logado, vai para o painel
            window.location.href = "admin.html";
        } else {
            // Caso contrário (401 ou 403), vai para a tela de login
            window.location.href = "login.html";
        }
    } catch (erro) {
        // Se houver erro de rede, assume que não há sessão e vai para o login
        window.location.href = "login.html";
    }
}

// ==========================================
// 3. MODO LIVRE (Treinamento)
// ==========================================
async function buscarQuestaoLivre() {
    let tipo = document.getElementById("tipo-livre").value;
    let dif = document.getElementById("dif-livre").value;
    
    let terminal = document.getElementById("terminal-aluno");
    terminal.classList.remove("erro");
    terminal.innerText = "Buscando...";

    try {
        let resposta = await fetch("/api/missao-aleatoria", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: tipo, dificuldade: dif })
        });
        
        if (resposta.ok) {
            let resultado = await resposta.json();
            questaoAtual = resultado.dados; 
            carregarQuestaoNaTela();
            terminal.innerText = "Missão Livre carregada. Teste quantas vezes quiser!";
        } else {
            terminal.classList.add("erro");
            terminal.innerText = "Nenhuma questão encontrada para este filtro.";
        }
    } catch (erro) {
        terminal.innerText = "Erro de conexão.";
    }
}

function mostrarGabarito() {
    if (!questaoAtual) return;
    let terminal = document.getElementById("terminal-aluno");
    terminal.classList.remove("erro");
    terminal.innerText = "👁️ GABARITO DA QUESTÃO:\n\n" + questaoAtual.codigoLimpo;
}

// ==========================================
// 4. MODO COMPETITIVO (Avaliação Rigorosa)
// ==========================================
async function iniciarCompeticao() {
    let qtd = parseInt(document.getElementById("comp-qtd").value);
    let min = parseInt(document.getElementById("comp-min").value);
    let max = parseInt(document.getElementById("comp-max").value);

    let terminal = document.getElementById("terminal-aluno");
    terminal.innerText = "Montando playlist de competição...";

    try {
        // Busca TODO o banco de questões
        let resposta = await fetch("/api/questoes");
        let bancoCompleto = await resposta.json();

        // Filtra estritamente pelo modo competitivo (Apenas Correção e Dificuldade)
        let questoesValidas = [];
        for (let i = 0; i < bancoCompleto.length; i++) {
            let q = bancoCompleto[i];
            if (q.tipo === 'correcao' && q.dificuldade >= min && q.dificuldade <= max) {
                questoesValidas.push(q);
            }
        }

        if (questoesValidas.length === 0) {
            terminal.classList.add("erro");
            terminal.innerText = "Não existem questões de Correção cadastradas neste intervalo de dificuldade.";
            return;
        }

        // Embaralha as questões (Fisher-Yates Shuffle básico)
        for (let i = questoesValidas.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = questoesValidas[i];
            questoesValidas[i] = questoesValidas[j];
            questoesValidas[j] = temp;
        }

        // Pega a quantidade solicitada (ou o máximo disponível)
        playlistCompetitiva = questoesValidas.slice(0, qtd);
        
        // Zera os Placar
        pontosTotais = 0;
        pontosMaximosPossiveis = 0;
        indiceQuestaoAtual = 0;
        
        // Calcula o máximo possível perfeito (Nível * 100 para cada questão)
        for (let i = 0; i < playlistCompetitiva.length; i++) {
            pontosMaximosPossiveis += (playlistCompetitiva[i].dificuldade * 100);
        }

        avancarQuestaoCompetitiva();

    } catch (erro) {
        terminal.innerText = "Erro ao conectar com o banco de questões.";
    }
}

function avancarQuestaoCompetitiva() {
    if (indiceQuestaoAtual >= playlistCompetitiva.length) {
        finalizarCompeticao();
        return;
    }

    questaoAtual = playlistCompetitiva[indiceQuestaoAtual];
    tentativasNestaQuestao = 0;
    questaoConcluida = false;
    
    document.getElementById("comp-progresso").innerText = `${indiceQuestaoAtual + 1} / ${playlistCompetitiva.length}`;
    document.getElementById("comp-pontos").innerText = pontosTotais;
    document.getElementById("comp-tentativas").innerText = tentativasNestaQuestao;
    
    carregarQuestaoNaTela();
    
    document.getElementById("btn-avaliar").innerText = "Testar Código ▶️";
    document.getElementById("btn-avaliar").style.backgroundColor = "var(--if-verde)";
    document.getElementById("terminal-aluno").classList.remove("erro");
    document.getElementById("terminal-aluno").innerText = "Valendo Pontos! Leia com atenção, cada erro reduz a recompensa.";
}

function pularQuestao() {
    if (!questaoAtual || questaoConcluida) return;
    
    let confirmacao = confirm("Tem certeza? Você receberá 0 pontos por esta questão.");
    if (confirmacao) {
        questaoConcluida = true;
        let terminal = document.getElementById("terminal-aluno");
        terminal.classList.add("erro");
        terminal.innerText = "Questão pulada. Pontos ganhos: 0.\n\nClique no botão para ir para a próxima.";
        
        prepararBotaoProxima();
    }
}

// ==========================================
// 5. MOTOR DE TESTE (Comum a ambos)
// ==========================================
function carregarQuestaoNaTela() {
    document.getElementById("titulo-missao").innerText = questaoAtual.titulo;
    document.getElementById("missao-texto").innerText = questaoAtual.missao;
    editor.setValue(questaoAtual.codigoSujo);
}

async function enviarCodigo() {
    if (!questaoAtual) return;

    // Se a questão já foi resolvida ou pulada, o botão age como "Avançar" no modo competitivo
    if (questaoConcluida && modoAtual === 'competitivo') {
        indiceQuestaoAtual++;
        avancarQuestaoCompetitiva();
        return;
    }

    let codigoDoAluno = editor.getValue();
    let terminal = document.getElementById("terminal-aluno");
    
    terminal.innerText = ">> Analisando código e executando testes...";
    terminal.classList.remove("erro");

    try {
        let resposta = await fetch("/api/avaliar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigoDoAluno, idQuestao: questaoAtual.id })
        });
        
        let dados = await resposta.json();
        
        if (dados.sucesso) {
            processarVitoria(dados, terminal);
        } else {
            processarFalha(dados, terminal);
        }
    } catch (erro) {
        terminal.classList.add("erro");
        terminal.innerText = ">> Falha de conexão com o servidor.";
    }
}

function processarVitoria(dados, terminal) {
    if (modoAtual === 'livre') {
        terminal.innerText = `✅ SUCESSO!\nTodos os ${dados.totalTestes} testes passaram.\n\nVocê é livre para testar outras abordagens ou buscar nova missão.`;
    } 
    else { // Competitivo
        questaoConcluida = true;
        
        // Matemática dos Pontos: (Nível * 100) - (Tentativas * 20%)
        let base = questaoAtual.dificuldade * 100;
        let reducao = tentativasNestaQuestao * (base * 0.20); 
        let pontosGanhos = Math.floor(base - reducao);
        
        // Console: Pelo menos 10% dos pontos garantidos se ele insistir e acertar
        let pontosMinimos = Math.floor(base * 0.10);
        if (pontosGanhos < pontosMinimos) pontosGanhos = pontosMinimos;

        pontosTotais += pontosGanhos;
        document.getElementById("comp-pontos").innerText = pontosTotais;

        let msg = `✅ CÓDIGO APROVADO!\n\n`;
        msg += `Dificuldade: Nível ${questaoAtual.dificuldade} (Máx: ${base} pts)\n`;
        msg += `Erros cometidos: ${tentativasNestaQuestao}\n`;
        msg += `🌟 Pontos Ganhos: +${pontosGanhos}\n\n`;
        msg += `Clique no botão abaixo para avançar.`;
        terminal.innerText = msg;

        prepararBotaoProxima();
    }
}

function processarFalha(dados, terminal) {
    terminal.classList.add("erro");
    
    let logDeErros = `❌ FALHA LOGICA (${dados.totalAcertos}/${dados.totalTestes} acertos)\n\n`;
    for (let i = 0; i < dados.erros.length; i++) {
        logDeErros += dados.erros[i] + "\n----------------------------------------\n";
    }

    if (modoAtual === 'competitivo') {
        tentativasNestaQuestao++;
        document.getElementById("comp-tentativas").innerText = tentativasNestaQuestao;
        logDeErros += `\n⚠️ Penalidade aplicada! Seus pontos em potencial caíram. Tente corrigir o erro acima.`;
    }

    terminal.innerText = logDeErros;
}

function prepararBotaoProxima() {
    let btn = document.getElementById("btn-avaliar");
    btn.innerText = "Avançar para Próxima Questão ➡️";
    btn.style.backgroundColor = "#2980b9";
}

// ==========================================
// 6. ENCERRAMENTO E INSÍGNIAS
// ==========================================
function finalizarCompeticao() {
    limparPalco();
    
    // Calcula a porcentagem de acerto
    let porcentagem = (pontosTotais / pontosMaximosPossiveis) * 100;
    
    let icone = "🥉";
    let titulo = "Aprendiz de Lógica";
    let cor = "#cd7f32"; // Bronze
    
    if (porcentagem >= 90) {
        icone = "🥇";
        titulo = "Caçador de Bugs Mestre!";
        cor = "#f1c40f"; // Ouro
    } else if (porcentagem >= 60) {
        icone = "🥈";
        titulo = "Escovador de Bits Especialista";
        cor = "#bdc3c7"; // Prata
    }

    document.getElementById("insignia-icone").innerText = icone;
    document.getElementById("insignia-titulo").innerText = titulo;
    document.getElementById("insignia-titulo").style.color = cor;
    document.getElementById("insignia-desc").innerText = `Você fez ${pontosTotais} de ${pontosMaximosPossiveis} pontos possíveis (${porcentagem.toFixed(1)}%).`;
    
    document.getElementById("modal-resultado").style.display = "flex";
}

function fecharModalResultado() {
    document.getElementById("modal-resultado").style.display = "none";
}