const http = require("http");
const path = require("path");
const needle = require("needle");
const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
const sentiment = require("sentiment-multi-language");
const keyword_extractor = require("keyword-extractor");
var _ = require("lodash");
const TOKEN = process.env.TW_BEARER;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics";

//const rules = [{ value: '"banco do brasil"' }];

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
];
//console.log(TOKEN);

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
    inacessível: -2,
    inacessivel: -2,
    humilhar: -2,
    problema: -1,
    inoperante: -3,
    fdp: -2,
    pqp: -2,
  },
};
let isCoolDown = false;
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
      //console.log(data);
      if (data.title) {
        console.log(data);
      }
      const json = JSON.parse(data);
      //console.log(json);
      var r1 = sentiment(json.data.text, "pt-br", options);
      sumScore = (await getHourSentiment()) + r1.score;
      console.log(`(${r1.score}/${sumScore}): ${json.data.text}`);
      // console.log(countWords(json.data.text));

      json.data.ts = new Date();
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
    } catch (error) {
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
    getHourWords(db);
    currentRules = await getRules();
    await deleteRules(currentRules);
    currentRules = await setRules();
    console.log(currentRules);
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

async function getHourWords(db) {
  let words = await db
    .collection("tw_timeline")
    .find({
      ts: {
        $gt: new Date(new Date().getTime() - 1000 * 60 * 60 * 1),
      },
    })
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
      key != "rt" &&
      key != "bb" &&
      key != "dm" &&
      !key.includes("brasil")
    ) {
      finalWords.push({ word: key, count: value });
    }
  }
  let result = _.orderBy(finalWords, ["count"], ["desc"]);
  console.log(result);
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
      { $group: { _id: "$id", sum: { $sum: "$sumSentiment" } } },
    ])
    .toArray();
  //console.log(result[0].sum);
  return result[0].sum;
}
