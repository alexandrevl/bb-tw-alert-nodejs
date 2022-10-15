const io = require("socket.io-client");
const socket = io("ws://170.187.152.51:8000", {
  reconnectionDelayMax: 10000,
});
socket.on("welcome", (data) => {
  console.log(data);
  socket.emit("sendTelegram", [2, -0.98, -34, "oi (987), jhsst (991)"]);
});
console.log("Client ok");