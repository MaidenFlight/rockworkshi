require("dotenv").config();
const app = require("./app");
const { sweepDemos } = require("./lib/demo");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// Student demos last a couple of hours (lib/demo.js). Clear any that ran out, now and every few minutes.
const sweep = () =>
  sweepDemos()
    .then((n) => n && console.log(`Cleared ${n} expired student demo accounts.`))
    .catch((err) => console.error("Could not clear expired student demos:", err.message));
sweep();
setInterval(sweep, 10 * 60 * 1000).unref();
