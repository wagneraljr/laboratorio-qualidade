// =============================================================================
// geradorIA.js — Geração de Exercícios via Inteligência Artificial
// =============================================================================
// Este módulo se comunica com a API do Google Gemini para gerar novos
// exercícios de programação automaticamente.
//
// CONCEITO DE QUALIDADE: Módulo com Responsabilidade Única (SRP)
// Este arquivo faz apenas uma coisa: gerar exercícios via IA.
// Tudo relacionado a salvar, listar ou avaliar questões fica em outros módulos.
//
// CONCEITO DE TESTES: Resiliência e Tolerância a Falhas
// APIs externas são instáveis por natureza — podem estar sobrecarregadas,
// com rate limit atingido, ou temporariamente fora do ar. Este módulo
// implementa estratégias para lidar com essas situações graciosamente.
// =============================================================================

const dotenv = require("dotenv");
dotenv.config(); // Carrega as variáveis do arquivo .env para process.env

const { GoogleGenerativeAI } = require("@google/generative-ai");

// =============================================================================
// CONFIGURAÇÃO: Criamos o cliente da IA UMA VEZ, fora da função.
//
// CONCEITO DE QUALIDADE: Evitar Trabalho Desnecessário
// Criar o cliente dentro da função significaria recriar o objeto a cada chamada.
// Ao criá-lo aqui, no escopo do módulo, ele é instanciado apenas uma vez
// quando o servidor inicia, e reutilizado em todas as gerações.
// =============================================================================

const clienteIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modeloIA  = clienteIA.getGenerativeModel({ model: "gemini-2.5-flash" });

// Lista de temas possíveis para os exercícios gerados
// Manter essa lista separada facilita adicionar novos temas sem mexer na lógica
const TEMAS_POSSIVEIS = [
    "Manipulação de Strings (inversão, busca, contagem de vogais)",
    "Lógica Matemática (fatorial, números primos, sequência de Fibonacci)",
    "Validação de Dados (CPFs fictícios, e-mails, datas)",
    "Sistemas de Inventário (objetos de produtos, preços, estoque)",
    "Conversão de Unidades (temperatura, medidas, moedas)",
    "Processamento de Notas de Alunos (médias, conceitos, aprovação)",
    "Simulação de Carrinho de Compras (descontos, taxas, impostos)"
];

// Configurações do mecanismo de reenvio em caso de falha
const MAX_TENTATIVAS  = 4;
const ESPERA_INICIAL  = 2000; // 2 segundos na primeira tentativa

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

// Cria uma pausa assíncrona — necessária para o backoff exponencial
function esperar(milissegundos) {
    return new Promise(function(resolve) {
        setTimeout(resolve, milissegundos);
    });
}

// Monta o prompt que será enviado à IA com base no tipo e dificuldade desejados
function montarPrompt(tipoDeExercicio, nivelDificuldade) {
    // Define o contexto do tipo de exercício de forma descritiva para a IA
    let descricaoTipo = tipoDeExercicio === "correcao"
        ? "correção de bugs (inserir erros de lógica ou sintaxe sutis para o aluno encontrar)"
        : "refatoração de código (código que funciona, mas com nomes ruins, repetição e complexidade excessiva)";

    // Sorteia um tema aleatório da lista
    let indiceAleatorio = Math.floor(Math.random() * TEMAS_POSSIVEIS.length);
    let temaSorteado    = TEMAS_POSSIVEIS[indiceAleatorio];

    // O prompt é uma instrução detalhada para a IA.
    // CONCEITO DE QUALIDADE: Quanto mais preciso o prompt, mais previsível
    // e consistente será o resultado — o mesmo princípio de escrever boas
    // especificações de requisitos antes de implementar.
    return `
        Atue como um professor de curso técnico em informática elaborando um exercício de ${descricaoTipo} em JavaScript.
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
                { "parametros": "1, 2", "saidaEsperada": 3 },
                { "parametros": "[10, 20, 30]", "saidaEsperada": 60 }
            ]
        }
        REGRA DOS TESTES: O valor de 'parametros' deve ser uma string com o conteúdo EXATO que vai dentro dos parênteses da função. Não envolva números soltos em colchetes.

        VALIDAÇÃO OBRIGATÓRIA ANTES DE RESPONDER:
        Antes de gerar o JSON final, simule mentalmente a execução de cada teste:
        1. Chame nomeDaFuncao(parametros) usando o codigoLimpo (gabarito).
        2. Confirme que o retorno é EXATAMENTE igual a saidaEsperada (mesmo tipo: número, string, array, boolean).
        3. Se qualquer teste falhar nessa simulação, corrija o código ou o teste antes de responder.
        Só inclua um teste no JSON se tiver certeza absoluta de que ele passa com o gabarito.
    `;
}

