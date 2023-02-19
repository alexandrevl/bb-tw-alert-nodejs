require("dotenv").config();
const request = require("request");
const { MongoClient } = require("mongodb");
const { now } = require("lodash");
const TOKEN = process.env.TW_BEARER;

async function relevance(user) {
  let relevance_db = await getRelevance(db, user);
  if (relevance_db == null) {
    return new Promise((resolve, reject) => {
      const count_tweets = 100;
      const options = {
        url: "https://api.twitter.com/2/tweets/search/recent",
        method: "GET",
        qs: {
          query: `from:${user} -is:retweet -is:reply`,
          max_results: 100,
          "tweet.fields": "public_metrics,referenced_tweets",
        },
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      };

      request(options, (error, response, body) => {
        if (error) {
          console.log(error);
          resolve({ user: user, relevance: parseFloat(0).toFixed(3) });
        } else {
          let data = JSON.parse(body);
          console.dir(data, { depth: null });
          let sumRelevanceIndex = 0;
          let count = 0;
          let medianArray = [];
          if (data.meta.result_count != 0) {
            data.data.forEach((tweet) => {
              if (
                tweet.referenced_tweets == undefined &&
                count < count_tweets
              ) {
                // console.log(tweet);
                let retweetIndex = tweet.public_metrics.retweet_count * 10;
                let likeIndex = tweet.public_metrics.like_count;
                let replyIndex = tweet.public_metrics.reply_count * 20;
                let relevanceIndex = retweetIndex + likeIndex + replyIndex;
                sumRelevanceIndex += relevanceIndex;
                medianArray.push(relevanceIndex);
                ++count;
              }
            });

            let avgRelevance = parseFloat(
              sumRelevanceIndex / count / 1000
            ).toFixed(3);
            avgRelevance = parseFloat(median(medianArray));
            avgRelevance = parseFloat(avgRelevance / 1000).toFixed(2);
            let now = new Date();
            let result = { user: user, relevance: avgRelevance, data: now };
            insertMany(db, result);
            resolve(result);
          } else {
            resolve({ user: user, relevance: parseFloat(0).toFixed(2) });
          }
        }
      });
    });
  } else {
    return relevance_db;
  }
}
const median = (arr) => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};
exports.relevance = relevance;

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

let db = null;
async function main() {
  try {
    console.log("Connecting mongo...");
    await client.connect();
    db = client.db("twitter");
    console.log("Mongo connected");
    console.log(await relevance("1209109733015216130"));
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

//Add relevance to mongodb
async function insertMany(db, data) {
  const options = { ordered: true };
  const result = await db.collection("relevance").insertMany(data, options);
  return result;
}
//get relevance from mongodb
async function getRelevance(db, user) {
  let result = await db.collection("relevance").find({ user: user }).toArray();
  if (result.length != 0) {
    return result;
  } else {
    return null;
  }
}
