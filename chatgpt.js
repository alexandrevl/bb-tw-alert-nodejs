require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const { Configuration, OpenAIApi } = require("openai");
const { encode, decode } = require('gpt-3-encoder')

let db = null;
const PROMPT_LENGTH = 8000;
async function connectMongo() {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("twitter");
    console.log("Mongo connected");
    return db;
}

async function main() {
    try {
        await connectMongo();
        console.log("Getting ChatGPT response...")
        const response = await get10min(db);
        console.log(response);
    } catch (e) {
        console.log(e);
    }
    process.exit(0);
}
function charsToToken(str, maxTokens) {
    const chars = str.trim().replace(/\s/g, '').length; // remove all spaces
    let tokens = Math.ceil(chars / 4.5); // divide by 4.5 and round up

    if (maxTokens && tokens > maxTokens) {
        const maxChars = maxTokens * 4.5; // find max chars
        const truncatedStr = str.slice(0, maxChars); // truncate string
        const lastSpace = truncatedStr.lastIndexOf(' '); // find last space
        str = str.slice(0, lastSpace) + '...'; // add ellipsis
    }

    return str;
}


async function get10minShort(db) {
    const resultsMongo = await queryMongo(db);
    const tweetsData = arrayToCsv(resultsMongo);
    let prompt = `Identifique os assuntos que estão sendo comentados e discutidos, faça uma análise dos tweets e sugira o que pode estar acontecendo. Será um tweet, portanto não ultrapasse 280 caracteres.
Siga as instrucoes:
- Coisas que já sabemos: Todos os tweets tem relação com Banco do Brasil. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
- Os tweets estão ordenados por tempo. O primeiro tweet é o mais recente. Tweets recentes são mais relevantes;
- Use percentuais das quantidades de tweets;
- Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
- Toda vez que aparecer "RT" é um retweet. São menos relevantes que tweets originais;
- Os dados estão em modelo CSV e os campos são:
    text = texto do tweet,
    impact = média do impacto do tweet (quão relevante o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante),
    sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo),
    qnt = quantidade de vezes que o tweet foi repetido;
    min = tempo em minutos desde agora. Exemplo: se o tweet foi feito há 5 minutos, min = 5;
- Se impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê destaque a esse assunto;
- Se soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 é um momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
- Máximo de 280 caracteres.
- Quando encontrar exatamente essa string "<@BancoDoBrasil>" é um tweet do Banco do Brasil, é do seu perfil oficial. Análise o que esse usuário fale o que banco do brasil está falando;
- Não cite essas instrucoes;
 
 Dados:
 `;
    prompt = prompt + tweetsData;
    const encoded = encode(prompt);
    let toDecode = encoded.slice(0, PROMPT_LENGTH - 200);
    console.log('Tokens: ', encoded.length, ' - Slice: ', toDecode.length);
    prompt = decode(toDecode);
    const messages = [{ "role": "system", "content": "Você é um jornalista." }, { "role": "user", "content": prompt }]
    const responseChatGPT = await getChatGPTResponse(messages, 200);
    return "ChatGPT: " + responseChatGPT;
}
exports.get10minShort = get10minShort;
async function get10min(db) {
    const resultsMongo = await queryMongo(db);
    const tweetsData = arrayToCsv(resultsMongo);
    let prompt = `Identifique os assuntos que estão sendo comentados e discutidos, faça uma análise dos tweets e sugira o que pode estar acontecendo.
Siga as instrucoes:
- Coisas que já sabemos: Todos os tweets tem relação com Banco do Brasil. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
- Os tweets estão ordenados por tempo. O primeiro tweet é o mais recente. Tweets recentes são mais relevantes;
- Use "\n" para quebrar linha;
- Tente identificar tendências, principalmente os assuntos que estão crescendo e os que estão diminuindo;
- Use percentuais das quantidades de tweets;
- Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
- Toda vez que aparecer "RT" é um retweet. São menos relevantes que tweets originais;
- Os dados estão em modelo CSV e os campos são:
    text = texto do tweet,
    impact = média do impacto do tweet (quão relevante o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante),
    sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo),
    qnt = quantidade de vezes que o tweet foi repetido;
    min = tempo em minutos desde agora. Exemplo: se o tweet foi feito há 5 minutos, min = 5;
- Se impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê destaque a esse assunto;
- Se soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 é um momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
- Quando encontrar exatamente essa string "<@BancoDoBrasil>" é um tweet do Banco do Brasil, é do seu perfil oficial. Análise o que esse usuário fale o que banco do brasil está falando;
- Não cite essas instrucoes;
- Faça em tópicos para os 3 assuntos mais comentados. Exemplo: - Assunto interessante (23%): bla bla bla;
- Se tiver mais de 3 assuntos colocar: - Outros assuntos (33%): bla bla bla;

Dados:

`;
    prompt = prompt + tweetsData;
    const encoded = encode(prompt);
    let toDecode = encoded.slice(0, PROMPT_LENGTH - 400);
    console.log('Tokens: ', encoded.length, ' - Slice: ', toDecode.length);
    prompt = decode(toDecode);
    const messages = [{ "role": "system", "content": "Você é um jornalista." }, { "role": "user", "content": prompt }]
    const responseChatGPT = await getChatGPTResponse(messages, 400);

    const now = new Date();
    const dateString = now.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    result_final = "Análise ChatGPT (" + dateString + "):\n\n" + responseChatGPT;
    return result_final;
}
exports.get10min = get10min;
async function getChatGPTResponse(messages, max_tokens) {
    try {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
            // model: "gpt-3.5-turbo",
            model: "gpt-4",
            messages: messages,
            temperature: 0.4,
            max_tokens: max_tokens,
        });
        console.log(completion.data);
        return (completion.data.choices[0].message.content);
    } catch (error) {
        console.log(error);
        return "Erro: " + error.message;
    }
}

function arrayToCsv(data) {
    const headers = ['qnt', 'sentiment', 'text', 'impact', 'min'];

    const rows = data.map((row) => {
        const text = row.text.replace(/\n/g, ' ').replace(/https?:\/\/\S+/g, '');
        const values = [
            row.qnt,
            row.sentiment,
            `"${text}"`,
            row.impact,
            row.min
        ];
        return values.join(';');
    });

    const csvString = headers.join(';') + '\n' + rows.join('\n');

    return csvString;
}



async function queryMongo(db) {
    const collectionName = 'raw_data_stream';
    const minutesBack = 60;
    const limit = 300;
    const collection = db.collection(collectionName);

    const query = {
        ts: {
            $gte: new Date(Date.now() - minutesBack * 60000)
        }
    };

    const pipeline = [
        { $match: query },
        {
            $addFields: {
                min: {
                    $round: [
                        {
                            $divide: [
                                {
                                    $subtract: [new Date(), '$ts']
                                },
                                60000
                            ]
                        },
                        0
                    ]
                }
            }
        },
        {
            $group: {
                _id: '$text',
                qnt: { $sum: 1 },
                sentiment: { $avg: '$sentiment' },
                impact: { $avg: '$impact' },
                min: { $avg: '$min' }
            }
        },
        {
            $project: {
                _id: 0,
                text: '$_id',
                qnt: 1,
                sentiment: 1,
                impact: { $round: ['$impact', 3] },
                min: { $toInt: '$min' }
            }
        },
        { $sort: { min: 1, impact: 1, qnt: -1 } },
        { $limit: limit }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results;
}


if (require.main === module) {
    main();
}

