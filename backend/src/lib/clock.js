// Server time in one place. Access checks always use this, never a time sent by a client,
// and tests replace `now` to check behaviour before, exactly at and after an unlock.
module.exports = {
  now: () => new Date(),
};
