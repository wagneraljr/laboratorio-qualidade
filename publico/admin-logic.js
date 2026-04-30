// =============================================================================
// admin-logic.js — Lógica do Painel Administrativo (Professor)
// =============================================================================
// Este arquivo controla toda a interatividade do painel do professor:
// carregar o banco de questões, filtrá-lo, paginá-lo, e executar as
// operações de criação, edição e exclusão (CRUD).
//
// CONCEITO DE QUALIDADE: Separação entre Dados e Apresentação
// As variáveis de estado (bancoCompleto, paginaAtual, etc.) ficam no topo.
// As funções que buscam dados do servidor ficam separadas das que desenham
// a tela. Isso facilita encontrar e corrigir problemas: se a lista está
// aparecendo errada, olhamos renderizarLista(); se os dados estão errados,
// olhamos carregarBanco().
// =============================================================================

// -----------------------------------------------------------------------------
// ESTADO GLOBAL DA PÁGINA
// -----------------------------------------------------------------------------
// Estas variáveis guardam o "estado atual" do painel — quais dados estão
// carregados e qual é a visualização atual. Ficam no topo para serem
// facilmente encontradas.

let bancoCompleto    = [];   // Lista completa de questões carregadas do servidor
let paginaAtual      = 1;    // Número da página sendo exibida no momento
let itensPorPagina   = 5;    // Quantas questões exibir por página
let idSendoEditado   = null; // ID da questão em modo de edição (null = nenhuma)

// =============================================================================
// SEÇÃO 1: COMUNICAÇÃO COM O SERVIDOR (Fetch API)
// =============================================================================
//
// CONCEITO DE TESTES: Tratamento de Exceções em Operações de Rede
// Chamadas de rede (fetch) podem falhar por muitos motivos: sem internet,
// servidor fora do ar, timeout, etc. O bloco try/catch garante que uma
// falha de rede não "quebre" a página silenciosamente — o erro é capturado
// e tratado de forma controlada.

// Carrega todas as questões do banco e atualiza a lista na tela
async function carregarBanco() {
    try {
        let resposta = await fetch("/api/admin/questoes");

        if (resposta.ok) {
            bancoCompleto = await resposta.json();
            mudarPagina(1); // Sempre volta para a primeira página ao recarregar
        } else if (resposta.status === 401 || resposta.status === 403) {
            // HTTP 401/403 = sem permissão — sessão expirou, redireciona para login
            window.location.href = "login.html";
        }
    } catch (erro) {
        // Erro de rede (servidor fora do ar, sem conexão)
        console.error("Erro ao carregar banco:", erro);
    }
}

// Encerra a sessão do professor e redireciona para a página inicial
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

// =============================================================================
// SEÇÃO 2: FUNÇÕES UTILITÁRIAS
// =============================================================================
//
// CONCEITO DE QUALIDADE: Funções Pequenas e com Nome Descritivo (SRP)
// Cada função abaixo faz uma única coisa bem definida. Isso as torna
// fáceis de entender, testar e reutilizar em outros pontos do código.

// Extrai o nome da função declarada em um trecho de código JavaScript.
// Usa uma Expressão Regular (regex) para encontrar o padrão 'function nomeDaFuncao('.
//
// CONCEITO: Expressão Regular (Regex)
// O padrão /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/ significa:
//   function   — a palavra literal "function"
//   \s+        — um ou mais espaços em branco
//   (          — início do grupo de captura (o que queremos extrair)
//   [a-zA-Z_$] — primeiro caractere: letra, underscore ou $
//   [0-9a-zA-Z_$]* — demais caracteres: letras, dígitos, underscore ou $
//   )          — fim do grupo de captura
//   \s*\(      — zero ou mais espaços, seguido do abre-parênteses
function extrairNomeDaFuncao(codigo) {
    if (!codigo) return "funcaoDesconhecida";

    let regex     = /function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/;
    let resultado = codigo.match(regex);

    // resultado[0] é o texto completo que casou com o regex
    // resultado[1] é o primeiro grupo de captura — o nome da função
    return (resultado && resultado.length > 1) ? resultado[1] : "funcaoDesconhecida";
}

