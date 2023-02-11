require("dotenv").config();
const request = require("request");
const TOKEN = process.env.TW_BEARER;

function relevance(user) {
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
        // console.dir(data, { depth: null });
        let sumRelevanceIndex = 0;
        let count = 0;
        let medianArray = [];
        if (data.meta.result_count != 0) {
          data.data.forEach((tweet) => {
            if (tweet.referenced_tweets == undefined && count < count_tweets) {
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
          let result = { user: user, relevance: avgRelevance };
          resolve(result);
        } else {
          resolve({ user: user, relevance: parseFloat(0).toFixed(2) });
        }
      }
    });
  });
}
const median = (arr) => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};
exports.relevance = relevance;
