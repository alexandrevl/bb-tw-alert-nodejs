const needle = require("needle");
const config = require("dotenv").config();
const { MongoClient } = require("mongodb");
var _ = require("lodash");
const moment = require("moment");
const TOKEN = process.env.TW_WORD2VEC_BEARER;
const REQUESTS = 440;
const QUERY_WORD = "empréstimo";

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
let db = null;

async function main(next_token_arg) {
  console.log("Start");
  console.log("Connecting mongo...");
  await client.connect();
  db = client.db("twitter");
  console.log("Mongo connected");

  let nextToken = next_token_arg;
  for (let index = 1; index <= REQUESTS; index++) {
    console.log(`Getting ${index * 100} tweets...`);
    let response = await getTweets(nextToken);
    // console.log(response);
    if (response == null) {
      console.log("Fatal error");
      process.exit(1);
    }
    nextToken = response.meta.next_token;
    await insertMany(response.data);
  }
  console.log("Success: " + moment().format());
  let time = 15;
  setTimeout(() => {
    main(nextToken);
  }, time * 60000 + 10000);
  console.log(`Next execution in ${time} minutes`);
  //process.exit(0);
}
async function getTweets(nextToken) {
  const searchURL = "https://api.twitter.com/2/tweets/search/recent?";
  let paramsURL = `query=${QUERY_WORD} -is:retweet -is:quote lang:pt&tweet.fields=created_at&max_results=100`;
  if (nextToken != null) {
    paramsURL += `&next_token=${nextToken}`;
    console.log(`next_token=${nextToken}`);
  }
  let response = await fetch(searchURL + paramsURL, {
    method: "get",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  const results = await response.json();
  if (results.status && results.status != 200) {
    console.log(results);
    return null;
  } else {
    return results;
  }
}

async function insertMany(data) {
  const options = { ordered: true };
  const result = await db.collection(`tw_emprestimo`).insertMany(data, options);
  return result;
}

//Ultimo token (quando for começar de novo tente usar esse token e pegue o ultimo token da execução e coloque aqui): b26v89c19zqg8o3fqk10ueso82oihpdme0vkq1x7vfbst
const old_next_token = "b26v89c19zqg8o3fqk1195g0v0vehbizknygv7dy8w2nx";
main(old_next_token);