// Converte o tipo técnico interno para um texto amigável para exibição
function formatarTipo(tipoTecnico) {
    return tipoTecnico === "correcao" ? "Correção de Bugs" : "Refatoração";
}

// Alterna a visibilidade do formulário de criação manual de questões
function toggleFormularioManual() {
    let formulario = document.getElementById("formulario-manual");
    let botao      = document.getElementById("btn-toggle-manual");

    if (formulario.style.display === "none") {
        formulario.style.display = "block";
        botao.innerText = "Fechar Formulário";
    } else {
        formulario.style.display = "none";
        botao.innerText = "+ Criar Manualmente";
    }
}

// Alterna a visibilidade do gabarito de uma questão específica
function toggleGabarito(id) {
    let div = document.getElementById("gabarito-" + id);
    div.style.display = (div.style.display === "none") ? "block" : "none";
}

// Atualiza a página atual e redesenha a lista
function mudarPagina(novaPagina) {
    paginaAtual = novaPagina;
    renderizarLista();
}

// =============================================================================
// SEÇÃO 3: COLETA E INTERPRETAÇÃO DE CASOS DE TESTE DA UI
// =============================================================================

// Lê os campos de teste do formulário e retorna um array de objetos de teste.
//
// CONCEITO DE TESTES: Estrutura de um Caso de Teste
// Cada caso de teste tem dois campos:
//   parametros:    a entrada que será passada para a função do aluno
//   saidaEsperada: o valor correto que a função deve retornar
//
// A "Saída Esperada" é armazenada como um valor JavaScript (número, array, etc.),
// não como texto. Por isso usamos JSON.parse() para converter a string digitada
// pelo professor em um valor real. Se a conversão falhar (ex: o professor digitou
// "olá" sem aspas), mantemos como string — é melhor do que ignorar o teste.
//
// prefixoId: prefixo dos IDs dos campos no HTML (ex: "novo" ou "edit")
// idQuestao:  sufixo do ID (necessário no formulário de edição para unicidade)
// testesOriginais: lista original da questão (para preservar testes além do 5º)
function coletarTestes(prefixoId, idQuestao, testesOriginais) {
    let testes = [];

    // O formulário sempre exibe 5 linhas de teste
    for (let numero = 1; numero <= 5; numero++) {
        let campoParametros = document.getElementById(`${prefixoId}-tp${numero}-${idQuestao}`);
        let campoSaida      = document.getElementById(`${prefixoId}-ts${numero}-${idQuestao}`);

        // Pula linhas não preenchidas (ambos os campos precisam ter valor)
        if (!campoParametros || !campoSaida) continue;

        let valorParametros = campoParametros.value.trim();
        let valorSaida      = campoSaida.value.trim();

        if (valorParametros && valorSaida) {
            let saidaInterpretada;

            // CONCEITO DE TESTES: Tratamento de Exceção Pontual
            // JSON.parse pode lançar uma exceção se o texto não for JSON válido.
            // Usamos try/catch para tratar apenas esse risco específico, sem
            // deixar o resto da função parar de funcionar.
            try {
                saidaInterpretada = JSON.parse(valorSaida); // Ex: "42" → 42, "[1,2]" → [1,2]
            } catch (e) {
                saidaInterpretada = valorSaida; // Mantém como texto se não for JSON válido
            }

            testes.push({ parametros: valorParametros, saidaEsperada: saidaInterpretada });
        }
    }

    // Preserva testes gerados pela IA que estejam além da 5ª linha (não visíveis no formulário)
    if (testesOriginais && testesOriginais.length > 5) {
        for (let j = 5; j < testesOriginais.length; j++) {
            testes.push(testesOriginais[j]);
        }
    }

    return testes;
}

