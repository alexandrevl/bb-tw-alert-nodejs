const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
const _ = require("lodash");
var express = require("express");
var app = express();

let db = null;
const SERVER_PORT = 8005;

app.get("/", async (req, res) => {
  let result = await getHourSentiment();
  console.log(result);
  res.send(result);
});

var server = app.listen(SERVER_PORT, async () => {
  await connectMongo();
  console.log(`Example app listening at ${SERVER_PORT}`);
});

async function connectMongo() {
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");
  return db;
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
