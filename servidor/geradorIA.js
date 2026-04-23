const dotenv = require("dotenv");
dotenv.config();

const gemini = require("@google/generative-ai");
const GoogleGenerativeAI = gemini.GoogleGenerativeAI;

async function gerarNovoDesafio(tipoDeExercicio, nivelDificuldade) {
    const chaveApi = process.env.GEMINI_API_KEY;
    const ia = new GoogleGenerativeAI(chaveApi);
    const modelo = ia.getGenerativeModel({ model: "gemini-2.5-flash" });

    let contextoTipo = tipoDeExercicio === "correcao" 
        ? "correção de bugs (inserir erros de lógica ou sintaxe sutis para o aluno encontrar)" 
        : "refatoração de código (código funciona, mas com nomes ruins, repetição desnecessária e complexo)";

// Lista de temas para forçar a diversidade
    const temas = [
        "Manipulação de Strings (inversão, busca, contagem de vogais)",
        "Lógica Matemática (fatorial, números primos, sequência de Fibonacci)",
        "Validação de Dados (CPFs fictícios, e-mails, datas)",
        "Sistemas de Inventário (objetos de produtos, preços, estoque)",
        "Conversão de Unidades (temperatura, medidas, moedas)",
        "Processamento de Notas de Alunos (médias, conceitos, aprovação)",
        "Simulação de Carrinho de Compras (descontos, taxas, impostos)"
    ];

    // Sorteia um tema para enviar no prompt
    const temaSorteado = temas[Math.floor(Math.random() * temas.length)];

    const promptDiretrizes = `
        Atue como um professor de curso técnico. Elabore um exercício de ${contextoTipo}.
        Dificuldade nível ${nivelDificuldade}.
        
        TEMA OBRIGATÓRIO: O exercício deve focar em ${temaSorteado}.

        Evite comentários no código sujo.
        
        REGRAS ABSOLUTAS E INQUEBRÁVEIS PARA O CÓDIGO (Tanto o sujo quanto o limpo):
        1. Use EXCLUSIVAMENTE a declaração tradicional de funções (sintaxe 'function'). É estritamente proibido usar arrow functions.
        2. Para laços de repetição, use EXCLUSIVAMENTE a estrutura clássica 'for' manipulando o índice (exemplo: for (let i = 0; i < array.length; i++)).
        3. REGRA VITAL PARA REFATORAÇÃO: O 'codigoSujo' DEVE funcionar perfeitamente e retornar o valor correto, ele deve apenas ter nomes ruins e estrutura confusa.
        4. É ESTRITAMENTE PROIBIDO utilizar métodos iteradores de array (como .forEach(), .map(), .filter(), .reduce(), .find()).
        
        Retorne o resultado ESTRITAMENTE em formato JSON, sem marcações markdown ao redor, com as seguintes chaves:
        {
            "titulo": "Nome do problema",
            "missao": "Descrição clara do que o aluno deve fazer",
            "codigoSujo": "o código javascript que o aluno deverá trabalhar",
            "codigoLimpo": "A versão ideal deste código (gabarito refatorado/corrigido)",
            "tipo": "${tipoDeExercicio}",
            "dificuldade": ${nivelDificuldade},
            "nomeDaFuncao": "NOME_EXATO_DA_FUNCAO",
            "testes": [
                { "parametros": "[1, 2]", "saidaEsperada": 3 },
                { "parametros": "[5, 5]", "saidaEsperada": 10 }
            ]
        }
    `;

    try {
        const resultado = await modelo.generateContent(promptDiretrizes);
        const resposta = await resultado.response;
        let texto = resposta.text();
        
        texto = texto.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(texto);
    } catch (erro) {
        console.error("Falha ao gerar o exercício:", erro);
        return null;
    }
}

module.exports = {
    gerarNovoDesafio: gerarNovoDesafio
};