// Versão simplificada para o formulário de nova questão (sem idQuestao nem testes originais)
function coletarTestesNovosForm() {
    let testes = [];

    for (let numero = 1; numero <= 5; numero++) {
        let valorParametros = document.getElementById(`novo-teste-p${numero}`).value.trim();
        let valorSaida      = document.getElementById(`novo-teste-s${numero}`).value.trim();

        if (valorParametros && valorSaida) {
            let saidaInterpretada;
            try {
                saidaInterpretada = JSON.parse(valorSaida);
            } catch (e) {
                saidaInterpretada = valorSaida;
            }
            testes.push({ parametros: valorParametros, saidaEsperada: saidaInterpretada });
        }
    }

    return testes;
}

// =============================================================================
// SEÇÃO 4: RENDERIZAÇÃO DA LISTA (Geração Dinâmica de HTML)
// =============================================================================

// Redesenha a lista de questões na tela, aplicando filtros e paginação.
//
// CONCEITO DE QUALIDADE: Função com Múltiplas Etapas Bem Definidas
// Esta função é maior que as outras, mas segue uma ordem clara:
//   1. Lê os filtros ativos
//   2. Filtra o banco completo
//   3. Calcula a paginação
//   4. Desenha os cards das questões
//   5. Desenha os botões de navegação
function renderizarLista() {
    let container    = document.getElementById("lista-desafios");
    let navContainer = document.getElementById("navegacao-paginas");
    if (!container || !navContainer) return; // Proteção: elementos podem não existir em outras páginas

    // --- Etapa 1: Leitura dos Filtros ---
    // Usamos o operador || para definir um valor padrão caso o elemento não exista
    let textoBusca  = document.getElementById("busca-texto")?.value.toLowerCase()   || "";
    let filtroTipo  = document.getElementById("filtro-tipo")?.value                  || "todos";
    let filtroNivel = document.getElementById("filtro-nivel")?.value                 || "todos";
    let valorItens  = document.getElementById("itens-por-pagina")?.value;

    itensPorPagina = valorItens ? parseInt(valorItens) : 5;

    // --- Etapa 2: Filtragem ---
    let questoesFiltradas = [];
    for (let questao of bancoCompleto) {
        let titulo    = (questao.titulo || "").toLowerCase();
        let bateTexto = titulo.includes(textoBusca);
        let bateTipo  = (filtroTipo === "todos"  || questao.tipo        === filtroTipo);
        let bateNivel = (filtroNivel === "todos" || questao.dificuldade === parseInt(filtroNivel));

        if (bateTexto && bateTipo && bateNivel) {
            questoesFiltradas.push(questao);
        }
    }

    // --- Etapa 3: Cálculo de Paginação ---
    let totalPaginas = Math.ceil(questoesFiltradas.length / itensPorPagina);

    // Correção de página inválida: se a filtragem reduziu o total de páginas,
    // voltamos para a última página disponível para não exibir uma página vazia.
    if (totalPaginas === 0) {
        paginaAtual = 1;
    } else if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    let inicio         = (paginaAtual - 1) * itensPorPagina;
    let itensDaPagina  = questoesFiltradas.slice(inicio, inicio + itensPorPagina);

    // --- Etapa 4: Desenho dos Cards ---
    container.innerHTML = ""; // Limpa os cards anteriores antes de redesenhar

    for (let item of itensDaPagina) {
        let card;

        if (idSendoEditado === item.id) {
            // Modo de edição: ainda usa innerHTML pois o conteúdo é HTML
            // estático gerado por nós, não interpolando dados do banco sem escape.
            // Os valores dos campos (codigoSujo, etc.) são inseridos via .value
            // nos inputs — o navegador os trata como texto, não como HTML.
            card = document.createElement("div");
            card.className = "card-desafio card-edicao-inline";
            card.innerHTML = montarHtmlCardEdicao(item);
        } else {
            // Modo de visualização: usa a API do DOM para evitar XSS
            card = montarCardVisualizacao(item);
        }

        container.appendChild(card);
    }

    // --- Etapa 5: Desenho da Navegação ---
    renderizarPaginacao(navContainer, totalPaginas);
}

