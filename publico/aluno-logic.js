let editor;
let modoAtual = 'livre';
let questaoAtual = null;

// Variáveis Competitivas
let playlistCompetitiva = [];
let indiceQuestaoAtual = 0;
let pontosTotais = 0;
let pontosMaximosPossiveis = 0;
let tentativasNestaQuestao = 0;
let questaoConcluida = false;

// 1. INICIALIZAÇÃO E SEGURANÇA
window.onload = function() {
    editor = CodeMirror.fromTextArea(document.getElementById("editor-codigo"), {
        lineNumbers: true,
        mode: "javascript",
        theme: "dracula",
        indentUnit: 4
    });

    // Bloqueios Anti-Cola
    editor.on("copy", (cm, e) => { if(modoAtual === 'competitivo') { e.preventDefault(); alert("Bloqueado: No modo competitivo você deve digitar o código!"); }});
    editor.on("paste", (cm, e) => { if(modoAtual === 'competitivo') { e.preventDefault(); alert("Bloqueado: No modo competitivo você deve digitar o código!"); }});
};

async function irParaModoProfessor() {
    try {
        const resposta = await fetch("/api/admin/questoes");
        // No seu app.js, o redirecionamento do middleware faz o fetch receber o HTML do login
        if (resposta.redirected || !resposta.ok) {
            window.location.href = "login.html";
        } else {
            window.location.href = "admin.html";
        }
    } catch (e) {
        window.location.href = "login.html";
    }
}

// 2. CONTROLE DE MODOS
function selecionarModo(modo) {
    modoAtual = modo;
    document.getElementById("aba-livre").className = modo === 'livre' ? "aba ativa" : "aba";
    document.getElementById("aba-comp").className = modo === 'competitivo' ? "aba ativa" : "aba";
    document.getElementById("config-livre").style.display = modo === 'livre' ? "block" : "none";
    document.getElementById("config-comp").style.display = modo === 'competitivo' ? "block" : "none";
    document.getElementById("display-modo").innerText = modo === 'livre' ? "Treinamento Livre" : "Modo Competitivo";
    document.getElementById("display-competitivo").style.display = modo === 'competitivo' ? "block" : "none";
    document.getElementById("btn-gabarito").style.display = modo === 'livre' ? "block" : "none";
    document.getElementById("btn-pular").style.display = modo === 'competitivo' ? "block" : "none";
    limparAmbiente();
}

function limparAmbiente() {
    questaoAtual = null;
    document.getElementById("titulo-missao").innerText = "Aguardando...";
    document.getElementById("missao-texto").innerText = "Configure e inicie um desafio.";
    editor.setValue("");
    document.getElementById("terminal-aluno").innerText = "Aguardando execução...";
}

// 3. LOGICA MODO LIVRE
async function buscarQuestaoLivre() {
    const tipo = document.getElementById("tipo-livre").value;
    const dif = document.getElementById("dif-livre").value;
    const res = await fetch("/api/missao-aleatoria", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({tipo, dificuldade: dif})
    });
    if(res.ok) {
        const json = await res.json();
        questaoAtual = json.dados;
        carregarQuestao();
    }
}

function mostrarGabarito() {
    if(!questaoAtual) return;
    document.getElementById("terminal-aluno").innerText = ">> GABARITO SUGERIDO:\n\n" + questaoAtual.codigoLimpo;
}

