let bancoCompleto = [];
let paginaAtual = 1;
let itensPorPagina = 5;
let idSendoEditado = null;

// --- FUNÇÕES DE SESSÃO ---
async function fazerLogout() {
    try {
        let resposta = await fetch("/api/logout", { method: "POST" });
        if (resposta.ok) window.location.href = "index.html";
    } catch (erro) {
        console.error("Erro ao deslogar:", erro);
    }
}

// --- COMUNICAÇÃO COM O SERVIDOR ---
async function carregarBanco() {
    try {
        let resposta = await fetch("/api/admin/questoes");
        
        if (resposta.ok) {
            bancoCompleto = await resposta.json();
            mudarPagina(1); 
        } else if (resposta.status === 401 || resposta.status === 403) {
            // Se o servidor negar o acesso durante o uso, redireciona para login
            window.location.href = "login.html";
        }
    } catch (erro) {
        console.error("Erro ao carregar banco:", erro);
    }
}

// --- UTILITÁRIOS ---
function extrairNomeDaFuncao(codigo) {
    if (!codigo) return "funcaoDesconhecida";
    let regex = /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/;
    let resultado = codigo.match(regex);
    return (resultado && resultado.length > 1) ? resultado[1] : "funcaoDesconhecida";
}

function mudarPagina(novaPagina) {
    paginaAtual = novaPagina;
    renderizarLista();
}

function formatarTipo(tipoTecnico) {
    return tipoTecnico === 'correcao' ? 'Correção de Bugs' : 'Refatoração';
}

function toggleFormularioManual() {
    let form = document.getElementById("formulario-manual");
    let btn = document.getElementById("btn-toggle-manual");
    if (form.style.display === "none") {
        form.style.display = "block";
        btn.innerText = "Fechar Formulário";
    } else {
        form.style.display = "none";
        btn.innerText = "+ Criar Manualmente";
    }
}

function toggleGabarito(id) {
    let div = document.getElementById("gabarito-" + id);
    div.style.display = (div.style.display === "none") ? "block" : "none";
}

