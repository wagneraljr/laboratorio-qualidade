// Importações sem desestruturação
const express = require("express");
const path = require("path");
const fs = require("fs"); // Módulo para manipulação de arquivos
const geradorIA = require("./geradorIA");
const cookieParser = require("cookie-parser");
const avaliadorCodigo = require("./avaliadorCodigo");

const app = express();

// Função para criar um atraso (sleep) no código
const atraso = function(milissegundos) {
    return new Promise(function(resolucao) {
        setTimeout(resolucao, milissegundos);
    });
};

// Permite que o servidor entenda dados no formato JSON
app.use(express.json());
app.use(cookieParser()); // Para lidar com cookies (sessões)

// Diz ao Express para servir os arquivos da pasta "publico"
const caminhoPublico = path.join(__dirname, "..", "publico");
const caminhoBanco = path.join(__dirname, "bancoQuestoes.json");

app.use(express.static(caminhoPublico));

function verificarAutenticacao(requisicao, resposta, proximo) {
    let token = requisicao.cookies.auth_token;
    
    if (token === "logado") {
        return proximo(); // Autorizado: segue para a página/rota
    } else {
        resposta.redirect("/login.html"); // Não autorizado: vai para o login
    }
}
// Rota de Login (POST)
app.post("/api/login", function(requisicao, resposta) {
    let senhaDigitada = requisicao.body.senha;
    let senhaCorreta = process.env.ADMIN_PASSWORD;

    if (senhaDigitada === senhaCorreta) {
        // Define um cookie que expira em 1 hora
        resposta.cookie("auth_token", "logado", { maxAge: 3600000, httpOnly: true });
        resposta.json({ sucesso: true });
    } else {
        resposta.status(401).json({ sucesso: false, erro: "Senha incorreta" });
    }
});

// Rota para deslogar o professor
app.post("/api/logout", function(requisicao, resposta) {
    resposta.clearCookie("auth_token");
    resposta.json({ sucesso: true });
});

// ROTA DO PROFESSOR (Com mitigação de Rate Limit)
app.post("/api/admin/abastecer", verificarAutenticacao, async function(requisicao, resposta) {
    let quantidade = requisicao.body.quantidade;
    let tipo = requisicao.body.tipo;
    let dificuldade = parseInt(requisicao.body.dificuldade);
    
    let totalGerados = 0;

    try {
        let conteudoAtual = fs.readFileSync(caminhoBanco, "utf8");
        let listaDeQuestoes = JSON.parse(conteudoAtual);

        for (let i = 0; i < quantidade; i++) {
            
            // Se não for a primeira questão, espera 4 segundos antes de continuar
            if (i > 0) {
                console.log(`Aguardando 10 segundos... (Questão ${i+1} de ${quantidade})`);
                await atraso(10000);
            }

            try {
                let novoExercicio = await geradorIA.gerarNovoDesafio(tipo, dificuldade);
                if (novoExercicio !== null) {
                    novoExercicio.id = Date.now() + i; // ID único
                    listaDeQuestoes.push(novoExercicio);
                    totalGerados = totalGerados + 1;
                }
            } catch (erroInterno) {
                console.error("Falha ao gerar a questão", i+1, erroInterno);
                // O continue faz o laço ignorar o erro e pular para a próxima tentativa
                continue; 
            }
        }

        fs.writeFileSync(caminhoBanco, JSON.stringify(listaDeQuestoes, null, 2));
        resposta.json({ sucesso: true, quantidade: totalGerados });
        
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: "Falha ao manipular o banco JSON." });
    }
});

// ROTA DO ALUNO (Agora usando POST para receber os filtros)
app.post("/api/missao-aleatoria", function(requisicao, resposta) {
    let tipoDesejado = requisicao.body.tipo;
    let dificuldadeDesejada = parseInt(requisicao.body.dificuldade);

    let conteudo = fs.readFileSync(caminhoBanco, "utf8");
    let listaDeQuestoes = JSON.parse(conteudo);
    
    let questoesFiltradas = [];

    // Filtra o banco de questões usando for...of
    for (let questao of listaDeQuestoes) {
        if (questao.tipo === tipoDesejado && questao.dificuldade === dificuldadeDesejada) {
            questoesFiltradas.push(questao);
        }
    }
    
    if (questoesFiltradas.length > 0) {
        let indice = Math.floor(Math.random() * questoesFiltradas.length);
        resposta.json({ sucesso: true, dados: questoesFiltradas[indice] });
    } else {
        resposta.status(404).json({ sucesso: false, erro: "Nenhuma missão com este perfil no estoque." });
    }
});

