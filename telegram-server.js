require("dotenv").config();
const io = require("socket.io")();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const _ = require("lodash");
const moment = require("moment");
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const { spawn } = require('child_process');


let db = null;
const SEARCH = 0;
const APP = 1;

async function connectMongo() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");
  return db;
}

async function getHourWords() {
  const hours = 0.08;
  let qtWordsDisplay = 10;
  let words = await db
    .collection("raw_data_stream")
    .find(
      {
        ts: {
          $gt: new Date(new Date().getTime() - 1000 * 60 * 60 * hours),
        },
      },
      { projection: { _id: 0, words: 1 } }
    )
    .sort({ _id: -1 })
    .toArray();

  let totalWords = [];
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    totalWords = totalWords.concat(word.words);
  }
  // console.log({totalWords})
  let wordsCounted = _.countBy(totalWords);
  let finalWords = [];
  for (const [key, value] of Object.entries(wordsCounted)) {
    if (
      !key.includes("banco") &&
      key.length > 2 &&
      key != "pra" &&
      key != "pro" &&
      !key.includes("brasil")
    ) {
      finalWords.push({ word: key, count: value });
    }
  }
  let orderedFinalWords = _.orderBy(finalWords, ["count"], ["desc"]);
  if (qtWordsDisplay > orderedFinalWords.length) {
    qtWordsDisplay = orderedFinalWords.length;
  }
  let result = [];
  for (let i = 0; i < qtWordsDisplay; i++) {
    let word = orderedFinalWords[i];
    result.push(word);
  }
  return result;
}

async function getHourSentiment() {
  //console.log("getHourSentiment");
  const result = await db
    .collection("tw_timeline")
    .aggregate([
      {
        $match: {
          ts: {
            $gt: new Date(new Date().getTime() - 1000 * 60 * 60),
          },
        },
      },
      {
        $group: {
          _id: "$id",
          sum: { $sum: "$sumSentiment" },
        },
      },
    ])
    .toArray();
  //console.log(result[0].sum);
  return result[0];
}
async function getHourImpact() {
  const result = await db
    .collection("tw_timeline")
    .aggregate([
      {
        $match: {
          ts: {
            $gt: new Date(new Date().getTime() - 1000 * 60 * 60),
          },
        },
      },
      {
        $group: {
          _id: "$id",
          sum: { $sum: "$sumImpact" },
        },
      },
    ])
    .toArray();
  let sum = parseFloat(result[0].sum);
  if (sum == null || sum == undefined) {
    sum = 0;
  }
  return parseFloat(sum);
}

async function searchWords(skip) {
  const result = await db
    .collection("raw_data_stream")
    .find(
      { $or: [{ text: /aplicativo/ }, { text: /app/ }] },
      { projection: { sentiment: 1, text: 1, ts: 1, _id: 0 } }
    )
    .skip(skip)
    .limit(10)
    .sort({ _id: -1 })
    .toArray();
  //console.log(result[0].sum);
  return result;
}

function getSignalEmoji(sentiment) {
  let result = "🟢";
  if (sentiment < -40 && sentiment > -100) {
    result = "🟡";
  } else if (sentiment <= -100) {
    result = "🔴";
  }
  return result;
}
function getImpactEmoji(impact) {
  let result = "🟢";
  if (impact < -10 && impact > -30) {
    result = "🟡";
  } else if (impact <= -30) {
    result = "🔴";
  }
  return result;
}

async function searchWordsMatch(match, skip) {
  let query = {};
  if (match[1] == "*" || match[1] == " ") {
    match[1] = " ";
  } else {
    let regex = new RegExp(match[1], "i");
    query = { text: regex };
  }
  // console.log(query);
  let result = await db
    .collection("raw_data_stream")
    .find(query, { projection: { sentiment: 1, text: 1, ts: 1, _id: 0 } })
    .skip(skip)
    .limit(10)
    .sort({ _id: -1 })
    .toArray();
  // console.log(result);
  if (result.length <= 0) {
    result = [{ sentiment: 0, text: "", ts: 0 }];
  }
  // console.log(result);
  return result;
}

async function alertRelevant(msg) {
  const chatId = "@bb_alert_tw";
  console.log(`Sent to relevant tweet to ${chatId}: ${msg}`);
  bot.sendMessage(chatId, `⚠️ Relevant Tweet: ${msg}`);
}

async function alertTemp(msg) {
  const chatId = "@bb_alert_tw";
  let hourSentiment = await getHourSentiment();
  let hourWords = await getHourWords();
  let hourImpact = await getHourImpact();
  let resultWordsStr = "";
  for (let index = 0; index < hourWords.length; index++) {
    const word = hourWords[index];
    resultWordsStr += `   • ${word.word} (${word.count})\n`;
  }
  let strFinal = `Twitter\`s Sentiment Temperature\n\nSentiment: ${hourSentiment.sum
    } ${getSignalEmoji(hourSentiment.sum)}\n\nImpact: ${hourImpact
      .toFixed(1)
      .toLocaleString("pt-BR")} ${getImpactEmoji(
        hourImpact
      )}\n\nWords:\n${resultWordsStr}`;
  console.log(`Sent to ${chatId}: ${strFinal}`);
  bot.sendMessage(chatId, strFinal, { disable_web_page_preview: true });
}

bot.onText(/\/f (.+)/, (msg, match) => {
  if (db != null) sendSearch(msg, match, 0);
});

bot.onText(/\/search (.+)/, (msg, match) => {
  if (db != null) sendSearch(msg, match, 0);
});