// 4. LOGICA COMPETITIVA
async function iniciarCompeticao() {
    const qtd = parseInt(document.getElementById("comp-qtd").value);
    const min = parseInt(document.getElementById("comp-min").value);
    const max = parseInt(document.getElementById("comp-max").value);

    try {
        // CORREÇÃO: Alterado de /api/admin/questoes para /api/banco-publico
        const res = await fetch("/api/banco-publico"); 
        
        if (!res.ok) {
            alert("Erro ao carregar o banco de desafios.");
            return;
        }

        const banco = await res.json();

        // Filtra apenas questões de correção dentro da faixa de dificuldade
        playlistCompetitiva = banco.filter(function(q) {
            return q.tipo === 'correcao' && 
                   q.dificuldade >= min && 
                   q.dificuldade <= max;
        });

        // Embaralha e corta para a quantidade desejada
        playlistCompetitiva.sort(function() { return Math.random() - 0.5; });
        playlistCompetitiva = playlistCompetitiva.slice(0, qtd);

        if (playlistCompetitiva.length === 0) {
            alert("Nenhuma questão de correção encontrada para este nível. Tente outra faixa.");
            return;
        }

        // Reinicia o estado da maratona
        pontosTotais = 0;
        indiceQuestaoAtual = 0;
        
        // Calcula a pontuação máxima baseada na dificuldade das questões sorteadas
        pontosMaximosPossiveis = 0;
        for (let i = 0; i < playlistCompetitiva.length; i++) {
            pontosMaximosPossiveis += (playlistCompetitiva[i].dificuldade * 100);
        }

        proximaQuestaoComp();

    } catch (erro) {
        console.error("Falha ao iniciar maratona:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

function proximaQuestaoComp() {
    if(indiceQuestaoAtual >= playlistCompetitiva.length) {
        finalizarMaratona();
        return;
    }
    questaoAtual = playlistCompetitiva[indiceQuestaoAtual];
    tentativasNestaQuestao = 0;
    questaoConcluida = false;
    document.getElementById("comp-progresso").innerText = `${indiceQuestaoAtual + 1}/${playlistCompetitiva.length}`;
    document.getElementById("comp-nivel").innerText = questaoAtual.dificuldade;
    document.getElementById("comp-pontos").innerText = pontosTotais;
    document.getElementById("comp-tentativas").innerText = "0";
    carregarQuestao();
}

function pularQuestao() {
    if(!questaoAtual || questaoConcluida) return;
    if(confirm("Pular esta questão? Você ganhará 0 pontos nela.")) {
        indiceQuestaoAtual++;
        proximaQuestaoComp();
    }
}

// 5. MOTOR DE AVALIAÇÃO
function carregarQuestao() {
    document.getElementById("titulo-missao").innerText = questaoAtual.titulo;
    document.getElementById("missao-texto").innerText = questaoAtual.missao;
    editor.setValue(questaoAtual.codigoSujo);
    document.getElementById("btn-avaliar").innerText = "Verificar Resposta ▶️";
    document.getElementById("btn-avaliar").style.backgroundColor = "var(--if-verde)";
}

async function enviarCodigo() {
    if(!questaoAtual) return;
    if(questaoConcluida && modoAtual === 'competitivo') {
        indiceQuestaoAtual++;
        proximaQuestaoComp();
        return;
    }

    const terminal = document.getElementById("terminal-aluno");

    let res, dados;
    try {
        res = await fetch("/api/avaliar", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({idQuestao: questaoAtual.id, codigo: editor.getValue()})
        });
        if (!res.ok) throw new Error("Resposta inesperada do servidor: " + res.status);
        dados = await res.json();
    } catch (erro) {
        terminal.innerText = "⚠️ Erro de conexão com o servidor. Verifique sua rede e tente novamente.";
        return;
    }

    if(dados.sucesso) {
        if(modoAtual === 'livre') {
            terminal.innerText = "✅ PERFEITO! Código validado com sucesso.";
        } else {
            questaoConcluida = true;
            const base = questaoAtual.dificuldade * 100;
            const desconto = tentativasNestaQuestao * 20;
            const pontosGanhos = Math.max(10, base - desconto);
            pontosTotais += pontosGanhos;
            document.getElementById("comp-pontos").innerText = pontosTotais;
            terminal.innerText = `✅ ACERTOU! +${pontosGanhos} pontos ganhos.\n\nClique no botão azul para avançar.`;
            document.getElementById("btn-avaliar").innerText = "Próxima Questão ➡️";
            document.getElementById("btn-avaliar").style.backgroundColor = "#2980b9";
        }
    } else {
        tentativasNestaQuestao++;
        if(modoAtual === 'competitivo') document.getElementById("comp-tentativas").innerText = tentativasNestaQuestao;
        terminal.innerText = "❌ FALHA NOS TESTES:\n\n" + dados.erros.join("\n");
    }
}

function finalizarMaratona() {
    // 1. Cálculo da Média de Dificuldade (Determina a LIGA)
    let somaDificuldade = 0;
    for (let i = 0; i < playlistCompetitiva.length; i++) {
        somaDificuldade += playlistCompetitiva[i].dificuldade;
    }
    const mediaDif = somaDificuldade / playlistCompetitiva.length;

    // 2. Cálculo da Porcentagem de Acerto (Determina a MEDALHA)
    const porcentagem = (pontosTotais / pontosMaximosPossiveis) * 100;

    // 3. Definição da Liga
    let liga = "Iniciante";
    let corLiga = "#27ae60"; // Verde
    if (mediaDif >= 4) {
        liga = "Elite (Avançada)";
        corLiga = "#8e44ad"; // Roxo
    } else if (mediaDif >= 2.5) {
        liga = "Profissional (Média)";
        corLiga = "#2980b9"; // Azul
    }

    // 4. Definição da Medalha (Ícone e Título)
    let medalha = "Bronze";
    let icone = "🥉";
    if (porcentagem >= 90) {
        medalha = "Ouro";
        icone = "🥇";
    } else if (porcentagem >= 60) {
        medalha = "Prata";
        icone = "🥈";
    }

    // 5. Interface e Feedback
    const tituloFinal = `Medalha de ${medalha} - Liga ${liga}`;
    
    document.getElementById("insignia-icone").innerText = icone;
    document.getElementById("insignia-titulo").innerText = tituloFinal;
    document.getElementById("insignia-titulo").style.color = corLiga;
    
    let mensagemEstilo = "";
    if (liga === "Iniciante" && medalha === "Ouro") {
        mensagemEstilo = "Domínio total do básico! Que tal subir para a Liga Profissional?";
    } else if (liga === "Elite (Avançada)") {
        mensagemEstilo = "Você enfrentou os maiores desafios do laboratório. Respeito máximo!";
    } else {
        mensagemEstilo = "Ótimo esforço. Continue praticando para subir de liga.";
    }

    document.getElementById("insignia-desc").innerText = 
        `${mensagemEstilo}\n\n` +
        `Pontos: ${pontosTotais} de ${pontosMaximosPossiveis}\n` +
        `Precisão: ${porcentagem.toFixed(1)}% | Dificuldade Média: ${mediaDif.toFixed(1)}`;

    document.getElementById("modal-resultado").style.display = "flex";
}

function fecharModalResultado() {
    document.getElementById("modal-resultado").style.display = "none";
    selecionarModo('livre');
}