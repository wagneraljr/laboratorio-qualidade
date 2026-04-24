let questaoAtual = null;
let cmSujo, cmLimpo;

async function carregarQuestao() {
    // Pega o ID da URL (ex: sandbox.html?id=1710000)
    let urlParams = new URLSearchParams(window.location.search);
    let id = urlParams.get('id');

    if (!id) {
        alert("ID da questão não encontrado.");
        return;
    }

    try {
        let resposta = await fetch("/api/admin/questoes");
        let banco = await resposta.json();
        
        questaoAtual = banco.find(q => q.id == id);
        
        if (questaoAtual) {
            document.getElementById("titulo-questao").innerText = `Calibrando: ${questaoAtual.titulo}`;
            document.getElementById("missao-texto").innerText = questaoAtual.missao;
            inicializarEditores();
        } else {
            document.getElementById("titulo-questao").innerText = "Questão não encontrada.";
        }
    } catch (erro) {
        console.error("Erro ao carregar banco:", erro);
    }
}

function inicializarEditores() {
    cmSujo = CodeMirror.fromTextArea(document.getElementById("editor-sujo"), {
        lineNumbers: true,
        mode: "javascript",
        theme: "dracula"
    });
    cmSujo.setValue(questaoAtual.codigoSujo);

    cmLimpo = CodeMirror.fromTextArea(document.getElementById("editor-limpo"), {
        lineNumbers: true,
        mode: "javascript",
        theme: "dracula"
    });
    cmLimpo.setValue(questaoAtual.codigoLimpo);
}

async function testarCodigo(lado) {
    let codigoTexto = lado === 'sujo' ? cmSujo.getValue() : cmLimpo.getValue();
    let terminal = document.getElementById(lado === 'sujo' ? 'terminal-sujo' : 'terminal-limpo');
    
    terminal.innerText = "Executando testes...";
    terminal.classList.remove("erro");

    let forcarAST = (lado === 'limpo' && questaoAtual.tipo === 'refatoracao');

    let payload = {
        codigo: codigoTexto,
        nomeDaFuncao: questaoAtual.nomeDaFuncao,
        testes: questaoAtual.testes,
        forcarAvaliacaoAST: forcarAST,
        codigoSujoOriginal: questaoAtual.codigoSujo
    };

    try {
        let resposta = await fetch("/api/admin/sandbox/testar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        let resultado = await resposta.json();

        if (resultado.sucesso) {
            // MENSAGEM DE SUCESSO DETALHADA COM PARÂMETROS
            let log = `✅ SUCESSO ABSOLUTO! (${resultado.totalTestes}/${resultado.totalTestes})\n\nCasos Validados:\n`;
            for (let i = 0; i < questaoAtual.testes.length; i++) {
                let t = questaoAtual.testes[i];
                log += `[Teste ${i + 1}] 📥 Entrada: (${t.parametros}) ➡️ 📤 Saída: ${JSON.stringify(t.saidaEsperada)}\n`;
            }
            terminal.innerText = log;
        } else {
            terminal.classList.add("erro");
            terminal.innerText = `❌ FALHA (${resultado.totalAcertos}/${resultado.totalTestes} acertos):\n\n` + resultado.erros.join("\n\n");
        }
    } catch (erro) {
        terminal.classList.add("erro");
        terminal.innerText = "Erro de conexão com o servidor de avaliação.";
    }
}

async function salvarAlteracoesSandbox() {
    // Atualiza o objeto com os códigos que estão nos editores
    questaoAtual.codigoSujo = cmSujo.getValue();
    questaoAtual.codigoLimpo = cmLimpo.getValue();

    try {
        let resposta = await fetch("/api/admin/questoes/atualizar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(questaoAtual)
        });

        if (resposta.ok) {
            alert("Questão atualizada com sucesso no banco de dados!");
        } else {
            alert("Erro ao salvar a questão no servidor.");
        }
    } catch (erro) {
        console.error("Falha ao salvar:", erro);
    }
}

window.onload = carregarQuestao;