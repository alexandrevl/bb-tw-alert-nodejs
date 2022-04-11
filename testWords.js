const needle = require("needle");
let convert = require("xml-js");

async function main() {
  let word = "valeu";

  let url = `https://api.dicionario-aberto.net/word/${word}`;
  const response = await needle("get", url);
  console.log(response.body);
  console.log(
    convert.xml2json(response.body[0].xml, { compact: true, spaces: 4 })
  );
}

if (require.main === module) {
  main();
}