// =============================================================================
// VALIDAÇÃO PROGRAMÁTICA DO EXERCÍCIO GERADO
// =============================================================================

// Valida o objeto retornado pela IA antes de aceitá-lo no banco.
//
// CONCEITO DE TESTES: Validação de Contrato (Contract Testing)
// A IA é um sistema externo — não podemos garantir que ela sempre devolverá
// dados no formato correto. Esta função age como um "porteiro": só deixa
// passar questões que atendam a todos os critérios mínimos de qualidade.
// Isso é o mesmo princípio de validar dados de entrada em qualquer sistema.
//
// CONCEITO DE TESTES: Teste de Execução Real (Smoke Test)
// Além de checar a estrutura do JSON, executamos cada caso de teste contra
// o gabarito usando a mesma máquina virtual do avaliador de alunos. Se um
// teste não passar com o próprio gabarito, a questão nunca funcionaria —
// é melhor descartar agora do que descobrir durante a aula.
//
// Retorna um objeto: { valido: true } ou { valido: false, motivo: "..." }
function validarExercicio(exercicio) {
    const vm = require("vm");

    // --- ETAPA 1: Verificação de estrutura (campos obrigatórios) ---
    //
    // CONCEITO DE TESTES: Validação de Campos Obrigatórios
    // Antes de qualquer lógica, verificamos se o JSON tem todos os campos
    // que o resto do sistema espera. Sem isso, erros obscuros aparecem mais
    // tarde em partes do código completamente diferentes.
    const camposObrigatorios = ["titulo", "missao", "codigoSujo", "codigoLimpo", "nomeDaFuncao", "testes", "tipo", "dificuldade"];
    for (let campo of camposObrigatorios) {
        if (!exercicio[campo]) {
            return { valido: false, motivo: `Campo obrigatório ausente: '${campo}'` };
        }
    }

    // Pelo menos 2 testes são necessários para uma validação minimamente confiável
    if (!Array.isArray(exercicio.testes) || exercicio.testes.length < 2) {
        return { valido: false, motivo: "A questão precisa ter pelo menos 2 casos de teste." };
    }

    // --- ETAPA 2: Execução real dos testes contra o gabarito (Smoke Test) ---
    //
    // CONCEITO DE TESTES: Por que testar o gabarito?
    // A IA pode gerar testes matematicamente incorretos — ex: dizer que
    // somarArray([1,2,3]) retorna 7 quando o gabarito retorna 6. Isso faria
    // o aluno "acertar" uma questão impossível ou "errar" uma questão correta.
    // Executar os testes contra o gabarito garante consistência interna.
    let totalTestes = exercicio.testes.length;
    let testesPassando = 0;
    let testesComErro = [];

    for (let i = 0; i < totalTestes; i++) {
        let teste = exercicio.testes[i];

        // Cada teste roda em um sandbox isolado — o mesmo mecanismo usado
        // para avaliar o código dos alunos (ver avaliadorCodigo.js).
        try {
            let ambiente = {};
            vm.createContext(ambiente);
            vm.runInContext(exercicio.codigoLimpo, ambiente, { timeout: 2000 });

            let chamada   = exercicio.nomeDaFuncao + "(" + teste.parametros + ")";
            let resultado = vm.runInContext(chamada, ambiente, { timeout: 2000 });

            // Comparação por valor usando JSON.stringify — o mesmo critério
            // usado pelo avaliador de alunos, garantindo consistência
            if (JSON.stringify(resultado) === JSON.stringify(teste.saidaEsperada)) {
                testesPassando++;
            } else {
                testesComErro.push(
                    `Teste ${i + 1}: ${chamada} retornou ${JSON.stringify(resultado)}, ` +
                    `esperado ${JSON.stringify(teste.saidaEsperada)}`
                );
            }
        } catch (erro) {
            testesComErro.push(`Teste ${i + 1}: exceção ao executar — ${erro.message}`);
        }
    }

    // CONCEITO DE TESTES: Limiar de Aceitação
    // Exigimos que TODOS os testes passem. Um único teste incorreto já
    // compromete a integridade da questão — não há "aprovação parcial" aqui.
    if (testesPassando < totalTestes) {
        return {
            valido: false,
            motivo: `${testesComErro.length} teste(s) falharam com o próprio gabarito:\n  - ` + testesComErro.join("\n  - ")
        };
    }

    // Questão passou em todas as verificações
    return { valido: true };
}

