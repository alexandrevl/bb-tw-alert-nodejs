const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/escalinha?authSource=admin`;
const client = new MongoClient(url);
const _ = require("lodash");
const moment = require("moment");
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chatgpt = require("./chatgpt");

let db = null;
const CALLBACK_TYPE_TRI = 0;
const APP = 1;
const LIMIT_TELEGRAM = 80;

async function connectMongo() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("escalinha");
  console.log("Mongo connected");
  return db;
}
bot.onText(/\/f/, async (msg, match) => {
  console.log(msg.from.username, match);
  if (match.input == "/f") {

    const chatId = msg.chat.id;
    const opts = {
      disable_web_page_preview: true,
      reply_to_message_id: msg.message_id,
    };
    const finalMsg = "Use /f F0000000";
    console.log(`${msg.from.username}: ${finalMsg.replaceAll("\n", " | ")}`);
    // chatgpt.getChatMsg(msg.from.username, db, bot, chatId, opts, finalMsg);
    bot.sendMessage(chatId, finalMsg, opts);

  }
});

bot.onText(/\/f (.+)/, async (msg, match) => {
  // console.log(match);
  if (db != null) {
    const chatId = msg.chat.id;
    const opts = {
      disable_web_page_preview: true,
      reply_to_message_id: msg.message_id,
    };
    if (match[1]) {
      let matricula = match[1].toUpperCase();
      let dtNow = moment().format("YYYY-MM-DD");
      let escala = await db
        .collection("escalas")
        .find({
          $and: [{ matricula: matricula }, { data: { $gte: dtNow } }],
        })
        .limit(10)
        .sort({ data: 1 })
        .toArray();
      let finalMsg = `Datas futuras de TRI híbrido:\n\n`;
      if (escala.length > 0) {
        for (let index = 0; index < escala.length; index++) {
          const outItem = escala[index];
          if (!outItem.undefined) {
            let data = moment(outItem.data).format("DD/MM/YYYY");
            finalMsg += `${data} - ${outItem.dia}\n`;
          }
        }
        chatResponse = await chatgpt.getChatMsg(matricula, db);
        finalMsg = finalMsg + "\n" + chatResponse;
      } else {
        chatResponse = await chatgpt.chatGPTNullResponse(db)
        finalMsg = `Não foram encontradas datas futuras de TRI híbrido para essa matrícula.`;
        finalMsg = finalMsg + "\n" + chatResponse;
      }
      console.log(`${msg.from.username}: ${finalMsg.replaceAll("\n", " | ")}`);
      bot.sendMessage(chatId, finalMsg, opts);
    } else {
      const finalMsg = "Use /f F0000000";
      console.log(`${msg.from.username}: ${finalMsg.replaceAll("\n", " | ")}`);
      bot.sendMessage(chatId, finalMsg, opts);
    }
  }
});

bot.on("callback_query", (query) => {
  // console.log(query.data);
  try {
    let data = JSON.parse(query.data);
    if (data.f == CALLBACK_TYPE_TRI) {
      let skip = parseInt(data.s) + LIMIT_TELEGRAM;
      console.log(skip);
      if (db != null) triList(query.message, skip);
    }
  } catch (error) {
    console.log(error);
  }

  // console.log(query.from.id);
});
bot.onText(/\/list/, async (msg) => {
  if (db != null) triList(msg, 0);
});
async function triList(msg, skip) {
  const chatId = msg.chat.id;
  const optsButton = {
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id,
    one_time_keyboard: true,
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "mais dias",
            callback_data: JSON.stringify({
              f: CALLBACK_TYPE_TRI,
              s: skip,
            }),
          },
        ],
      ],
    },
  };
  const optsClean = {
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id,
    parse_mode: "MarkdownV2",
  };
  let opts = optsClean;
  let escala = await getEscala(skip);
  let finalMsg = `\`\`\` -> Datas futuras de TRI híbrido:\n`;
  if (escala.length > 0) {
    if (escala.length < LIMIT_TELEGRAM) {
      opts = optsClean;
    } else {
      opts = optsButton;
    }
    let dataOld = 0;
    for (let index = 0; index < escala.length; index++) {
      const outItem = escala[index];
      if (!outItem.undefined) {
        let data = moment(outItem.data).format("DD/MM");
        if (data != dataOld) {
          finalMsg += `${data} - ${outItem.dia}\n`;
          dataOld = data;
        }
        let nome = outItem.nome;
        if (nome.length > 20) nome = nome.substring(0, 20) + "...";
        finalMsg += `\t\t${outItem.matricula} - ${nome}\n`;
      }
    }
    finalMsg += `\`\`\``;
    // console.log(finalMsg);
  } else {
    finalMsg = `Não foram encontradas datas futuras de TRI híbrido.`;
  }
  bot.sendMessage(chatId, finalMsg, opts);
  // console.log(`${msg.from.username}: ${finalMsg.replaceAll("\n", " | ")}`);
}
async function getEscala(skip) {
  let dtNow = moment().format("YYYY-MM-DD");
  let escala = await db
    .collection("escalas")
    .find({
      data: { $gte: dtNow },
    })
    .skip(skip)
    .limit(LIMIT_TELEGRAM)
    .sort({ data: 1 })
    .toArray();
  return escala;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Hi! 👋", { parse_mode: "Markdown" });
});

async function init() {
  await connectMongo();
  console.log("Escalinha Bot Telegram UP");
}
init();
