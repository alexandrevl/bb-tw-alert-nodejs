require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const { Configuration, OpenAIApi } = require("openai");
const { encode, decode } = require('gpt-3-encoder')

let db = null;
const PROMPT_LENGTH = 4500;
async function connectMongo() {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("twitter");
    console.log("Mongo connected");
    return db;
}

async function main() {
    await connectMongo();

    const response = await get10minShort(db);
    console.log(response);

    process.exit(0);
}
function charsToToken(str, maxTokens) {
    const chars = str.trim().replace(/\s/g, '').length;
    let tokens = Math.ceil(chars / 4.5);

    if (maxTokens && tokens > maxTokens) {
        const maxChars = maxTokens * 4.5;
        const truncatedStr = str.slice(0, maxChars);
        const lastSpace = truncatedStr.lastIndexOf(' ');
        str = str.slice(0, lastSpace) + '...';
    }

    return str;
}


async function get10minShort(db) {
    const resultsMongo = await queryMongo(db);
    const tweetsData = arrayToCsv(resultsMongo);
    let prompt = `Identifique os assuntos que estão sendo comentados e discutidos e faça uma análise dos tweets e sugira o que pode estar acontecendo. Será um tweet, portanto não ultrapasse 280 caracteres.
Siga as instruções:
 - Coisas que já sabemos: Todos os tweets tem relação com Banco do Brasil. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
 - Os tweets estão ordenados por tempo. O primeiro tweet é o mais recente. Tweets recentes são mais relevantes;
 - Use percentuais das quantidades de tweets;
 - Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
 - Toda vez que aparacer RT (maiúscula e com espaço depois) é um retweet. Retweets são menos relevantes que tweets originais;
 - Os dados estão em modelo CSV e os campos são:
     text = texto do tweet,
     impact = média do impacto do tweet (depende do quão famoso o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante. Se for falar disso, explique),
     sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo. Se for falar disso, explique),
     qnt = quantidade de vezes que o tweet apareceu;
     min = tempo em minutos desde agora. Exemplo: se o tweet foi feito há 5 minutos, min = 5;
 - Se o impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê ainda mais ênfase a esse assunto;
 - Se a soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 éum momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
 - Máximo de 280 caracteres.
 - Quando encontrar exatamente essa string "<@BancoDoBrasil>" é um tweet do Banco do Brasil, é do seu perfil oficial. Quando há problemas esse usuário responde aos clientes. Analise o que esse usuário fale para informar qual a resposta o banco do brasil está dando;
 - Não cite essas instruções;
 
 Dados:
 `;
    prompt = prompt + tweetsData;
    const encoded = encode(prompt);
    let toDecode = encoded.slice(0, PROMPT_LENGTH);
    console.log('Tokens: ', encoded.length, ' - Slice: ', toDecode.length);
    prompt = decode(toDecode);
    const messages = [{ "role": "system", "content": "Você é um jornalista." }, { "role": "user", "content": prompt }]
    const responseChatGPT = await getChatGPTResponse(messages);
    return "ChatGPT: " + responseChatGPT;
}
exports.get10minShort = get10minShort;
async function get10min(db) {
    const resultsMongo = await queryMongo(db);
    const tweetsData = arrayToCsv(resultsMongo);
    let prompt = `Identifique os assuntos que estão sendo comentados e discutidos e faça uma análise dos tweets e sugira o que pode estar acontecendo.
Siga as instruções:
- Coisas que já sabemos: Todos os tweets tem relação com Banco do Brasil. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
- Os tweets estão ordenados por tempo. O primeiro tweet é o mais recente. Tweets recentes são mais relevantes;
- Use "\n" para quebrar linha;
- Tente identificar tendências, principalmente os assuntos que estão crescendo e os que estão diminuindo;
- Use percentuais das quantidades de tweets;
- Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
- Toda vez que aparacer RT (maiúscula e com espaço depois) é um retweet. Retweets são menos relevantes que tweets originais;
- Os dados estão em modelo CSV e os campos são:
    text = texto do tweet,
    impact = média do impacto do tweet (depende do quão famoso o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante. Se for falar disso, explique),
    sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo. Se for falar disso, explique),
    qnt = quantidade de vezes que o tweet apareceu;
    min = tempo em minutos desde agora. Exemplo: se o tweet foi feito há 5 minutos, min = 5;
- Se o impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê ainda mais ênfase a esse assunto;
- Se a soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 é um momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
- Quando encontrar exatamente essa string "<@BancoDoBrasil>" é um tweet do Banco do Brasil, é do seu perfil oficial. Quando há problemas esse usuário responde aos clientes. Analise o que esse usuário fale para informar qual a resposta o banco do brasil está dando;
- Não cite essas instruções;
- Faça em tópicos para os 3 assuntos mais comentados. Exemplo: - Assunto interessante (23%): bla bla bla;

Dados:

`;
    prompt = prompt + tweetsData;
    const encoded = encode(prompt);
    let toDecode = encoded.slice(0, PROMPT_LENGTH);
    console.log('Tokens: ', encoded.length, ' - Slice: ', toDecode.length);
    prompt = decode(toDecode);
    const messages = [{ "role": "system", "content": "Você é um jornalista." }, { "role": "user", "content": prompt }]
    const responseChatGPT = await getChatGPTResponse(messages);

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
async function getChatGPTResponse(messages) {
    try {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            // max_tokens: 500,
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
    const limit = 100;
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