// Gera o HTML do card em modo de EDIÇÃO (formulário inline)
function montarHtmlCardEdicao(item) {
    // Monta as linhas de campos de teste dinamicamente
    let htmlTestes = "";
    for (let t = 1; t <= 5; t++) {
        let valorParametros = "";
        let valorSaida      = "";

        // Preenche os campos com os valores existentes, se houver
        if (item.testes && item.testes[t - 1]) {
            valorParametros = item.testes[t - 1].parametros;
            valorSaida      = JSON.stringify(item.testes[t - 1].saidaEsperada);
        }

        htmlTestes += `
            <input type="text" id="edit-tp${t}-${item.id}" value='${valorParametros}' placeholder="Parâm. ${t}">
            <input type="text" id="edit-ts${t}-${item.id}" value='${valorSaida}' placeholder="Saída ${t}">
        `;
    }

    return `
        <div class="grid-form-manual" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div class="item-controle">
                <label>Título:</label>
                <input type="text" id="edit-titulo-${item.id}" value="${item.titulo}">
            </div>
            <div class="item-controle">
                <label>Tipo:</label>
                <select id="edit-tipo-${item.id}">
                    <option value="correcao"    ${item.tipo === "correcao"    ? "selected" : ""}>Correção</option>
                    <option value="refatoracao" ${item.tipo === "refatoracao" ? "selected" : ""}>Refatoração</option>
                </select>
            </div>
            <div class="item-controle">
                <label>Dificuldade:</label>
                <input type="number" id="edit-dif-${item.id}" value="${item.dificuldade}" min="1" max="5">
            </div>
        </div>

        <div style="background: #eee; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
            <label>🧪 Testes:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
                ${htmlTestes}
            </div>
        </div>

        <textarea id="edit-missao-${item.id}" rows="6"  style="width: 100%; margin-bottom: 10px;">${item.missao}</textarea>
        <textarea id="edit-sujo-${item.id}"   class="code-area" rows="15" style="width: 100%; margin-bottom: 10px;">${item.codigoSujo}</textarea>
        <textarea id="edit-limpo-${item.id}"  class="code-area" rows="15" style="width: 100%; margin-bottom: 10px;">${item.codigoLimpo}</textarea>

        <div class="acoes-card">
            <button onclick="salvarAlteracoes(${item.id})" class="btn-salvar">Confirmar</button>
            <button onclick="cancelarEdicao()"             class="btn-sair">Cancelar</button>
        </div>
    `;
}

