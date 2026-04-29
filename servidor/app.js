// =============================================================================
// app.js — Servidor Principal da Plataforma
// =============================================================================
// Este arquivo é o "coração" do back-end. Ele usa o Express, um framework
// que facilita a criação de servidores web em Node.js.
//
// CONCEITO DE QUALIDADE: Separação de Responsabilidades (SRP)
// Cada parte deste arquivo tem uma responsabilidade bem definida:
//   1. Configuração do servidor
//   2. Autenticação (quem pode entrar)
//   3. Rotas do Aluno (o que o aluno pode fazer)
//   4. Rotas do Professor (o que o professor pode fazer)
// =============================================================================

const express      = require("express");
const path         = require("path");
const fs           = require("fs");
const cookieParser = require("cookie-parser");
const geradorIA    = require("./geradorIA");
const avaliador    = require("./avaliadorCodigo");

const app = express();

// -----------------------------------------------------------------------------
// SEÇÃO 1: CONFIGURAÇÃO DO SERVIDOR
// -----------------------------------------------------------------------------

// Permite que o servidor leia o corpo das requisições no formato JSON
app.use(express.json());

// O segredo SESSION_SECRET é lido do arquivo .env e usado para assinar
// o cookie de autenticação, impedindo que alguém o falsifique no navegador.
const segredoSessao = process.env.SESSION_SECRET;
if (!segredoSessao) {
    // CONCEITO DE QUALIDADE: Falha Rápida (Fail Fast)
    // Se uma configuração crítica está ausente, é melhor parar imediatamente
    // com uma mensagem clara do que deixar o sistema rodar de forma insegura.
    console.error("ERRO CRÍTICO: SESSION_SECRET não definido no arquivo .env");
    process.exit(1);
}
app.use(cookieParser(segredoSessao));

// Define os caminhos importantes do sistema de forma portável entre sistemas operacionais
const caminhoPublico = path.join(__dirname, "..", "publico");
const caminhoBanco   = path.join(__dirname, "bancoQuestoes.json");

// Serve os arquivos HTML, CSS e JS da pasta "publico" automaticamente
app.use(express.static(caminhoPublico));

// -----------------------------------------------------------------------------
// SEÇÃO 2: FUNÇÕES AUXILIARES (Acesso ao Banco de Dados)
// -----------------------------------------------------------------------------

// Lê e retorna o banco de questões do disco.
//
// CONCEITO DE TESTES: Isolamento de Pontos de Falha
// A leitura de arquivos é uma operação de I/O (Input/Output) que PODE falhar
// por razões externas: arquivo corrompido, falta de permissão, disco cheio.
// Ao isolar esse acesso numa função própria com try/catch, centralizamos o
// tratamento de erro em um único lugar. Isso também facilita escrever testes
// automatizados: podemos substituir esta função por uma versão falsa ("mock")
// que retorna dados fixos, sem precisar de um arquivo real no disco.
function lerBanco() {
    try {
        let conteudo = fs.readFileSync(caminhoBanco, "utf8");
        return JSON.parse(conteudo);
    } catch (erro) {
        // Relançamos o erro com uma mensagem mais descritiva para facilitar
        // o diagnóstico quando algo der errado em produção.
        throw new Error("Não foi possível ler o banco de questões: " + erro.message);
    }
}

// Salva a lista de questões no disco.
//
// CONCEITO DE TESTES: Mesmo princípio — toda escrita em disco pode falhar
// e precisa ser tratada explicitamente.
function salvarBanco(lista) {
    try {
        // JSON.stringify com (null, 2) formata o arquivo com indentação de 2 espaços,
        // deixando-o legível para humanos caso precisem inspecionar manualmente.
        fs.writeFileSync(caminhoBanco, JSON.stringify(lista, null, 2));
    } catch (erro) {
        throw new Error("Não foi possível salvar o banco de questões: " + erro.message);
    }
}

// Cria uma pausa assíncrona (usada na geração em lote para respeitar o rate limit da IA)
function atraso(milissegundos) {
    return new Promise(function(resolucao) {
        setTimeout(resolucao, milissegundos);
    });
}

