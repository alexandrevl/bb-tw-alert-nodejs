require("dotenv").config();
const { MongoClient } = require("mongodb");
// or as an es module:
// import { MongoClient } from 'mongodb'

// Connection URL
const url = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_PROD}/twitter?authSource=admin`;
const client = new MongoClient(url);

// Database Name
const dbName = "twitter";

async function main() {
  try {
    await client.connect();
    console.log("Connected successfully to server");
    const db = client.db(dbName);
    const cursor = await db.collection("raw_data").find({});
    await cursor.forEach((element) => {
      console.log(element);
    });
  } finally {
    await client.close();
    console.log("Done");
  }
}

main().catch(console.error);
