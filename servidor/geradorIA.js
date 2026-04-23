const dotenv = require("dotenv");
dotenv.config();

const gemini = require("@google/generative-ai");
const GoogleGenerativeAI = gemini.GoogleGenerativeAI;

// Função auxiliar para criar a pausa (Sleep)
function esperar(milissegundos) {
    return new Promise(function(resolve) {
        setTimeout(resolve, milissegundos);
    });
}

async function gerarNovoDesafio(tipoDeExercicio, nivelDificuldade) {
    const chaveApi = process.env.GEMINI_API_KEY;
    const ia = new GoogleGenerativeAI(chaveApi);
    const modelo = ia.getGenerativeModel({ model: "gemini-2.5-flash" });

    let contextoTipo = tipoDeExercicio === "correcao" 
        ? "correção de bugs (inserir erros de lógica ou sintaxe sutis para o aluno encontrar)" 
        : "refatoração de código (código funciona, mas com nomes ruins, repetição desnecessária e complexo)";

    const temas = [
        "Manipulação de Strings (inversão, busca, contagem de vogais)",
        "Lógica Matemática (fatorial, números primos, sequência de Fibonacci)",
        "Validação de Dados (CPFs fictícios, e-mails, datas)",
        "Sistemas de Inventário (objetos de produtos, preços, estoque)",
        "Conversão de Unidades (temperatura, medidas, moedas)",
        "Processamento de Notas de Alunos (médias, conceitos, aprovação)",
        "Simulação de Carrinho de Compras (descontos, taxas, impostos)"
    ];

    const temaSorteado = temas[Math.floor(Math.random() * temas.length)];

    const promptDiretrizes = `
        Atue como um professor de curso técnico em informática elaborando um exercício de ${contextoTipo} em JavaScript.
        O nível de dificuldade exigido é ${nivelDificuldade} (em uma escala de 1 a 5, onde 1 é muito básico e 5 exige maior domínio de lógica).
        TEMA OBRIGATÓRIO: O exercício deve focar em ${temaSorteado}.

        Evite comentários no código sujo.
        
        REGRAS ABSOLUTAS:
        1. Use EXCLUSIVAMENTE a declaração tradicional de funções (sintaxe 'function'). Proibido arrow functions.
        2. Para laços de repetição, use EXCLUSIVAMENTE a estrutura clássica 'for' (ex: for (let i = 0; i < array.length; i++)).
        3. O 'codigoSujo' DEVE funcionar perfeitamente.
        4. O nome da função no 'codigoSujo' DEVE SER EXATAMENTE O MESMO da chave 'nomeDaFuncao'.
        
        Retorne ESTRITAMENTE em formato JSON puro, sem marcações markdown:
        {
            "titulo": "Nome do problema",
            "missao": "Descrição clara do que o aluno deve fazer",
            "codigoSujo": "o código javascript para o aluno trabalhar",
            "codigoLimpo": "A versão ideal deste código (gabarito)",
            "tipo": "${tipoDeExercicio}",
            "dificuldade": ${nivelDificuldade},
            "nomeDaFuncao": "nome_exato_da_funcao",
            "testes": [
                { "parametros": "[1, 2]", "saidaEsperada": 3 },
                { "parametros": "[5, 5]", "saidaEsperada": 10 }
            ]
        }
    `;

    // --- LÓGICA DE RECUO EXPONENCIAL (EXPONENTIAL BACKOFF) ---
    let tentativasMaximas = 4;
    let tempoDeEspera = 2000; // Começa esperando 2 segundos

    for (let tentativaAtual = 1; tentativaAtual <= tentativasMaximas; tentativaAtual++) {
        try {
            const resultado = await modelo.generateContent(promptDiretrizes);
            const resposta = await resultado.response;
            let texto = resposta.text();
            
            texto = texto.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(texto);
            
        } catch (erro) {
            console.warn(`[Aviso] Falha na tentativa ${tentativaAtual} de ${tentativasMaximas}. Erro: ${erro.message}`);
            
            if (tentativaAtual === tentativasMaximas) {
                console.error("Todas as tentativas de contatar a IA falharam.");
                return null; // Desiste definitivamente
            }
            
            console.log(`Aguardando ${tempoDeEspera / 1000} segundos antes de tentar novamente...`);
            await esperar(tempoDeEspera);
            tempoDeEspera = tempoDeEspera * 2; // Dobra o tempo de espera para a próxima tentativa
        }
    }
}

module.exports = {
    gerarNovoDesafio: gerarNovoDesafio
};