// -----------------------------------------------------------------------------
// SEÇÃO 3: MIDDLEWARE DE AUTENTICAÇÃO
// -----------------------------------------------------------------------------

// CONCEITO DE QUALIDADE: Middleware
// Um middleware é uma função que "intercepta" a requisição ANTES de ela
// chegar à rota final. Ao declarar verificarAutenticacao uma única vez e
// aplicá-lo nas rotas do professor, garantimos que a proteção nunca seja
// esquecida em nenhuma rota — sem duplicar código.
//
// Fluxo:  Requisição → verificarAutenticacao → Rota do Professor
//                              ↓ (se não autenticado)
//                        Redireciona para login
function verificarAutenticacao(requisicao, resposta, proximo) {
    // req.signedCookies só contém o valor correto se a assinatura criptográfica
    // bater com o SESSION_SECRET. Se alguém criar o cookie manualmente no
    // navegador sem conhecer o segredo, o valor aqui será false — acesso negado.
    let token = requisicao.signedCookies.auth_token;

    if (token === "logado") {
        return proximo(); // Autorizado: continua para a rota protegida
    } else {
        resposta.redirect("/login.html"); // Não autorizado: volta para o login
    }
}

// -----------------------------------------------------------------------------
// SEÇÃO 4: ROTAS DE AUTENTICAÇÃO
// -----------------------------------------------------------------------------

// Rota de Login — verifica a senha e cria o cookie de sessão
app.post("/api/login", function(requisicao, resposta) {
    let senhaDigitada = requisicao.body.senha;
    let senhaCorreta  = process.env.ADMIN_PASSWORD;

    if (senhaDigitada === senhaCorreta) {
        // Cria o cookie com quatro proteções de segurança combinadas:
        //   httpOnly: JavaScript do navegador não consegue ler o cookie (protege contra XSS)
        //   secure:   cookie só trafega em HTTPS, nunca em HTTP puro
        //   sameSite: impede que outros sites enviem o cookie em nome do usuário (protege contra CSRF)
        //   signed:   o valor é assinado com SESSION_SECRET, impossível de falsificar
        resposta.cookie("auth_token", "logado", {
            maxAge:   3600000, // Expira em 1 hora (valor em milissegundos)
            httpOnly: true,
            secure:   true,
            sameSite: "strict",
            signed:   true
        });
        resposta.json({ sucesso: true });
    } else {
        // HTTP 401 = "Não Autorizado" — código padrão para credenciais inválidas
        resposta.status(401).json({ sucesso: false, erro: "Senha incorreta" });
    }
});

// Rota de Logout — remove o cookie de sessão
app.post("/api/logout", function(requisicao, resposta) {
    resposta.clearCookie("auth_token");
    resposta.json({ sucesso: true });
});

// -----------------------------------------------------------------------------
// SEÇÃO 5: ROTAS DO ALUNO (públicas — sem autenticação)
// -----------------------------------------------------------------------------

// Rota: sortear uma questão por tipo e dificuldade (Modo Livre)
app.post("/api/missao-aleatoria", function(requisicao, resposta) {
    let tipoDesejado        = requisicao.body.tipo;
    let dificuldadeDesejada = parseInt(requisicao.body.dificuldade);

    // CONCEITO DE TESTES: Tratamento de Exceção em Ponto de I/O
    // Usamos try/catch aqui porque lerBanco() acessa o disco — uma operação
    // que pode falhar. Se falhar, retornamos HTTP 500 com mensagem clara
    // em vez de deixar o servidor travar com um erro não tratado.
    let listaDeQuestoes;
    try {
        listaDeQuestoes = lerBanco();
    } catch (erro) {
        return resposta.status(500).json({ sucesso: false, erro: erro.message });
    }

    // Filtra as questões que atendem ao perfil solicitado pelo aluno
    let questoesFiltradas = [];
    for (let questao of listaDeQuestoes) {
        if (questao.tipo === tipoDesejado && questao.dificuldade === dificuldadeDesejada) {
            questoesFiltradas.push(questao);
        }
    }

    if (questoesFiltradas.length === 0) {
        // HTTP 404 = "Não Encontrado"
        return resposta.status(404).json({ sucesso: false, erro: "Nenhuma missão com este perfil no estoque." });
    }

    // Sorteia um índice aleatório dentro da lista filtrada
    let indice  = Math.floor(Math.random() * questoesFiltradas.length);
    let questao = questoesFiltradas[indice];

    // SEGURANÇA: enviamos apenas os campos que o aluno precisa ver.
    // O nomeDaFuncao é omitido para não facilitar trapaças via console do navegador.
    let dadosParaAluno = {
        id:          questao.id,
        titulo:      questao.titulo,
        missao:      questao.missao,
        tipo:        questao.tipo,
        dificuldade: questao.dificuldade,
        codigoSujo:  questao.codigoSujo,
        codigoLimpo: questao.codigoLimpo  // Liberado no modo livre (botão "Ver Gabarito")
    };

    resposta.json({ sucesso: true, dados: dadosParaAluno });
});

