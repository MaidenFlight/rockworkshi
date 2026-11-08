const prisma = require("./prisma");

// What a person, or for a minor their guardian, can say yes or no to.
const PRACTICE_VIDEO = "practice-video";
const PURPOSES = ["profile", "share-practice", "band-matching", PRACTICE_VIDEO];

// The latest answer for each consent purpose, or null where none was ever given.
async function consentsFor(userId) {
  const rows = await prisma.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return Object.fromEntries(PURPOSES.map((p) => [p, rows.find((r) => r.purpose === p)?.granted ?? null]));
}

// Whether this student can be filmed for a video task. An adult decides that by pressing record. A
// minor needs a guardian's yes, which only a guardian can give (people.routes.js refuses a minor's own).
async function canFilm(student) {
  if (!student.isMinor) return true;
  return (await consentsFor(student.id))[PRACTICE_VIDEO] === true;
}

module.exports = { PURPOSES, PRACTICE_VIDEO, consentsFor, canFilm };
