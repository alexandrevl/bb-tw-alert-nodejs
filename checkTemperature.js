const config = require("dotenv").config();
const { MongoClient } = require("mongodb");

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

let db = null;
async function check() {
  console.log("Checking temperature...");
  let tweets = await compileHour();
  return tweets;
}
async function compileHour() {
  let tweets = [];
  for (let index = 0; index < 60; index++) {
    let tws = await checkMinutes(index);
    tweets[index] = {
      minute: index,
      qnt: tws.length,
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
      tweets[index].sumSentiment = sumSentiment;
      tweets[index].avgSentiment = sumSentiment / tweets[index].qnt;
    }
    console.log(tweets[index]);
  }
  //console.log(tweets);
  return tweets;
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
async function main() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");
  return check();
}
if (require.main === module) {
  main()
    .then((result) => {
      process.exit(1);
    })
    .catch((err) => {});
}
