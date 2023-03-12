require("dotenv").config();
const moment = require("moment");
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const { Configuration, OpenAIApi } = require("openai");
const { encode, decode } = require('gpt-3-encoder')

const PROMPT_LENGTH = 4400;
async function connectMongo() {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("escalinha");
    console.log("Mongo connected");
    return db;
}

async function main() {
    try {
        db = await connectMongo();
        console.log("Getting ChatGPT response...")
        const response = await chatGPTNullResponse();
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

async function chatGPTNullResponse() {
    let prompt = `Infelizmente o funcionário não está na escala de home office nesse momento. Mas já na semana que vem, ou até nessa semana poderá ter um dia. Crie uma mensagem para anamimá-lo, super curta, máximo 500 caracteres. Não use hashtags.`;
    const encoded = encode(prompt);
    let toDecode = encoded.slice(0, PROMPT_LENGTH - 200);
    console.log('Tokens: ', encoded.length, ' - Slice: ', toDecode.length);
    prompt = decode(toDecode);
    const messages = [{ "role": "system", "content": "Você é um jornalista." }, { "role": "user", "content": prompt }]
    const responseChatGPT = await getChatGPTResponse(messages, 200);
    return "ChatGPT: " + responseChatGPT;
}
exports.chatGPTNullResponse = chatGPTNullResponse;


async function getChatMsg(matricula, db) {
    const resultsMongo = await queryMongo(matricula, db);
    const tweetsData = arrayToCsv(resultsMongo);
    let prompt = `Essa é a escala dos próximos dias de home office de uma pessoa em nossa empresa.
 
    Faça uma mensagem para essa pessoa, super curta, máximo 500 caracteres. Não use hashtags. Comente sobre as datas, contando alguma curiosidade que aconteceu naquela data durante a história, ou algo interessante sobre esse dia. O objetivo é valorizar o home office.
    
    Sempre cite as datas.
    Comente sobre os dias, contando alguma curiosidade.
 
Datas:
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
exports.getChatMsg = getChatMsg;
async function getChatGPTResponse(messages, max_tokens) {
    try {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 1,
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
    const headers = ['data', 'dia'];

    const rows = data.map((row) => {
        const values = [
            row.data,
            row.dia,
        ];
        return values.join(';');
    });

    const csvString = headers.join(';') + '\n' + rows.join('\n');

    return csvString;
}


async function queryMongo(matricula, db) {
    let dtNow = moment().format("YYYY-MM-DD");
    let escala = await db.collection("escalas").find({
        $and: [{ matricula: matricula }, { data: { $gte: dtNow } }],
    })
        .limit(10)
        .project({ _id: 0, data: 1, dias: 1 })
        .sort({ data: 1 })
        .toArray();
    return escala;
}


if (require.main === module) {
    main();
}