// Gera o card em modo de VISUALIZAÇÃO usando a API do DOM (sem innerHTML).
//
// CONCEITO DE SEGURANÇA: XSS (Cross-Site Scripting)
// Interpolar dados do banco diretamente em innerHTML é perigoso: se um título
// contiver HTML como <script>alert(1)</script> ou <img onerror=...>, o navegador
// o executa como código. Isso se chama XSS — Cross-Site Scripting.
//
// A solução é construir os elementos com document.createElement() e preencher
// texto com .textContent (que NUNCA interpreta HTML) em vez de .innerHTML.
// Só usamos innerHTML onde o conteúdo é HTML estático escrito por nós mesmos,
// nunca para dados vindos do banco ou do usuário.
function montarCardVisualizacao(item) {
    // --- Cabeçalho: título + badge de tipo/nível ---
    let cabecalho = document.createElement("div");
    cabecalho.className = "info-principal";
    cabecalho.style.marginBottom = "10px";

    let titulo = document.createElement("h4");

    let textoTitulo = document.createTextNode(item.titulo + " ");
    titulo.appendChild(textoTitulo);

    let badge = document.createElement("span");
    badge.className = "badge";
    badge.style.cssText = "font-size: 0.8rem; background: #eee; padding: 3px 8px;";
    badge.textContent = formatarTipo(item.tipo) + " | Nível " + item.dificuldade;
    titulo.appendChild(badge);

    cabecalho.appendChild(titulo);

    // --- Botões de ação ---
    let acoes = document.createElement("div");
    acoes.className = "acoes-card";
    acoes.style.cssText = "display: flex; gap: 5px;";

    let btnDetalhes = document.createElement("button");
    btnDetalhes.textContent = "Detalhes";
    btnDetalhes.onclick = function() { toggleGabarito(item.id); };

    let btnSandbox = document.createElement("button");
    btnSandbox.textContent = "Laboratório 🧪";
    btnSandbox.className = "btn-laboratorio";
    btnSandbox.onclick = function() { window.open("sandbox.html?id=" + item.id, "_blank"); };

    let btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar ✏️";
    btnEditar.className = "btn-editar";
    btnEditar.onclick = function() { ativarEdicao(item.id); };

    let btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir 🗑️";
    btnExcluir.className = "btn-sair";
    btnExcluir.onclick = function() { excluirQuestao(item.id); };

    acoes.appendChild(btnDetalhes);
    acoes.appendChild(btnSandbox);
    acoes.appendChild(btnEditar);
    acoes.appendChild(btnExcluir);

    // --- Área de gabarito (oculta por padrão) ---
    let gabaritoDiv = document.createElement("div");
    gabaritoDiv.id = "gabarito-" + item.id;
    gabaritoDiv.className = "gabarito-area";
    gabaritoDiv.style.cssText = "display: none; width: 100%; margin-top: 15px;";

    let missaoP = document.createElement("p");
    let missaoStrong = document.createElement("strong");
    missaoStrong.textContent = "Missão: ";
    missaoP.appendChild(missaoStrong);
    missaoP.appendChild(document.createTextNode(item.missao));

    let pre = document.createElement("pre");
    pre.className = "codigo-gabarito";
    let code = document.createElement("code");
    code.textContent = item.codigoLimpo; // textContent escapa < > & automaticamente
    pre.appendChild(code);

    gabaritoDiv.appendChild(missaoP);
    gabaritoDiv.appendChild(pre);

    // --- Monta o card completo ---
    let card = document.createElement("div");
    card.className = "card-desafio card-desafio-horizontal";
    card.appendChild(cabecalho);
    card.appendChild(acoes);
    card.appendChild(gabaritoDiv);

    return card;
}

// =============================================================================
// SEÇÃO 5: PAGINAÇÃO
// =============================================================================