// Rota: avaliar o código enviado pelo aluno
app.post("/api/avaliar", function(requisicao, resposta) {
    let codigoDoAluno = requisicao.body.codigo;
    let idDaQuestao   = requisicao.body.idQuestao;

    let listaDeQuestoes;
    try {
        listaDeQuestoes = lerBanco();
    } catch (erro) {
        return resposta.status(500).json({ sucesso: false, erros: [erro.message] });
    }

    // Percorre a lista para encontrar a questão pelo ID
    let questaoAtual = null;
    for (let questao of listaDeQuestoes) {
        if (questao.id === idDaQuestao) {
            questaoAtual = questao;
            break; // Encontrou: não precisa continuar percorrendo
        }
    }

    if (questaoAtual === null) {
        return resposta.status(404).json({ sucesso: false, erros: ["Questão não encontrada no sistema."] });
    }

    // Para questões de refatoração, passamos o código original ao avaliador
    // para que ele compare as variáveis e detecte se o aluno realmente refatorou.
    // Para questões de correção, este valor fica null e a análise estrutural é ignorada.
    let codigoOriginalParaAST = null;
    if (questaoAtual.tipo === "refatoracao") {
        codigoOriginalParaAST = questaoAtual.codigoSujo;
    }

    let resultado = avaliador.executarTestes(
        codigoDoAluno,
        questaoAtual.nomeDaFuncao,
        questaoAtual.testes,
        codigoOriginalParaAST
    );

    resposta.json(resultado);
});

// Rota: retornar o banco completo para montar o Modo Competitivo
app.get("/api/banco-publico", function(requisicao, resposta) {
    let listaCompleta;
    try {
        listaCompleta = lerBanco();
    } catch (erro) {
        return resposta.status(500).json({ erro: erro.message });
    }

    // SEGURANÇA: antes de enviar ao aluno, removemos os campos sensíveis.
    // Sem isso, qualquer aluno poderia ver o gabarito inspecionando a rede
    // no DevTools do navegador (aba Network → Response).
    let listaPublica = listaCompleta.map(function(questao) {
        return {
            id:          questao.id,
            titulo:      questao.titulo,
            missao:      questao.missao,
            tipo:        questao.tipo,
            dificuldade: questao.dificuldade,
            codigoSujo:  questao.codigoSujo
            // codigoLimpo e nomeDaFuncao são intencionalmente omitidos aqui
        };
    });

    resposta.json(listaPublica);
});

// -----------------------------------------------------------------------------
// SEÇÃO 6: ROTAS DO PROFESSOR (protegidas pelo middleware verificarAutenticacao)
// -----------------------------------------------------------------------------

