const io = require("socket.io-client");
const socket = io("ws://144.XX.XXX.XXX:8000");
socket.on("welcome", (data) => {
  console.log(data);
  socket.emit("alertTemp", [2, -0.98, -34, "oi (987), jhsst (991)"]);
});
console.log("Client ok");
