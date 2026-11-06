// A record of sensitive administrative changes: roles, enrolments, guardian links, consent.
// Never blocks the change it records: a failure to log is reported, not thrown.
const prisma = require("./prisma");
const { isDemo } = require("./demoRules");

async function audit(actor, action, targetType, targetId, detail = null) {
  // A student demo is thrown away when the visitor leaves (lib/demo.js); its clicks aren't the school's record.
  if (isDemo(actor)) return;
  try {
    await prisma.auditEvent.create({ data: { actorId: actor?.id ?? null, action, targetType, targetId, detail } });
  } catch (err) {
    console.error("Could not write audit event:", action, err.message);
  }
}

module.exports = { audit };
