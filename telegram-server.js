const io = require("socket.io")();
const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const _ = require("lodash");
const moment = require("moment");
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.TELEGRAM_DEV_TOKEN, { polling: true });

let db = null;

async function connectMongo() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");
  return db;
}

async function getHourWords() {
  const hours = 1;
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

async function searchWords() {
  const result = await db
    .collection("raw_data_stream")
    .find(
      { $or: [{ text: /aplicativo/ }, { text: /app/ }] },
      { projection: { sentiment: 1, text: 1, ts: 1, _id: 0 } }
    )
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

async function searchWordsMatch(match) {
  let regex = new RegExp(match[1], "i");
  let query = { $or: [{ text: regex }] };
  // console.log(query);
  let result = await db
    .collection("raw_data_stream")
    .find(query, { projection: { sentiment: 1, text: 1, ts: 1, _id: 0 } })
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

function alertTemp(data) {
  let [count, temperature, sumSentiment, resultWordsStr] = data;
  const chatId = "@bb_alert_tw";
  const resp = `*TW Alerta de mudança de temperatura do twitter*\n
Temperatura do minuto: ${sumSentiment}
Quantidade de tweets: ${count}
Temp. media do minuto: ${parseFloat(temperature).toFixed(2)}
Palavras: ${resultWordsStr}`;
  console.log(`Send to ${chatId}: ${resp}`);
  bot.sendMessage(chatId, resp, { parse_mode: "Markdown" });
}

bot.onText(/\/f (.+)/, (msg, match) => {
  if (db != null) sendSearch(msg, match);
});

bot.onText(/\/search (.+)/, (msg, match) => {
  if (db != null) sendSearch(msg, match);
});

bot.onText(/\/status/, (msg) => {
  if (db != null) sendStatus(msg);
});

bot.onText(/\/app/, (msg) => {
  if (db != null) sendApp(msg);
});
bot.onText(/\/last/, (msg) => {
  if (db != null) sendSearch(msg, ["", " "]);
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Hi! 👋", { parse_mode: "Markdown" });
});
bot.on("callback_query", (query) => {
  bot.answerCallbackQuery(query.id, () => {
    console.log("ooi");
  });
});

async function sendSearch(msg, match) {
  const chatId = msg.chat.id;
  let words = await searchWordsMatch(match);
  if (match[1] != "*") {
    let strFinalApp = `Result for search: ${match[1]}\n\n`;
    words.forEach((tweet) => {
      strFinalApp += `● (${moment(tweet.ts).format(
        "DD/MM HH:mm:ss"
      )}) ${tweet.text.normalize("NFD").replace(/[^\x00-\x7F]/g, "")}\n-\n`;
    });
    console.log(`Sending to ${chatId}: ${strFinalApp}`);
    const opts = {
      disable_web_page_preview: true,
      reply_to_message_id: msg.message_id,
      reply_markup: JSON.stringify({
        inline_keyboard: [[{ text: "more", callback_data: "hello" }]],
        one_time_keyboard: true,
      }),
    };
    bot.sendMessage(chatId, strFinalApp, opts);
  }
}

async function sendApp(msg) {
  const chatId = msg.chat.id;
  let words = await searchWords();
  let strFinalApp = "Result for search: app\n\n";
  words.forEach((tweet) => {
    strFinalApp += `● (${moment(tweet.ts).format(
      "DD/MM HH:mm:ss"
    )}) ${tweet.text.normalize("NFD").replace(/[^\x00-\x7F]/g, "")}\n\n`;
  });

  const opts = {
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id,
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: "more", callback_data: "hello" }]],
      one_time_keyboard: true,
    }),
  };
  console.log(`Sending to ${chatId}: ${strFinalApp}`);
  bot.sendMessage(chatId, strFinalApp, opts);
}

async function sendStatus(msg) {
  const chatId = msg.chat.id;
  let hourSentiment = await getHourSentiment();
  let hourWords = await getHourWords();
  let resultWordsStr = "";
  for (let index = 0; index < hourWords.length; index++) {
    const word = hourWords[index];
    resultWordsStr += `   ${word.word} (${word.count})\n`;
  }
  let strFinal = `Twitter\`s Sentiment Temperature\n\nSentiment: ${
    hourSentiment.sum
  } ${getSignalEmoji(hourSentiment.sum)}\n\nWords:\n${resultWordsStr}`;
  console.log(`Sending to ${chatId}: ${strFinal}`);
  bot.sendMessage(chatId, strFinal, { disable_web_page_preview: true });
}

async function init() {
  io.on("connection", async (client) => {
    console.log("New client connected");
    client.emit("welcome", "welcome man");
    client.on("alertTemp", (data) => {
      alertTemp(data);
    });
  });
  io.listen(8000);
  await connectMongo();
  console.log("Bot Telegram UP");
}
init();
