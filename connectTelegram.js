const io = require("socket.io-client");
const socket = io("ws://144.22.144.21:8000");
socket.on("welcome", (data) => {
  console.log(data);
  socket.emit("alertTemp", [2, -0.98, -34, "oi (987), jhsst (991)"]);
});
console.log("Client ok");