// --- RENDERIZAÇÃO E EDIÇÃO INLINE ---
function renderizarLista() {
    let container = document.getElementById("lista-desafios");
    let navContainer = document.getElementById("navegacao-paginas");
    if (!container || !navContainer) return;

    // 1. Captura os valores dos três filtros
    let texto = document.getElementById("busca-texto").value.toLowerCase();
    let tipo = document.getElementById("filtro-tipo").value;
    let nivel = document.getElementById("filtro-nivel").value; // <-- Captura o novo filtro
    
    itensPorPagina = parseInt(document.getElementById("itens-por-pagina").value);

    // 2. Aplica a filtragem combinada
    let filtrados = [];
    for (let i = 0; i < bancoCompleto.length; i++) {
        let item = bancoCompleto[i];
        
        let bateTexto = (item.titulo || "").toLowerCase().includes(texto);
        let bateTipo = tipo === "todos" || item.tipo === tipo;
        
        // Verifica se o nível bate. O valor do HTML vem como texto ("1"), então convertemos para número.
        let bateNivel = nivel === "todos" || item.dificuldade === parseInt(nivel);

        // A questão só entra na lista se passar pelos TRÊS filtros ao mesmo tempo
        if (bateTexto && bateTipo && bateNivel) {
            filtrados.push(item);
        }
    }

    // 3. Lógica de Paginação (Mantida exatamente igual)
    let totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPaginas && totalPaginas > 0) paginaAtual = totalPaginas;
    if (totalPaginas === 0) paginaAtual = 1;

    let inicio = (paginaAtual - 1) * itensPorPagina;
    let itensDaPagina = filtrados.slice(inicio, inicio + itensPorPagina);

    container.innerHTML = "";

    // 4. Desenho dos Cards na tela (Mantido exatamente igual)
    for (let i = 0; i < itensDaPagina.length; i++) {
        let item = itensDaPagina[i];
        let card = document.createElement("div");

        if (idSendoEditado == item.id) {
            card.className = "card-desafio card-edicao-inline";
            
            let htmlTestes = "";
            for (let t = 1; t <= 5; t++) {
                let p_val = (item.testes && item.testes[t-1]) ? item.testes[t-1].parametros : "";
                let s_val = (item.testes && item.testes[t-1]) ? JSON.stringify(item.testes[t-1].saidaEsperada) : "";
                htmlTestes += `
                    <input type="text" id="edit-tp${t}-${item.id}" value='${p_val}' placeholder="Parâm. ${t}">
                    <input type="text" id="edit-ts${t}-${item.id}" value='${s_val}' placeholder="Saída ${t}">
                `;
            }

            card.innerHTML = `
                <div class="grid-form-manual" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <div class="item-controle"><label>Título:</label><input type="text" id="edit-titulo-${item.id}" value="${item.titulo}"></div>
                    <div class="item-controle"><label>Tipo:</label>
                        <select id="edit-tipo-${item.id}">
                            <option value="correcao" ${item.tipo==='correcao'?'selected':''}>Correção</option>
                            <option value="refatoracao" ${item.tipo==='refatoracao'?'selected':''}>Refatoração</option>
                        </select>
                    </div>
                    <div class="item-controle"><label>Dificuldade:</label><input type="number" id="edit-dif-${item.id}" value="${item.dificuldade}" min="1" max="5"></div>
                </div>
                
                <div style="background: #eee; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                    <label>🧪 Testes (Editando os 5 primeiros):</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
                        ${htmlTestes}
                    </div>
                </div>

                <textarea id="edit-missao-${item.id}" rows="6" style="width: 100%; margin-bottom: 10px;">${item.missao}</textarea>
                <textarea id="edit-sujo-${item.id}" class="code-area" rows="15" style="width: 100%; margin-bottom: 10px;">${item.codigoSujo}</textarea>
                <textarea id="edit-limpo-${item.id}" class="code-area" rows="15" style="width: 100%; margin-bottom: 10px;">${item.codigoLimpo}</textarea>
                
                <div class="acoes-card">
                    <button onclick="salvarAlteracoes(${item.id})" class="btn-salvar">Confirmar</button>
                    <button onclick="cancelarEdicao()" class="btn-sair">Cancelar</button>
                </div>
            `;
        } else {
            card.className = "card-desafio card-desafio-horizontal";
            card.innerHTML = `
                <div class="info-principal" style="margin-bottom: 10px;">
                    <h4>${item.titulo} <span class="badge" style="font-size: 0.8rem; background: #eee; padding: 3px 8px;">${formatarTipo(item.tipo)} | Nível ${item.dificuldade}</span></h4>
                </div>
                <div class="acoes-card" style="display: flex; gap: 5px;">
                    <button onclick="toggleGabarito('${item.id}')">Detalhes</button>
                    <button onclick="window.open('sandbox.html?id=${item.id}', '_blank')" class="btn-salvar" style="background-color: #f39c12;">🧪 Laboratório</button>
                    <button onclick="ativarEdicao(${item.id})" class="btn-modo-aluno">Editar ✏️</button>
                    <button onclick="excluirQuestao(${item.id})" class="btn-sair">Excluir 🗑️</button>
                </div>
                <div id="gabarito-${item.id}" class="gabarito-area" style="display:none; width: 100%; margin-top: 15px;">
                    <p><strong>Missão:</strong> ${item.missao}</p>
                    <pre class="codigo-gabarito"><code>${item.codigoLimpo}</code></pre>
                </div>
            `;
        }
        container.appendChild(card);
    }

    navContainer.innerHTML = "";
    for (let p = 1; p <= totalPaginas; p++) {
        let btn = document.createElement("button");
        btn.innerText = p;
        btn.className = (p === paginaAtual) ? "btn-pag-ativo" : "btn-pag";
        btn.onclick = function() { mudarPagina(p); };
        navContainer.appendChild(btn);
    }
}

// --- OPERAÇÕES CRUD ---
function ativarEdicao(id) { idSendoEditado = id; renderizarLista(); }
function cancelarEdicao() { idSendoEditado = null; renderizarLista(); }

