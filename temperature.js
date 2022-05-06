#!  node
const config = require("dotenv").config();
const _ = require("lodash");
const needle = require("needle");
const { MongoClient } = require("mongodb");
let cron = require("node-cron");

const AVG_SENTIMENT_ALERT = -5;
const SUM_SENTIMENT_ALERT = -40;
const COUNT_ALERT = 5;
const TEAMS_URL = process.env.TEAMS_URL;
const MINUTES = 1;

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

let db = null;
async function check() {
  console.log("Checking temperature...");
  let tweetsArray = await compileHour();
  let analysedTweets = await analyse(tweetsArray);
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
        await sendMsgTeams(tw.count, tw.avgSentiment, tw.sumSentiment);
      }
    }
  }
  return tweets;
}
async function compileHour() {
  let results = [];
  for (let index = 0; index < MINUTES; index++) {
    let tws = await checkMinutes(index);
    let hour = await getHourSentiment();
    let tw = {
      minute: index,
      count: tws.length,
      sumSentiment: 0,
      avgSentiment: 0,
      hourSentiment: hour.sum,
      ts: new Date(),
      words: [],
    };
    let sumSentiment = 0;
    if (tws.length > 0) {
      for (let i = 0; i < tws.length; i++) {
        const twIntern = tws[i];
        //tw.words.push(...twIntern.fullSentiment.tokens);
        sumSentiment += twIntern.sentiment;
      }
    }
    if (sumSentiment != 0) {
      tw.sumSentiment = sumSentiment;
      tw.avgSentiment = sumSentiment / tw.count;
    }
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
async function sendMsgTeams(count, temperature, sumSentiment) {
  console.log("Sending msg to Teams");
  const data = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0076D7",
    summary: "Temperatura Twitter",
    sections: [
      {
        activityTitle: "Alerta de mudança de temperatura do twitter",
        activitySubtitle:
          'Os dados coletados são da combinação de palavras "banco do brasil"',
        facts: [
          {
            name: "Temperatura do minuto",
            value: sumSentiment,
          },
          {
            name: "Quantidade tweets",
            value: count,
          },
          {
            name: "Temp média do minuto",
            value: temperature,
          },
          {
            name: "Link",
            value: "https://twitter.com/search?q=%22banco%20do%20brasil%22",
          },
          {
            name: "Palavras relacionadas",
            value: "banco do brasil, lorem, ipsum",
          },
        ],
        markdown: true,
      },
    ],
  };

  const response = await needle("post", TEAMS_URL, data, {
    headers: {
      "content-type": "application/json",
    },
  });
  return response;
}
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
