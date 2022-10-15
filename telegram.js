const io = require("socket.io")();
const config = require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

io.on("connection", (client) => {
  console.log("Client connected");
  client.emit("welcome", "welcome man");
  client.on("alertTemp", (data) => {
    sendTelegram(data);
  });
});
io.listen(8000);

function alertTemp(data) {
  let [count, temperature, sumSentiment, resultWordsStr] = data;
  const chatId = "@bb_alert_tw";
  const resp = `*TW Alerta de mudança de temperatura do twitter*\n
Temperatura do minuto: ${sumSentiment}
Quantidade de tweets: ${count}
Temp. media do minuto: ${parseFloat(temperature).toFixed(2)}
Palavras: ${resultWordsStr}`;
  console.log(`Send to ${chatId}: ${resp}`);
  bot.sendMessage(chatId, resp, { parse_mode: "Markdown" });
}

console.log("Bot Telegram UP");
