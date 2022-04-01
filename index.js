var Twit = require("promised-twit");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);
async function main() {
  await client.connect();
  console.log("Connected successfully to server");
  const db = client.db("twitter");
  let twit = new Twit({
    consumer_key: "r7HZjxZx0JGYgngANxASfA",
    consumer_secret: "PwI4kQfUrDRCfZcLDO0JzDTX0tnLWoqM1hkVvCl8K0",
    access_token: "40391612-VJM8Cjk0Gy7YppwJxDiWz4PqbKX4KE3WvmdkVuStB",
    access_token_secret: "ixYRayioBETk92XFVySKof5jH99YDGQgYGAcAyxcdaba3",
    timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
    strictSSL: true, // optional - requires SSL certificates to be valid.
  });

  let tweets = await searchTweets(twit);
  //console.log(tweets);

  await insertMany(db, tweets);
  await client.close();
  console.log("Done");
}

async function searchTweets(twit) {
  console.log("Searching tweets");
  return twit
    .get("search/tweets", {
      q: '"banco do brasil"',
      count: 100,
    })
    .then(async (response) => {
      data = response.data;
      data.statuses.forEach((msg) => {
        console.log(`${msg.id} - ${msg.created_at} - ${msg.text}`);
      });
      console.log(data.search_metadata);
      return data.statuses;
    });
}
async function insertMany(db, data) {
  const options = { ordered: true };
  const result = await db.collection("raw_data").insertMany(data, options);

  console.log(`${result.insertedCount} documents were inserted`);
  return result;
}

main();