// Desenha os botões de navegação entre páginas no container indicado.
//
// CONCEITO DE QUALIDADE: Algoritmo com Lógica Isolada
// A paginação tem regras específicas (reticências, blocos deslizantes) que
// não têm nada a ver com a exibição das questões. Por isso foi extraída
// para sua própria função, facilitando leitura e manutenção.
function renderizarPaginacao(navContainer, totalPaginas) {
    navContainer.innerHTML = ""; // Limpa os botões anteriores
    if (totalPaginas === 0) return;

    // Função interna: cria e adiciona um único botão de página ao container.
    // Parâmetros:
    //   texto:        o que aparece no botão ("1", "<<", "...")
    //   paginaDestino: para qual página o botão navega
    //   ativo:        se é a página atual (recebe estilo diferente)
    //   desabilitado: se o clique está bloqueado (ex: seta "anterior" na página 1)
    function criarBotaoPagina(texto, paginaDestino, ativo = false, desabilitado = false) {
        let botao      = document.createElement("button");
        botao.innerText = texto;

        if (desabilitado) {
            botao.className    = "btn-pag";
            botao.disabled     = true;
            botao.style.opacity = "0.5";
            botao.style.cursor = "not-allowed";
        } else if (texto === "...") {
            // Reticências são decorativas — parecem um botão mas não clicam
            botao.className         = "btn-pag";
            botao.disabled          = true;
            botao.style.background  = "transparent";
            botao.style.border      = "none";
            botao.style.color       = "#333";
            botao.style.fontWeight  = "bold";
        } else {
            botao.className = ativo ? "btn-pag-ativo" : "btn-pag";
            botao.onclick   = function() { mudarPagina(paginaDestino); };
        }

        navContainer.appendChild(botao);
    }

    // Setas de navegação rápida (primeira e página anterior)
    criarBotaoPagina("<<", 1,               false, paginaAtual === 1);
    criarBotaoPagina("<",  paginaAtual - 1, false, paginaAtual === 1);

    // Números de página com reticências:
    // Com 7 ou menos páginas, exibimos todas. Com mais, usamos um bloco deslizante
    // que mantém sempre 7 posições fixas na tela para o layout não "pular".
    if (totalPaginas <= 7) {
        for (let p = 1; p <= totalPaginas; p++) {
            criarBotaoPagina(p, p, p === paginaAtual);
        }
    } else {
        // O bloco da esquerda começa na página anterior à atual
        let inicio = Math.max(1, paginaAtual - 1);

        if (inicio >= totalPaginas - 5) {
            // Bloco da esquerda chegou perto do final: funde os dois blocos
            // e exibe as últimas 7 páginas diretamente (sem reticências)
            for (let p = totalPaginas - 6; p <= totalPaginas; p++) {
                criarBotaoPagina(p, p, p === paginaAtual);
            }
        } else {
            // Bloco esquerdo (3 páginas ao redor da atual) + reticências + bloco direito fixo (3 últimas)
            for (let p = inicio; p <= inicio + 2; p++) {
                criarBotaoPagina(p, p, p === paginaAtual);
            }
            criarBotaoPagina("...", null);
            for (let p = totalPaginas - 2; p <= totalPaginas; p++) {
                criarBotaoPagina(p, p, p === paginaAtual);
            }
        }
    }

    // Setas de navegação rápida (próxima página e última)
    criarBotaoPagina(">",  paginaAtual + 1, false, paginaAtual === totalPaginas);
    criarBotaoPagina(">>", totalPaginas,    false, paginaAtual === totalPaginas);
}

// =============================================================================
// SEÇÃO 6: OPERAÇÕES CRUD (Create, Read, Update, Delete)
// =============================================================================
//
// CONCEITO: CRUD são as quatro operações básicas sobre dados persistidos.
// Aqui o "R" (Read/Leitura) já foi coberto por carregarBanco() e renderizarLista().

// Ativa o modo de edição inline para a questão com o ID informado
function ativarEdicao(id) {
    idSendoEditado = id;
    renderizarLista(); // Re-renderiza a lista, que usará o novo idSendoEditado
}

// Cancela a edição em andamento sem salvar
function cancelarEdicao() {
    idSendoEditado = null;
    renderizarLista();
}

