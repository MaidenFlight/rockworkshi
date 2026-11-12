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

// Meeting reminders (24 hours and 15 minutes before) and any email or push still waiting to go out.
// Every minute; each pass is safe to repeat (lib/notify.js).
const { tick } = require("./lib/notify");
const notifyPass = () => tick().catch((err) => console.error("Could not send notifications:", err.message));
setTimeout(notifyPass, 5000).unref();
setInterval(notifyPass, 60 * 1000).unref();