// =============================================================================
// FUNÇÃO PRINCIPAL
// =============================================================================

// Gera um novo exercício via IA e retorna o objeto JSON, ou null em caso de falha.
//
// CONCEITO DE TESTES: Backoff Exponencial (Exponential Backoff)
// Quando chamamos uma API externa e ela falha, não devemos tentar novamente
// imediatamente — isso pode sobrecarregar ainda mais o servidor remoto.
// O backoff exponencial aumenta o tempo de espera a cada tentativa:
//   Tentativa 1: falhou → espera 2 segundos
//   Tentativa 2: falhou → espera 4 segundos
//   Tentativa 3: falhou → espera 8 segundos
//   Tentativa 4: desiste definitivamente
// Essa estratégia é usada por grandes sistemas (AWS, Google, etc) para lidar
// com falhas transitórias em serviços distribuídos.
async function gerarNovoDesafio(tipoDeExercicio, nivelDificuldade) {
    let prompt       = montarPrompt(tipoDeExercicio, nivelDificuldade);
    let tempoDeEspera = ESPERA_INICIAL;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {

        try {
            // Envia o prompt para a IA e aguarda a resposta
            let resultado = await modeloIA.generateContent(prompt);
            let resposta  = await resultado.response;
            let texto     = resposta.text();

            // A IA às vezes envolve o JSON em blocos de código markdown (```json ... ```)
            // mesmo sendo instruída a não fazer isso. Removemos esse invólucro por segurança.
            texto = texto.replace(/```json/g, "").replace(/```/g, "").trim();

            // JSON.parse lança uma exceção se o texto não for um JSON válido.
            // Isso ativa o catch abaixo e dispara uma nova tentativa.
            let exercicio = JSON.parse(texto);

            // CONCEITO DE TESTES: Validação Antes de Aceitar
            // Só retornamos a questão se ela passar em todos os critérios:
            // estrutura correta e todos os testes validados contra o gabarito.
            // Se falhar, tratamos como se a tentativa tivesse dado erro —
            // o backoff exponencial cuida do reenvio automaticamente.
            let validacao = validarExercicio(exercicio);
            if (!validacao.valido) {
                // Lançamos um erro para cair no catch e acionar a próxima tentativa.
                // A mensagem explica EXATAMENTE o que a IA gerou de errado,
                // facilitando a depuração ao olhar os logs do servidor.
                throw new Error("Questão inválida gerada pela IA: " + validacao.motivo);
            }

            console.log(`[IA] Questão "${exercicio.titulo}" validada com sucesso (${exercicio.testes.length} testes passaram).`);
            return exercicio;

        } catch (erro) {
            console.warn(`[IA] Falha na tentativa ${tentativa} de ${MAX_TENTATIVAS}: ${erro.message}`);

            // Se esta foi a última tentativa, desistimos e retornamos null.
            // O chamador (app.js) trata o null e registra a falha sem travar.
            if (tentativa === MAX_TENTATIVAS) {
                console.error("[IA] Todas as tentativas falharam. Desistindo desta questão.");
                return null;
            }

            // Aguarda antes de tentar novamente
            console.log(`[IA] Aguardando ${tempoDeEspera / 1000}s antes de tentar novamente...`);
            await esperar(tempoDeEspera);

            // Dobra o tempo de espera para a próxima tentativa (backoff exponencial)
            tempoDeEspera = tempoDeEspera * 2;
        }
    }
}

module.exports = { gerarNovoDesafio };