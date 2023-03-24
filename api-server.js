require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const _ = require("lodash");
var express = require("express");
var app = express();

let db = null;
const SERVER_PORT = 8005;

app.get("/temp", async (req, res) => {
  let hourSentiment = await getHourSentiment();
  let hourWords = await getHourWords();
  let result = {
    hourSentiment: hourSentiment.sum,
    hourWords: hourWords,
  };
  console.log(result);

  res.send(result);
});
app.get("/", async (req, res) => {
  let hourSentiment = await getHourSentiment();
  let hourWords = await getHourWords();
  let result = {
    hourSentiment: hourSentiment.sum,
    hourWords: hourWords,
  };
  // console.log(result);

  res.send(result);
});

app.get("/app", async (req, res) => {
  let result = await searchWords();
  // console.log(result);

  res.send(result);
});

var server = app.listen(SERVER_PORT, async () => {
  await connectMongo();
  console.log(`App listening at ${SERVER_PORT}`);
});

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
  console.log("searchWords");
  const result = await db
    .collection("raw_data_stream")
    .find(
      { $or: [{ text: /aplicativo/ }, { text: /app/ }] },
      { projection: { sentiment: 1, text: 1, ts: 1, _id: 0 } }
    )
    .limit(100)
    .sort({ _id: -1 })
    .toArray();
  //console.log(result[0].sum);
  return result;
}