// Atualize a rota de avaliação:
app.post("/api/avaliar", function(requisicao, resposta) {
    let codigoDoAluno = requisicao.body.codigo;
    let idDaQuestao = requisicao.body.idQuestao; // Precisamos saber qual questão ele está respondendo

    // Busca a questão no banco para pegar os testes corretos
    let conteudo = fs.readFileSync(caminhoBanco, "utf8");
    let listaDeQuestoes = JSON.parse(conteudo);
    
    let questaoAtual = null;
    for (let questao of listaDeQuestoes) {
        if (questao.id === idDaQuestao) {
            questaoAtual = questao;
            break;
        }
    }

    if (questaoAtual !== null) {
        // Verifica se é refatoração para acionar a análise de AST no avaliador
        let codigoOriginalParaAST = null;
        if (questaoAtual.tipo === "refatoracao") {
            codigoOriginalParaAST = questaoAtual.codigoSujo;
        }

        // Manda para o motor de avaliação (Agora passando o código sujo original como 4º parâmetro)
        let resultadoDaAvaliacao = avaliadorCodigo.executarTestes(
            codigoDoAluno, 
            questaoAtual.nomeDaFuncao, 
            questaoAtual.testes,
            codigoOriginalParaAST
        );
        
        resposta.json(resultadoDaAvaliacao);
    } else {
        resposta.status(404).json({ sucesso: false, erros: ["Questão não encontrada no sistema."] });
    }
});

// --- ROTA PÚBLICA: BUSCAR BANCO COMPLETO (Usada no Modo Competitivo) ---
app.get("/api/questoes", function(req, res) {
    try {
        // Lê o arquivo JSON do banco de dados
        let conteudo = fs.readFileSync(caminhoBanco, "utf8");
        let listaCompleta = JSON.parse(conteudo);
        
        // Devolve a lista para o front-end montar a competição
        res.json(listaCompleta);
    } catch (erro) {
        console.error("Erro ao ler o banco de questões:", erro);
        res.status(500).json({ erro: "Falha interna no servidor." });
    }
});

app.get("/api/admin/questoes", verificarAutenticacao, function(requisicao, resposta) {
    let conteudo = fs.readFileSync(caminhoBanco, "utf8");
    resposta.json(JSON.parse(conteudo));
});

// Rota para excluir uma questão específica
app.delete("/api/admin/questoes/:id", verificarAutenticacao, function(requisicao, resposta) {
    let idParaExcluir = parseInt(requisicao.params.id);
    
    try {
        let conteudo = fs.readFileSync(caminhoBanco, "utf8");
        let lista = JSON.parse(conteudo);
        
        // Filtra a lista mantendo apenas as que NÃO têm o ID informado
        let novaLista = lista.filter(function(item) {
            return item.id !== idParaExcluir;
        });
        
        fs.writeFileSync(caminhoBanco, JSON.stringify(novaLista, null, 2));
        resposta.json({ sucesso: true });
    } catch (erro) {
        resposta.status(500).json({ sucesso: false, erro: "Erro ao excluir questão." });
    }
});

// Criar ou atualizar questão manualmente
app.post("/api/admin/questoes/atualizar", verificarAutenticacao, function(req, res) {
    let questaoEditada = req.body;
    let conteudo = fs.readFileSync(caminhoBanco, "utf8");
    let lista = JSON.parse(conteudo);

    for (let i = 0; i < lista.length; i++) {
        if (lista[i].id === questaoEditada.id) {
            // Se for edição manual, a IA não gerou testes novos, 
            // mantemos os testes originais se existirem.
            questaoEditada.testes = lista[i].testes || []; 
            lista[i] = questaoEditada;
            break;
        }
    }

    fs.writeFileSync(caminhoBanco, JSON.stringify(lista, null, 2));
    res.json({ sucesso: true });
});

app.post("/api/admin/questoes/criar", verificarAutenticacao, function(req, res) {
    let novaQuestao = req.body;
    let conteudo = fs.readFileSync(caminhoBanco, "utf8");
    let lista = JSON.parse(conteudo);
    
    lista.push(novaQuestao);
    
    fs.writeFileSync(caminhoBanco, JSON.stringify(lista, null, 2));
    res.json({ sucesso: true });
});

// --- ROTA: SANDBOX DO PROFESSOR (Testes avulsos) ---
app.post("/api/admin/sandbox/testar", verificarAutenticacao, function(req, res) {
    let { codigo, nomeDaFuncao, testes, forcarAvaliacaoAST, codigoSujoOriginal } = req.body;
    
    // Se o professor estiver testando o Gabarito de uma refatoração, ligamos o AST.
    // Se ele estiver testando o código Sujo, desligamos o AST (pois o Sujo falharia de propósito contra ele mesmo).
    let codigoParaAST = forcarAvaliacaoAST ? codigoSujoOriginal : null;
    
    try {
        let resultado = avaliadorCodigo.executarTestes(codigo, nomeDaFuncao, testes, codigoParaAST);
        res.json(resultado);
    } catch (erro) {
        res.json({ sucesso: false, erros: ["Erro interno no avaliador: " + erro.message] });
    }
});

// Inicia o servidor na porta 3000
app.listen(3000, function() {
    console.log("Servidor rodando! Acesse: http://localhost:3000");
});