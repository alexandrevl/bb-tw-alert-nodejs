const { TwitterApi } = require("twitter-api-v2");

const client = new TwitterApi({
  appKey: "r7HZjxZx0JGYgngANxASfA",
  appSecret: "PwI4kQfUrDRCfZcLDO0JzDTX0tnLWoqM1hkVvCl8K0",
  accessToken: "40391612-VJM8Cjk0Gy7YppwJxDiWz4PqbKX4KE3WvmdkVuStB",
  accessSecret: "ixYRayioBETk92XFVySKof5jH99YDGQgYGAcAyxcdaba3",
});

client.v2.get("users/14/tweets");
