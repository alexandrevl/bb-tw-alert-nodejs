#!  node
require("dotenv").config();
const _ = require("lodash");
const needle = require("needle");
const { MongoClient } = require("mongodb");
let cron = require("node-cron");
const io = require("socket.io-client");

const AVG_SENTIMENT_ALERT = -3;
const SUM_SENTIMENT_ALERT = -15;
const COUNT_ALERT = 8;
const TEAMS_URL = process.env.TEAMS_URL;
const MINUTES = 1;

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

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

let db = null;
async function check() {
  console.log("Checking temperature...");
  console.time("checked in");
  let tweetsArray = await compileTweets();
  let analysedTweets = await analyse(tweetsArray);
  console.timeEnd("checked in");
  return analysedTweets;
}
async function analyse(tweets) {
  for (let index = 0; index < tweets.length; index++) {
    let tw = tweets[index];
    if (index === 0) {
      if (
        (tw.avgSentiment < AVG_SENTIMENT_ALERT && tw.count >= COUNT_ALERT) ||
        tw.sumSentiment < SUM_SENTIMENT_ALERT
      ) {
        console.log(
          `Changes in sentiments (Count: ${tw.count}/SumSentiment: ${tw.sumSentiment})`
        );
        let hourWords = await getHourWords(db);
        let resultWordsStr = "";
        for (let index = 0; index < hourWords.length; index++) {
          const word = hourWords[index];
          resultWordsStr += `${word.word} (${word.count}) `;
        }
        socketTelegram.emit("alertTemp", [
          tw.count,
          tw.avgSentiment,
          tw.sumSentiment,
          resultWordsStr,
        ]);
        // await sendMsgTeams(
        //   tw.count,
        //   tw.avgSentiment,
        //   tw.sumSentiment,
        //   resultWordsStr
        // );
      }
    }
  }
  return tweets;
}

async function compileTweets() {
  let results = [];
  for (let index = 0; index < MINUTES; index++) {
    let tws = await checkMinutes(index);
    let hour = await getHourSentiment(db);
    if (hour == null) {
      hour = { sum: 0 };
    }
    let tw = {
      minute: index + 1,
      count: tws.length,
      sumSentiment: 0,
      sumImpact: 0,
      sumRelevance: 0,
      avgSentiment: 0,
      hourSentiment: hour.sum,
      ts: new Date(),
      words: [],
    };
    let sumSentiment = 0;
    let sumImpact = 0;
    let sumRelevance = 0;
    if (tws.length > 0) {
      for (let i = 0; i < tws.length; i++) {
        const twIntern = tws[i];
        //tw.words.push(...twIntern.fullSentiment.tokens);
        sumSentiment += twIntern.sentiment;
        sumImpact += twIntern.impact;
        sumRelevance += twIntern.user_relevance;
      }
    }
    if (isNaN(sumImpact)) {
      sumImpact = 0;
    }
    if (sumSentiment != 0) {
      tw.sumSentiment = sumSentiment;
      tw.avgSentiment = sumSentiment / tw.count;
    }
    if (sumImpact != 0) {
      tw.sumImpact = sumImpact;
    }
    if (sumRelevance != 0) {
      tw.sumRelevance = sumRelevance;
    }

    tw.words = await getHourWords(db);
    // tw.words = _.countBy(tw.words);
    // let resultWord = [];
    // for (let index = 0; index < tw.words.length; index++) {
    //   const element = tw[index];
    //   console.log(element);
    //   if (element.sentiment != 0) {
    //     resultWord.push(element);
    //   }
    // }
    // tw.words = resultWord.words;
    // tw.words = _.sortBy(tw.words);
    // console.log(tw.words);
    // tw.words = _.countBy(tw.words)._invert()._sortBy().value();
    // console.log(tw.words);
    tw.hourSentiment = hour.sum + tw.sumSentiment;
    results.push(tw);
  }
  //   console.log(tweets);
  return results;
}
async function checkMinutes(minutes) {
  //   const result = await db.collection("raw_data_stream").find({}).toArray();
  const result = await db
    .collection("raw_data_stream")
    .find({
      $and: [
        { ts: { $lte: new Date(new Date().getTime() - minutes * 60 * 1000) } },
        {
          ts: {
            $gt: new Date(new Date().getTime() - (minutes + 1) * 60 * 1000),
          },
        },
      ],
    })
    .toArray();
  return result;
}
// async function sendMsgTeams(count, temperature, sumSentiment, resultWordsStr) {
//   console.log("Sending msg to Teams");
//   const data = {
//     "@type": "MessageCard",
//     "@context": "http://schema.org/extensions",
//     themeColor: "0076D7",
//     summary: "Temperatura Twitter",
//     sections: [
//       {
//         activityTitle: "Alerta de mudança de temperatura do twitter",
//         activitySubtitle:
//           'Os dados coletados são da combinação de palavras "banco do brasil"',
//         facts: [
//           {
//             name: "Temperatura do minuto",
//             value: sumSentiment,
//           },
//           {
//             name: "Quantidade tweets",
//             value: count,
//           },
//           {
//             name: "Temp média do minuto",
//             value: temperature,
//           },
//           {
//             name: "Link",
//             value:
//               "https://twitter.com/search?q=%22banco%20do%20brasil%22&f=live",
//           },
//           {
//             name: "Palavras relacionadas",
//             value: resultWordsStr,
//           },
//         ],
//         markdown: true,
//       },
//     ],
//   };

//   const response = await needle("post", TEAMS_URL, data, {
//     headers: {
//       "content-type": "application/json",
//     },
//   });
//   return response;
// }
async function connectMongo() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");
  return db;
}
async function main() {
  db = await connectMongo();
  console.log(`AvgSentiment Alert: ${AVG_SENTIMENT_ALERT}`);
  console.log(`SumSentiment Alert: ${SUM_SENTIMENT_ALERT}`);
  //Cron
  let cronStr = "* * * * *";

  // c = await compileHour();
  // console.log(c);

  //console.log(`Cron: ${cronStr}`);
  cron.schedule(cronStr, async () => {
    //console.log(`Cron: ${cronStr}`);
    let timeline = await check();
    // timeline.ts = new Date();
    // timeline.hourSentiment = await getHourSentiment();
    await insertMany(timeline);
    console.log(timeline[0]);
    //console.log(`Cron: done`);
  });
  keepAliveTelegram();
  //   await check();
}
if (require.main === module) {
  main();
}

async function insertMany(data) {
  const options = { ordered: true };
  const result = await db.collection("tw_timeline").insertMany(data, options);
  return result;
}

async function getHourWords(db) {
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
exports.getHourWords = getHourWords;

async function getHourSentiment(db) {
  // console.log("getHourSentiment");
  const result = await db
    .collection("tw_timeline")
    .aggregate([
      {
        $match: {
          ts: {
            $gt: new Date(new Date().getTime() - 1000 * 60 * 5),
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
  // console.log(result);
  return result[0];
}
exports.getHourSentiment = getHourSentiment;
function similarity(array1, array2) {
  let common = 0;

  for (let i = 0; i < array1.length; i++) {
    for (let j = 0; j < array2.length; j++) {
      if (array1[i] === array2[j]) {
        common++;
        break;
      }
    }
  }

  return common / Math.max(array1.length, array2.length);
}
function hasSibling(obj, objects) {
  for (let i = 0; i < objects.length; i++) {
    if (similarity(obj.words, objects[i].words) >= 0.9) {
      return true;
    }
  }

  return false;
}
exports.hasSibling = hasSibling;
