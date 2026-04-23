let bancoCompleto = [];

// --- FUNÇÕES DE NAVEGAÇÃO E LOGOUT ---

async function fazerLogout() {
    try {
        let resposta = await fetch("/api/logout", { method: "POST" });
        if (resposta.ok) {
            window.location.href = "index.html";
        }
    } catch (erro) {
        console.error("Erro ao deslogar:", erro);
    }
}

// --- FUNÇÕES DE GERAÇÃO EM LOTE ---

async function gerarEmLote() {
    let tipo = document.getElementById("tipo-gerar").value;
    let dif = document.getElementById("dif-gerar").value;
    let qtd = document.getElementById("qtd-gerar").value;
    
    let elementoStatus = document.getElementById("status-geracao");
    elementoStatus.innerText = "IA processando... Isso pode levar alguns segundos.";

    let configuracao = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipo, dificuldade: dif, quantidade: qtd })
    };

    try {
        let resposta = await fetch("/api/admin/abastecer", configuracao);
        let dados = await resposta.json();

        if (dados.sucesso === true) {
            elementoStatus.innerText = "Sucesso! " + dados.quantidade + " novos desafios no banco.";
            carregarBanco(); // Atualiza a lista visual
        } else {
            elementoStatus.innerText = "Erro na geração: " + (dados.erro || "Verifique o console.");
        }
    } catch (erro) {
        elementoStatus.innerText = "Erro de conexão com o servidor.";
    }
}

// --- FUNÇÕES DE VISUALIZAÇÃO ---

async function carregarBanco() {
    try {
        let resposta = await fetch("/api/admin/questoes");
        if (resposta.ok) {
            bancoCompleto = await resposta.json();
            renderizarLista(bancoCompleto);
        }
    } catch (erro) {
        console.error("Erro ao carregar banco:", erro);
    }
}

function renderizarLista(lista) {
    let container = document.getElementById("lista-desafios");
    if (!container) return;
    
    container.innerHTML = "";

    for (let item of lista) {
        let card = document.createElement("div");
        card.className = "card-desafio";
        card.innerHTML = `
            <h4>${item.titulo} (Nível ${item.dificuldade})</h4>
            <p><strong>Tipo:</strong> ${item.tipo}</p>
            <div class="acoes-card">
                <button onclick="toggleGabarito('${item.id}')">Ver Detalhes</button>
                <button onclick="excluirQuestao('${item.id}')" class="btn-sair" style="padding: 5px 10px; font-size: 0.8rem;">Excluir 🗑️</button>
            </div>
            <div id="gabarito-${item.id}" class="gabarito-area" style="display:none; background: #2d2d2d; padding: 10px; margin-top: 10px; border-radius: 4px;">
                <p><strong>Missão:</strong> ${item.missao}</p>
                <h5>Código Inicial:</h5>
                <pre><code>${item.codigoSujo}</code></pre>
                <h5>Gabarito (Código Limpo):</h5>
                <pre class="codigo-gabarito"><code>${item.codigoLimpo}</code></pre>
            </div>
        `;
        container.appendChild(card);
    }
}

function toggleGabarito(id) {
    let div = document.getElementById("gabarito-" + id);
    div.style.display = (div.style.display === "none") ? "block" : "none";
}

async function excluirQuestao(id) {
    if (!confirm("Tem certeza que deseja excluir esta questão permanentemente?")) {
        return;
    }

    try {
        let resposta = await fetch("/api/admin/questoes/" + id, { method: "DELETE" });
        if (resposta.ok) {
            carregarBanco(); // Atualiza a lista na tela
        }
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
    }
}

// Inicialização
window.onload = function() {
    carregarBanco();
    
    // Vincula o botão de logout se ele existir
    let btnSair = document.querySelector(".btn-sair"); 
    if (btnSair) {
        btnSair.onclick = fazerLogout;
    }
};

