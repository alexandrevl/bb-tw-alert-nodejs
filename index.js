var Twit = require('twit')

var T = new Twit({
  consumer_key:         'r7HZjxZx0JGYgngANxASfA',
  consumer_secret:      'PwI4kQfUrDRCfZcLDO0JzDTX0tnLWoqM1hkVvCl8K0',
  access_token:         '40391612-VJM8Cjk0Gy7YppwJxDiWz4PqbKX4KE3WvmdkVuStB',
  access_token_secret:  'ixYRayioBETk92XFVySKof5jH99YDGQgYGAcAyxcdaba3',
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
  strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

//
//  search twitter for all tweets containing the word 'banana' since July 11, 2011
//
T.get('search/tweets', { q: 'banco brasil', count: 100 , /*since_id: 1509718602664063000*/ }, function(err, data, response) {
    data.statuses.forEach(msg => {
        console.log(msg.id)
        console.log(msg.created_at)
        console.log(msg.text)
        console.log(sentiment(msg.text))
    });
    console.log(data.search_metadata);
})

async function sentiment(text) {
  // Imports the Google Cloud client library
  const language = require('@google-cloud/language');

  // Instantiates a client
  const client = new language.LanguageServiceClient();

  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  // Detects the sentiment of the text
  const [result] = await client.analyzeSentiment({document: document});
  const sentiment = result.documentSentiment;

  console.log(`Text: ${text}`);
  console.log(`Sentiment score: ${sentiment.score}`);
  console.log(`Sentiment magnitude: ${sentiment.magnitude}`);
}