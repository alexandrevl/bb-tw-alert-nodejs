const relevance = require("./relevance");

async function main() {
  let userArray = [
    "lulaoficial",
    "janjalula",
    "AndreJanonesAdv",
    "choquei",
    "Adriana_Accorsi",
    "lazarorosa25",
    "RicardoCappelli",
    "urubuzoka",
    "jairbolsonaro",
    "aquelajacuzzi",
    "JefinhoMenes",
    "Dra_Miriane",
    "pesquisas_2022",
    "alinelks",
    "p_rousseff",
    "brega_falcao",
    "pejulio",
    "IvanValente",
    "jandira_feghali",
    "reinaldoazevedo",
    "veramagalhaes",
    "geraldoalckmin",
    "simonetebetbr",
    "MarinaSilva",
    "gilmarmendes",
    "jose_simao",
    "GugaNoblat",
    "zeliaduncan",
    "pseudogabs",
    "jornalnacional",
    "elonmusk",
    "BarackObama",
    "Cristiano",
    "neymarjr",
    "bbalerta",
    "goatoftheplague",
    "nilmoretto",
    "cdnleon",
  ];
  let arrayRelevance = [];
  userArray.forEach(async (user) => {
    let result = relevance.relevance(user);
    arrayRelevance.push(result);
  });
  //   console.log("-");
  await Promise.all(arrayRelevance).then((result) => {
    console.log(result);
  });
  //   console.log("----");
  //   console.dir(arrayRelevance);
}
async function main2() {
  let result = await relevance("goatoftheplague");
  console.log(result);
}
main();
