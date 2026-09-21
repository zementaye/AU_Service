// One-off script: creates demo users so the API has something to log in with.
// Run after `npm run migrate`:   node seed.js
require("dotenv").config();
const { pool } = require("./db");
const { runSeed } = require("./seedData");

runSeed(pool)
  .then(({ inserted, total, password }) => {
    console.log(`Seeded ${inserted}/${total} users (rest already existed). Password for all: ${password}`);
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