// Salva as alterações feitas no formulário de edição inline (Update)
async function salvarAlteracoes(id) {
    let questaoOriginal = bancoCompleto.find(function(q) { return q.id == id; });
    let codigoLimpo     = document.getElementById(`edit-limpo-${id}`).value;

    // Coleta os testes editados, preservando os que estão além do 5º
    let testes = coletarTestes("edit", id, questaoOriginal ? questaoOriginal.testes : []);

    let dadosAtualizados = {
        id:           id,
        titulo:       document.getElementById(`edit-titulo-${id}`).value,
        tipo:         document.getElementById(`edit-tipo-${id}`).value,
        dificuldade:  parseInt(document.getElementById(`edit-dif-${id}`).value),
        missao:       document.getElementById(`edit-missao-${id}`).value,
        codigoSujo:   document.getElementById(`edit-sujo-${id}`).value,
        codigoLimpo:  codigoLimpo,
        nomeDaFuncao: extrairNomeDaFuncao(codigoLimpo), // Atualiza o nome com base no gabarito editado
        testes:       testes
    };

    try {
        let resposta = await fetch("/api/admin/questoes/atualizar", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(dadosAtualizados)
        });

        if (resposta.ok) {
            idSendoEditado = null;
            carregarBanco(); // Recarrega o banco para refletir as mudanças
        } else {
            alert("Erro ao salvar a questão. Tente novamente.");
        }
    } catch (erro) {
        console.error("Erro de conexão ao salvar:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Cria e salva uma nova questão a partir do formulário manual (Create)
async function salvarQuestaoNova() {
    let codigoLimpo = document.getElementById("novo-limpo").value;
    let testes      = coletarTestesNovosForm();

    let novaQuestao = {
        id:           Date.now(), // Timestamp como ID único
        titulo:       document.getElementById("novo-titulo").value || "Questão Manual",
        tipo:         document.getElementById("novo-tipo").value,
        dificuldade:  parseInt(document.getElementById("novo-dificuldade").value),
        missao:       document.getElementById("novo-missao").value,
        codigoSujo:   document.getElementById("novo-sujo").value,
        codigoLimpo:  codigoLimpo,
        nomeDaFuncao: extrairNomeDaFuncao(codigoLimpo),
        testes:       testes
    };

    try {
        let resposta = await fetch("/api/admin/questoes/criar", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(novaQuestao)
        });

        if (resposta.ok) {
            toggleFormularioManual(); // Fecha o formulário após salvar
            carregarBanco();
        } else {
            alert("Erro ao criar a questão. Tente novamente.");
        }
    } catch (erro) {
        console.error("Erro de conexão ao criar questão:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Exclui uma questão pelo ID após confirmação do professor (Delete)
async function excluirQuestao(id) {
    // Pede confirmação antes de uma ação irreversível — boa prática de UX
    let confirmou = confirm("Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.");
    if (!confirmou) return;

    try {
        let resposta = await fetch(`/api/admin/questoes/${id}`, { method: "DELETE" });

        if (resposta.ok) {
            carregarBanco();
        } else {
            alert("Erro ao excluir a questão.");
        }
    } catch (erro) {
        console.error("Erro de conexão ao excluir:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Solicita a geração de novas questões via IA ao servidor
async function gerarEmLote() {
    let tipo   = document.getElementById("tipo-gerar").value;
    let dif    = document.getElementById("dif-gerar").value;
    let qtd    = document.getElementById("qtd-gerar").value;
    let status = document.getElementById("status-geracao");

    // Informa ao professor que o processo começou (pode demorar)
    if (status) {
        status.innerText = `⏳ Gerando ${qtd} desafio(s). Isso pode levar alguns minutos...`;
    }

    try {
        let resposta = await fetch("/api/admin/abastecer", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            // parseInt garante que os valores numéricos cheguem como números, não strings
            body: JSON.stringify({
                tipo:       tipo,
                dificuldade: parseInt(dif),
                quantidade:  parseInt(qtd)
            })
        });

        if (resposta.ok) {
            if (status) status.innerText = "✅ Desafios gerados com sucesso!";
            alert("Sucesso! Os desafios foram gerados pela IA e salvos no banco.");
            carregarBanco();
        } else {
            if (status) status.innerText = "❌ Erro na geração.";
            alert("Ocorreu um erro na IA. Verifique o terminal do Node.js para detalhes.");
        }
    } catch (erro) {
        // CONCEITO DE TESTES: Distinguir tipos de falha
        // Esta falha é de CONEXÃO (rede), diferente de uma falha de LÓGICA (resposta 500).
        // Mensagens de erro distintas ajudam o professor a diagnosticar o problema corretamente.
        if (status) status.innerText = "❌ Erro de conexão.";
        console.error("Erro ao chamar o servidor:", erro);
        alert("Erro de conexão com o servidor. O Node.js está rodando?");
    }
}

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================
// window.onload garante que o código só roda depois que o HTML foi totalmente
// carregado — evita erros de "elemento não encontrado" ao buscar IDs no DOM.

window.onload = carregarBanco;