const http = require("http");
const path = require("path");
const needle = require("needle");
const config = require("dotenv").config();
const sentiment = require("sentiment-multi-language");
const TOKEN = process.env.TW_BEARER;

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics";

const rules = [{ value: '"banco do brasil"' }];
//console.log(TOKEN);

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
  },
};
let sumScore = 0;
function streamTweets() {
  console.log("Streaming tweets...");
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  stream.on("data", (data) => {
    try {
      // console.log(data);
      const json = JSON.parse(data);
      //console.log(json);
      var r1 = sentiment(json.data.text);
      console.log(`(${r1.score}): ${json.data.text}`);
      sumScore += r1.score;
      console.log(`Sentiment now: ${sumScore}`);
    } catch (error) {
      console.log(error);
    }
  });
}
(async () => {
  let currentRules;
  try {
    currentRules = await getRules();
    await deleteRules(currentRules);
    await setRules();
    currentRules = await getRules();
    console.log(currentRules);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
  streamTweets();
})();
