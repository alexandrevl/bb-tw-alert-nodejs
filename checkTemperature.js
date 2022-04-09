const config = require("dotenv").config();
const needle = require("needle");
const { MongoClient } = require("mongodb");
let cron = require("node-cron");
const SENTIMENT_ALERT = 10;
const TEAMS_URL = process.env.TEAMS_URL;

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

let db = null;
async function check() {
  console.log("Checking temperature...");
  let tweets = await compileHour();
  //console.log(tweets);
  let anlysedTweets = await analyse(tweets);
  console.log("Temperature checked");
  return anlysedTweets;
}
async function analyse(tweets) {
  for (let index = 0; index < tweets.length; index++) {
    let tw = tweets[index];
    if (index > 0) {
      let diffSentiment = tw.avgSentiment - tweets[index - 1].avgSentiment;
      let diffCount = tw.count - tweets[index - 1].count;
      tweets[index].diffSentiment = diffSentiment;
      tweets[index].diffCount = diffCount;
      //   console.log(diffSentiment, SENTIMENT_ALERT, index);
      if (diffSentiment < SENTIMENT_ALERT && index === 1) {
        console.log(
          `Changes in sentiments in minute ${tw.minute}: (${diffCount}/${diffSentiment})`
        );
        await sendMsgTeams(diffCount, diffSentiment);
      }
    }
  }
  return tweets;
}
async function compileHour() {
  let results = [];
  for (let index = 0; index < 60; index++) {
    let tws = await checkMinutes(index);
    tw = {
      minute: index,
      count: tws.length,
      sumSentiment: 0,
      avgSentiment: 0,
    };
    let sumSentiment = 0;
    if (tws.length > 0) {
      for (let i = 0; i < tws.length; i++) {
        const tw = tws[i];
        sumSentiment += tw.sentiment;
      }
    }
    if (sumSentiment != 0) {
      tw.sumSentiment = sumSentiment;
      tw.avgSentiment = sumSentiment / tw.count;
    }
    results.push(tw);
    //console.log(tw);
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
async function sendMsgTeams(count, temperature) {
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
          'Os daddos coletados são da combinação de palavras "banco do brasil"',
        facts: [
          {
            name: "Quantidade tweets",
            value: count,
          },
          {
            name: "Temp do último minuto",
            value: temperature,
          },
          {
            name: "Data/hora",
            value: new Date(),
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
  let cronStr = "* * * * *";
  console.log(`Cron: ${cronStr}`);
  console.log(`Sentiment Alert: ${SENTIMENT_ALERT}`);
  //   cron.schedule(cronStr, async () => {
  //     console.log(`Cron: ${cronStr}`);
  //     await check();
  //     console.log(`Cron: done`);
  //   });
  await check();
}
if (require.main === module) {
  main();
}
