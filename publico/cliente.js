// ==========================================
// 1. VARIÁVEIS GLOBAIS E ESTADO DO JOGO
// ==========================================
let editor;

let estadoDoJogo = {
    xp: 0,
    energia: 5
};

let idMissaoAtual = null;

// ==========================================
// 2. FUNÇÕES DE GAMIFICAÇÃO (UI)
// ==========================================
function atualizarPainel() {
    let elementoEnergia = document.getElementById("energia");
    // Se você tiver adicionado um id="barra-xp" no HTML, ele atualiza aqui:
    let elementoXp = document.getElementById("barra-xp"); 
    
    if (elementoEnergia !== null) {
        elementoEnergia.innerText = estadoDoJogo.energia;
    }
    
    if (elementoXp !== null) {
        elementoXp.innerText = estadoDoJogo.xp + " XP";
    }
}

function gastarEnergia() {
    if (estadoDoJogo.energia > 0) {
        estadoDoJogo.energia = estadoDoJogo.energia - 1;
        atualizarPainel();
        return true;
    } else {
        alert("Sem energia! Tente revisar seu código visualmente.");
        return false;
    }
}

// ==========================================
// 3. COMUNICAÇÃO COM O SERVIDOR (BUSCAR E AVALIAR)
// ==========================================
async function buscarMissaoDoEstoque() {
    let tipoEscolhido = document.getElementById("tipo-aluno").value;
    let difEscolhida = document.getElementById("dif-aluno").value;
    
    let configuracaoRequisicao = {
        method: "POST",
        headers: { 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
            tipo: tipoEscolhido, 
            dificuldade: difEscolhida 
        })
    };
    
    try {
        let resposta = await fetch("/api/missao-aleatoria", configuracaoRequisicao);
        
        if (resposta.ok === true) {
            let resultado = await resposta.json();

            idMissaoAtual = resultado.dados.id; // Guarda o ID da missão atual para avaliação futura
            
            // Atualiza a tela com o desafio encontrado
            document.getElementById("titulo-missao").innerText = resultado.dados.titulo;
            document.getElementById("descricao-missao").innerText = resultado.dados.missao;
            editor.setValue(resultado.dados.codigoSujo);
        } else {
            alert("Não há desafios disponíveis para essa combinação. Tente outra ou avise o professor.");
        }
    } catch (erro) {
        console.error("Erro na rede ao buscar a missão.", erro);
    }
}

async function submeterCodigo() {
    let podeRodar = gastarEnergia();
    
    if (podeRodar === false) {
        return; // Interrompe se o aluno não tiver energia
    }

    if (idMissaoAtual === null) {
        alert("Você precisa buscar uma missão primeiro!");
        return;
    }

    let codigoDoAluno = editor.getValue();
    
    let configuracaoRequisicao = {
        method: "POST",
        headers: { 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ codigo: codigoDoAluno, idQuestao: idMissaoAtual })
    };
    
    try {
        let resposta = await fetch("/api/avaliar", configuracaoRequisicao);
        let dados = await resposta.json();
        
        if (dados.sucesso === true) {
            // Recompensa o aluno
            estadoDoJogo.xp = estadoDoJogo.xp + 100;
            atualizarPainel();
            alert("Sucesso! Você passou em " + dados.totalAcertos + " de " + dados.totalTestes + " testes.");
        } else {
            // Mostra o primeiro erro encontrado para ajudar o aluno
            alert("Ainda existem falhas.\nErro: " + dados.erros[0]);
        }
    } catch (erro) {
        console.error("Erro ao enviar o código para avaliação.", erro);
    }
}

// ==========================================
// 4. INICIALIZAÇÃO DO SISTEMA
// ==========================================
function inicializarJogo() {
    // Liga o CodeMirror na área de texto
    let areaDeTexto = document.getElementById("editor-aluno");
    
    editor = CodeMirror.fromTextArea(areaDeTexto, {
        lineNumbers: true,
        mode: "javascript",
        theme: "dracula",
        indentUnit: 4
    });
    
    // Conecta os botões do HTML com as funções do JavaScript
    let botaoPedir = document.getElementById("btn-pedir-estoque");
    if (botaoPedir !== null) {
        botaoPedir.addEventListener("click", buscarMissaoDoEstoque);
    }

    let botaoAvaliar = document.getElementById("btn-avaliar");
    if (botaoAvaliar !== null) {
        botaoAvaliar.addEventListener("click", submeterCodigo);
    }

    // Atualiza a tela inicial
    atualizarPainel();
}

// Quando a página terminar de carregar, executa a inicialização
window.onload = inicializarJogo;