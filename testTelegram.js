const config = require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp);
});

// Listen for any kind of message. There are different kinds of
// messages.
// bot.on("message", (msg) => {
//   const chatId = msg.chat.id;

//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, "Received your message");
// });

const chatId = "@bb_alert_tw";
const tempMin = 0;
const qntTw = 0;
const resp = `*TW Alerta de mudança de temperatura do twitter*\n
              Temperatura min: ${tempMin}
              Quantidade tweets: ${qntTw}
              Temp. media min: 8\n
              Palavras: ajuda (30) lula (28) pix (27) pai (27) deus (26) crianças (25) desempregado (25) contas (25) pagar (25) filhos (25)`;
console.log(`Send to ${chatId}: ${resp}`);
bot.sendMessage(chatId, resp, { parse_mode: "Markdown" });
