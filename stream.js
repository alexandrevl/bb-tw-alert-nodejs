const http = require("http");
const path = require("path");
const needle = require("needle");
const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
const sentiment = require("sentiment-multi-language");
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
  },
};
let isCoolDown = false;
let sumScore = 0;
let stream = null;
function streamTweets() {
  setTimeout(recycle, 1000 * 60 * 120);
  setInterval(() => (sumScore = 0), 60 * 1000);
  console.log("Streaming tweets...");
  stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  let countTweets = 0;
  stream.on("data", (data) => {
    try {
      //console.log(data);
      if (data.title) {
        console.log(data);
      }
      const json = JSON.parse(data);
      //console.log(json);
      var r1 = sentiment(json.data.text, "pt-br", options);
      sumScore += r1.score;
      console.log(`(${r1.score}/${sumScore}): ${json.data.text}`);
      // console.log(countWords(json.data.text));

      json.data.ts = new Date();
      json.data.sentiment = r1.score;
      json.data.fullSentiment = r1;
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
    console.log("Recycling...");
    await stream.request.abort();
    setTimeout(streamTweets, 1000 * 2);
  }
}
let db = null;
(async () => {
  let currentRules;
  try {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("twitter");
    console.log("Mongo connected");
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