async function salvarAlteracoes(id) {
    let questaoOriginal = bancoCompleto.find(q => q.id == id);
    let codigoLimpo = document.getElementById(`edit-limpo-${id}`).value;
    
    // Coleta os 5 testes da UI
    let novosTestes = [];
    for (let t = 1; t <= 5; t++) {
        let p = document.getElementById(`edit-tp${t}-${id}`).value;
        let s = document.getElementById(`edit-ts${t}-${id}`).value;
        if (p && s) {
            try { 
                novosTestes.push({ parametros: p, saidaEsperada: JSON.parse(s) }); 
            } catch(e) { 
                novosTestes.push({ parametros: p, saidaEsperada: s }); 
            }
        }
    }

    // Se a questão original tinha mais de 5 testes (IA), preservamos os excedentes
    if (questaoOriginal.testes && questaoOriginal.testes.length > 5) {
        for (let j = 5; j < questaoOriginal.testes.length; j++) {
            novosTestes.push(questaoOriginal.testes[j]);
        }
    }

    let dados = {
        id: id,
        titulo: document.getElementById(`edit-titulo-${id}`).value,
        tipo: document.getElementById(`edit-tipo-${id}`).value,
        dificuldade: parseInt(document.getElementById(`edit-dif-${id}`).value),
        missao: document.getElementById(`edit-missao-${id}`).value,
        codigoSujo: document.getElementById(`edit-sujo-${id}`).value,
        codigoLimpo: codigoLimpo,
        nomeDaFuncao: extrairNomeDaFuncao(codigoLimpo),
        testes: novosTestes
    };

    let resposta = await fetch("/api/admin/questoes/atualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });

    if (resposta.ok) { idSendoEditado = null; carregarBanco(); }
}

async function salvarQuestaoNova() {
    let codigoLimpo = document.getElementById("novo-limpo").value;
    let testes = [];
    
    for (let t = 1; t <= 5; t++) {
        let p = document.getElementById(`novo-teste-p${t}`).value;
        let s = document.getElementById(`novo-teste-s${t}`).value;
        if (p && s) {
            try { 
                testes.push({ parametros: p, saidaEsperada: JSON.parse(s) }); 
            } catch(e) { 
                testes.push({ parametros: p, saidaEsperada: s }); 
            }
        }
    }

    let dados = {
        id: Date.now(),
        titulo: document.getElementById("novo-titulo").value || "Questão Manual",
        tipo: document.getElementById("novo-tipo").value,
        dificuldade: parseInt(document.getElementById("novo-dificuldade").value),
        missao: document.getElementById("novo-missao").value,
        codigoSujo: document.getElementById("novo-sujo").value,
        codigoLimpo: codigoLimpo,
        nomeDaFuncao: extrairNomeDaFuncao(codigoLimpo),
        testes: testes
    };

    let resposta = await fetch("/api/admin/questoes/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });

    if (resposta.ok) { toggleFormularioManual(); carregarBanco(); }
}

async function gerarEmLote() {
    let tipo = document.getElementById("tipo-gerar").value;
    let dif = document.getElementById("dif-gerar").value;
    let qtd = document.getElementById("qtd-gerar").value;
    let status = document.getElementById("status-geracao");

    // BLINDAGEM: Verifica se a tag existe antes de tentar mudar o texto
    if (status !== null) {
        status.innerText = "⏳ Gerando " + qtd + " desafio(s). Isso pode levar um minuto...";
    } else {
        // Se a tag não existir, avisa por popup para não travar o código
        console.log("Iniciando geração via IA...");
    }

    try {
        let resposta = await fetch("/api/admin/abastecer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Garante que os números vão como inteiros para o Node.js
            body: JSON.stringify({ 
                tipo: tipo, 
                dificuldade: parseInt(dif), 
                quantidade: parseInt(qtd) 
            })
        });

        if (resposta.ok) {
            if (status !== null) {
                status.innerText = "✅ Desafios gerados com sucesso!";
            }
            alert("Sucesso! Os desafios foram gerados pela IA e salvos no banco.");
            carregarBanco();
        } else {
            if (status !== null) status.innerText = "❌ Erro na geração.";
            alert("Ocorreu um erro na IA. Verifique o terminal do Node.js.");
        }
    } catch (erro) {
        if (status !== null) status.innerText = "❌ Erro de conexão.";
        console.error("Erro ao chamar o servidor:", erro);
        alert("Erro de conexão com o servidor. O Node.js está rodando?");
    }
}

window.onload = carregarBanco;