require("dotenv").config();
const needle = require("needle");
const { MongoClient } = require("mongodb");
const sentiment = require("sentiment-multi-language");
const keyword_extractor = require("keyword-extractor");
const io = require("socket.io-client");
const relevance = require("./relevance");
const temperature = require("./temperature");
var _ = require("lodash");
const TOKEN = process.env.TW_BEARER;
//Twitter`s API doc: https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/api-reference/get-tweets-search-stream
const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=author_id,public_metrics&expansions=author_id&user.fields=username";


let socketTelegram = null;
function keepAliveTelegram() {
  socketTelegram = io(`ws://${process.env.TELEGRAM_SERVER}:8000`);
  console.log("Connecting to telegram-server...");
  socketTelegram.on("connect", () => {
    console.log(`Connected to telegram-server: ${socketTelegram.id}`);
  });
  socketTelegram.on("disconnect", () => {
    console.log("Disconnected from telegram-server");
  });
  socketTelegram.on("connect_error", (error) => {
    console.log("Connection telegram-server error");
    console.log("Trying again in 5 seconds...");
    // setTimeout(() => {
    //   keepAliveTelegram();
    // }, 5000);
  });
}

const rules = [
  {
    value: '"banco do brasil"',
    tag: "banco do brasil",
  },
  {
    value: "bb banco",
    tag: "banco do brasil",
  },
  {
    value: "bancodobrasil",
    tag: "bancodobrasil",
  },
  {
    value: "carteira bb",
    tag: "carteira bb",
  },
  {
    value: "carteirabb",
    tag: "carteira bb",
  },
];

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