// Rota: listar todas as questões do banco (painel administrativo)
app.get("/api/admin/questoes", verificarAutenticacao, function(requisicao, resposta) {
    try {
        resposta.json(lerBanco());
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota: gerar questões em lote via IA
app.post("/api/admin/abastecer", verificarAutenticacao, async function(requisicao, resposta) {
    let quantidade  = requisicao.body.quantidade;
    let tipo        = requisicao.body.tipo;
    let dificuldade = parseInt(requisicao.body.dificuldade);
    let totalGerados = 0;

    try {
        let listaDeQuestoes = lerBanco();

        for (let i = 0; i < quantidade; i++) {

            // Aguarda 10 segundos entre gerações para respeitar o rate limit da API do Gemini
            if (i > 0) {
                console.log(`Aguardando 10 segundos... (Questão ${i + 1} de ${quantidade})`);
                await atraso(10000);
            }

            // CONCEITO DE TESTES: Isolamento de Falhas (Fault Isolation)
            // O try/catch INTERNO garante que a falha em UMA geração não cancela
            // todas as demais. O erro é registrado no console e o loop continua
            // para a próxima questão. Isso torna o sistema mais resiliente.
            try {
                let novoExercicio = await geradorIA.gerarNovoDesafio(tipo, dificuldade);
                if (novoExercicio !== null) {
                    novoExercicio.id = Date.now() + i; // Timestamp garante IDs únicos
                    listaDeQuestoes.push(novoExercicio);
                    totalGerados++;
                }
            } catch (erroInterno) {
                console.error(`Falha ao gerar questão ${i + 1}:`, erroInterno.message);
                continue; // Pula para a próxima iteração do loop
            }
        }

        salvarBanco(listaDeQuestoes);
        resposta.json({ sucesso: true, quantidade: totalGerados });

    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota: excluir uma questão pelo ID
app.delete("/api/admin/questoes/:id", verificarAutenticacao, function(requisicao, resposta) {
    // O parâmetro de URL chega como string; parseInt converte para número
    let idParaExcluir = parseInt(requisicao.params.id);

    try {
        let lista = lerBanco();

        // filter() cria um novo array contendo apenas os itens que passam no teste.
        // Aqui mantemos todas as questões EXCETO a que tem o ID a excluir.
        let novaLista = lista.filter(function(questao) {
            return questao.id !== idParaExcluir;
        });

        salvarBanco(novaLista);
        resposta.json({ sucesso: true });
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota: atualizar uma questão existente
app.post("/api/admin/questoes/atualizar", verificarAutenticacao, function(requisicao, resposta) {
    let questaoEditada = requisicao.body;

    try {
        let lista = lerBanco();

        for (let i = 0; i < lista.length; i++) {
            if (lista[i].id === questaoEditada.id) {

                // CONCEITO DE QUALIDADE: Merge Seguro com Object.assign()
                // Object.assign({}, original, editado) cria um NOVO objeto
                // combinando os dois. Os campos do objeto editado sobrescrevem
                // os do original, mas os campos que o formulário não enviou
                // (como testes e nomeDaFuncao) são preservados do original.
                // Sem isso, uma edição parcial apagaria esses dados silenciosamente.
                lista[i] = Object.assign({}, lista[i], questaoEditada);
                break;
            }
        }

        salvarBanco(lista);
        resposta.json({ sucesso: true });
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota: criar uma nova questão manualmente
app.post("/api/admin/questoes/criar", verificarAutenticacao, function(requisicao, resposta) {
    let novaQuestao = requisicao.body;

    try {
        let lista = lerBanco();
        lista.push(novaQuestao);
        salvarBanco(lista);
        resposta.json({ sucesso: true });
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota: testar código no Sandbox do Professor
app.post("/api/admin/sandbox/testar", verificarAutenticacao, function(requisicao, resposta) {
    let { codigo, nomeDaFuncao, testes, forcarAvaliacaoAST, codigoSujoOriginal } = requisicao.body;

    // Ativa a análise AST apenas quando o professor testa o gabarito de uma refatoração.
    // Se estiver testando o código sujo, desativamos — ele falharia na comparação de
    // variáveis por design, o que seria um falso positivo.
    let codigoParaAST = forcarAvaliacaoAST ? codigoSujoOriginal : null;

    try {
        let resultado = avaliador.executarTestes(codigo, nomeDaFuncao, testes, codigoParaAST);
        resposta.json(resultado);
    } catch (erro) {
        resposta.json({ sucesso: false, erros: ["Erro interno no avaliador: " + erro.message] });
    }
});

// -----------------------------------------------------------------------------
// SEÇÃO 7: INICIALIZAÇÃO
// -----------------------------------------------------------------------------

app.listen(3000, "0.0.0.0", function() {
    console.log("Servidor rodando! Acesse: http://localhost:3000");
});