bot.onText(/\/status/, (msg) => {
  if (db != null) sendStatus(msg);
});

bot.onText(/\/app/, (msg) => {
  if (db != null) sendApp(msg, 0);
});
bot.onText(/\/latest/, (msg) => {
  if (db != null) sendSearch(msg, ["", " "], 0);
});
bot.onText(/\/10min/, (msg) => {
  try {
    const chatId = msg.chat.id;
    console.log(`10min - ChatGPT - Start to: ` + chatId);
    const pythonProcess = spawn('python3', ['/usr/src/app/chatgpt.py']);
    bot.sendMessage(chatId, "Analisando dados... Aguarde...");
    let strFinalApp = "Não tivemos tweets nos últimos 10 minutos.";
    pythonProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      strFinalApp = data;
      console.log(`10min - ChatGPT - Final Response (${chatId}): ` + strFinalApp);
      bot.sendMessage(chatId, strFinalApp);
    });
  } catch (error) {
    console.log(error);
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Hi! 👋", { parse_mode: "Markdown" });
});
bot.on("callback_query", (query) => {
  // console.log(query.data);
  try {
    let data = JSON.parse(query.data);
    // console.log(data);
    if (data.f == 1) {
      let skip = parseInt(data.s) + 10;
      if (db != null) sendApp(query.message, skip);
    }
    if (data.f == 0) {
      let skip = parseInt(data.s) + 10;
      let match = ["", data.p];
      if (db != null) sendSearch(query.message, match, skip);
    }
  } catch (error) {
    console.log(error);
  }

  // console.log(query.from.id);
});

async function sendSearch(msg, match, skip) {
  const chatId = msg.chat.id;

  let strFinalApp = "";
  let words = await searchWordsMatch(match, skip);
  if (match[1] != "*" && words[0].ts != 0) {
    match[1] = match[1].slice(0, 39);
    console.log(
      `(search) Search to ${msg.from.username}: ${match[1] == " " ? "latest" : match[1]
      }`
    );
    strFinalApp = `Result for search: ${match[1]}\n\n`;
    words.forEach((tweet) => {
      strFinalApp += `● (${moment(tweet.ts).format(
        "DD/MM HH:mm:ss"
      )}) ${tweet.text.normalize("NFD").replace(/[^\x00-\x7F]/g, "")}\n\n`;
    });
    let opts = {
      disable_web_page_preview: true,
      reply_to_message_id: msg.message_id,
      one_time_keyboard: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "more tweets",
              callback_data: JSON.stringify({
                f: SEARCH,
                p: match[1],
                s: skip,
              }),
            },
          ],
        ],
      },
    };
    console.log(
      JSON.parse(opts.reply_markup.inline_keyboard[0][0].callback_data)
    );
    if (words.length < 10) {
      opts = {
        disable_web_page_preview: true,
        reply_to_message_id: msg.message_id,
      };
    }
    console.log(`(search) Sending to ${msg.from.username}`);
    bot.sendMessage(chatId, strFinalApp.slice(0, 4096), opts);
  } else {
    strFinalApp = "No results";
    bot.sendMessage(chatId, strFinalApp);
  }
  return true;
}

async function sendApp(msg, skip) {
  const chatId = msg.chat.id;
  let words = await searchWords(skip);
  console.log(`(app) Search to ${msg.from.username}`);
  let strFinalApp = `Result for search: app ${skip != 0 ? skip : ""}\n\n`;
  words.forEach((tweet) => {
    strFinalApp += `● (${moment(tweet.ts).format(
      "DD/MM HH:mm:ss"
    )}) ${tweet.text.normalize("NFD").replace(/[^\x00-\x7F]/g, "")}\n\n`;
  });

  const opts = {
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id,
    one_time_keyboard: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "more tweets",
            callback_data: JSON.stringify({
              f: APP,
              s: skip,
            }),
          },
        ],
      ],
    },
  };
  console.log(`(app) Sending to ${msg.chat.username}`);
  bot.sendMessage(chatId, strFinalApp, opts);
}

async function sendStatus(msg) {
  const chatId = msg.chat.id;
  console.log(`(status) Status to ${msg.from.username}`);
  let hourSentiment = await getHourSentiment();
  let hourWords = await getHourWords();
  let hourImpact = await getHourImpact();
  let resultWordsStr = "";
  for (let index = 0; index < hourWords.length; index++) {
    const word = hourWords[index];
    resultWordsStr += `   • ${word.word} (${word.count})\n`;
  }
  let strFinal = `Twitter\`s Sentiment Temperature\n\nSentiment: ${hourSentiment.sum
    } ${getSignalEmoji(hourSentiment.sum)}\n\nImpact: ${hourImpact
      .toFixed(1)
      .toLocaleString("pt-BR")} ${getImpactEmoji(
        hourImpact
      )}\n\nWords:\n${resultWordsStr}`;
  console.log(`Sending to ${msg.chat.username}: ${strFinal}`);
  bot.sendMessage(chatId, strFinal, {
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id,
  });
}

async function init() {
  io.on("connection", async (client) => {
    console.log(`New client connected ${client.id}`);
    client.emit("welcome", "welcome man");
    client.on("alertTemp", (data) => {
      alertTemp(data);
    });
    client.on("alertRelevant", (data) => {
      alertRelevant(data);
    });
  });
  io.on("disconnect", () => {
    console.log(`Client disconnected ${client.id}`);
  });
  io.listen(8000);
  await connectMongo();
  console.log("Bot Telegram UP");
}
init();