// Get stream rules
async function getRules() {
  console.log("Getting rules");
  const response = await needle("get", rulesURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  return response.body;
}

// Set stream rules
async function setRules() {
  console.log("Setting rules");
  const data = {
    add: rules,
  };

  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

// Delete stream rules
async function deleteRules(rules) {
  console.log("Deleting rules");
  if (!Array.isArray(rules.data)) {
    return null;
  }

  const ids = rules.data.map((rule) => rule.id);

  const data = {
    delete: {
      ids: ids,
    },
  };

  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}
var options = {
  extras: {
    stress: -3,
    estressou: -3,
    stressa: -3,
    estressa: -3,
    stressado: -2,
    stressada: -2,
    desfalque: -2,
    demoraram: -1,
    demorou: -1,
    demoram: -1,
    paciência: -1,
    ódio: -3,
    odeio: -3,
    sofro: -2,
    sofrer: -2,
    sofri: -2,
    sofremos: -2,
    fraude: -2,
    golpe: -2,
    bosta: -2,
    merda: -2,
    porra: -2,
    vtnc: -4,
    fudido: -2,
    fudidos: -2,
    fudida: -2,
    fudidas: -2,
    morrer: -1,
    morreu: -1,
    morrendo: -1,
    trafico: -1,
    tráfico: -1,
    estressar: -1,
    estresse: -1,
    inferno: -1,
    procon: -1,
    ouvidoria: -2,
    bacen: -1,
    fora: -4,
    ar: -3,
    caindo: -2,
    cair: -2,
    caiu: -3,
    inacessível: -2,
    inacessivel: -2,
    humilhar: -2,
    problema: -1,
    inoperante: -3,
    fdp: -2,
    pqp: -2,
    pior: -4,
    lixo: -2,
    falha: -2,
    dificil: -1,
    travar: -2,
    travando: -2,
    indisponibilidade: -3,
  },
};

let sumScore = 0;
let stream = null;
console.time("recycled in");
function streamTweets() {
  console.timeEnd("recycled in");
  setTimeout(recycle, 1000 * 60 * 10);
  // setInterval(() => (sumScore = 0), 60 * 60 * 1000);
  console.log("Streaming tweets...");
  stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  let countTweets = 0;

  stream.on("data", async (data) => {
    try {
      if (data.title) {
        console.log(data);
      }
      // console.log(data);
      let json = JSON.parse(data);
      if (json.data.author_id != "83723557") {
        // console.dir(json, { depth: null });
        let r1 = sentiment(json.data.text, "pt-br", options);
        let userRelevance = await relevance.relevance(
          db,
          json.includes.users[0].username
        );
        if (userRelevance.relevance == "NaN") {
          userRelevance.relevance = 0;
        }
        userRelevance.relevance = parseFloat(userRelevance.relevance);
        let temperatureScore = await temperature.getHourSentiment(db);
        if (temperatureScore != null) {
          sumScore = temperatureScore.sum + r1.score;
        } else {
          sumScore = r1.score;
        }
        //Calculo do impacto
        let relevanceFixed = userRelevance.relevance;
        if (relevanceFixed < 0.1) {
          relevanceFixed = 0.1;
        }
        let impact = parseFloat(relevanceFixed);
        if (sumScore < 0) {
          impact = parseFloat(relevanceFixed * -1);
        }
        if (r1.score != 0) {
          impact = parseFloat(Math.abs(relevanceFixed) * r1.score);
        }
        if (impact < 0.1 && impact >= 0) {
          impact = 0.1;
        } else if (impact > -0.1 && impact < 0) {
          impact = -0.1;
        }
        //

        let msg = `(${r1.score}/${sumScore})(${userRelevance.relevance.toFixed(
          3
        )}/${impact.toFixed(3)}) @${userRelevance.user}: ${json.data.text
          } - https://twitter.com/u/status/${json.data.id}`;
        console.log(msg);
        if (impact >= 10 || impact <= -10 || relevanceFixed >= 5) {
          socketTelegram.emit("alertRelevant", msg);
        }

        // socketTelegram.emit("alertRelevant", msg);
        // let hasSibling = await temperature.hasSibling(db, json.data.id);
        json.data.ts = new Date();
        json.data.user_relevance = userRelevance.relevance;
        json.data.impact = parseFloat(impact);
        json.data.sentiment = r1.score;
        json.data.fullSentiment = r1;
        const extraction_result = keyword_extractor.extract(json.data.text, {
          language: "portuguese",
          remove_digits: true,
          return_changed_case: true,
          remove_duplicates: false,
        });
        json.data.words = extraction_result;
        insertMany([json.data]);
        ++countTweets;
      } else {
        console.log(`(BB): ${json.data.text}`);
      }
    } catch (error) {
      // console.log(error);
      // if (error.title) {
      //   console.log(error);
      // }
    }
  });
  stream.on("connected", () => console.log("Stream is started."));
}
async function recycle() {
  if (stream) {
    console.time("recycled in");
    console.log("Recycling...");
    await stream.request.abort();
    setTimeout(streamTweets, 200);
  }
}
let db = null;
(async () => {
  let currentRules;
  try {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("twitter");
    //getHourSentiment();
    console.log("Mongo connected");
    // temperature.getHourWords(db);
    currentRules = await getRules();
    await deleteRules(currentRules);
    currentRules = await setRules();
    console.log(currentRules);
    keepAliveTelegram();
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
  //cron.schedule(cronStr, rescycle());
  streamTweets();
})();

async function insertMany(data) {
  const options = { ordered: true };
  const result = await db
    .collection("raw_data_stream")
    .insertMany(data, options);
  return result;
}

// async function getHourWords(db) {
//   let words = await db
//     .collection("tw_timeline")
//     .find({
//       ts: {
//         $gt: new Date(new Date().getTime() - 1000 * 60 * 60 * 1),
//       },
//     })
//     .toArray();

//   let totalWords = [];
//   for (let i = 0; i < words.length; i++) {
//     let word = words[i];
//     totalWords = totalWords.concat(word.words);
//   }
//   // console.log({totalWords})
//   let wordsCounted = _.countBy(totalWords);
//   let finalWords = [];
//   for (const [key, value] of Object.entries(wordsCounted)) {
//     if (
//       !key.includes("banco") &&
//       key != "rt" &&
//       key != "bb" &&
//       key != "dm" &&
//       !key.includes("brasil")
//     ) {
//       finalWords.push({ word: key, count: value });
//     }
//   }
//   let result = _.orderBy(finalWords, ["count"], ["desc"]);
//   console.dir(result, { depth: null });
//   return result;
// }

// async function getHourSentiment() {
//   //console.log("getHourSentiment");
//   const result = await db
//     .collection("tw_timeline")
//     .aggregate([
//       {
//         $match: {
//           ts: {
//             $gt: new Date(new Date().getTime() - 1000 * 60 * 60),
//           },
//         },
//       },
//       { $group: { _id: "$id", sum: { $sum: "$sumSentiment" } } },
//     ])
//     .toArray();
//   //console.log(result[0].sum);
//   return result[0].sum;
// }
