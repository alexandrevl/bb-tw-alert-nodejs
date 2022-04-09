const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
let cron = require("node-cron");
const SENTIMENT_ALERT = -10;

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
      if (diffSentiment < SENTIMENT_ALERT) {
        console.log(
          `Changes in sentiments in minute ${tw.minute}: (${diffCount}/${diffSentiment})`
        );
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
  cron.schedule(cronStr, async () => {
    console.log(`Cron: ${cronStr}`);
    await check();
    console.log(`Cron: done`);
  });
}
if (require.main === module) {
  main();
}
