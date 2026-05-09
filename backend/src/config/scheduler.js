// ==============================================================
// Scheduler — daily repayment cron
// --------------------------------------------------------------
// Schedules the daily repayment cycle to run automatically.
// OPT-IN via env: ENABLE_REPAYMENT_CRON=true.
//
// Why opt-in? In dev (and during student demos), running the cycle
// at server boot or on a schedule is usually a nuisance. The admin
// can hit POST /api/admin/repayments/run-daily-cycle whenever they
// want a controlled run.
//
// Production would set ENABLE_REPAYMENT_CRON=true in env. Even
// better: set it to false here and use Render's external cron job
// or GitHub Actions to hit the endpoint daily — that way restarts
// don't reset the schedule.
// ==============================================================

const cron = require("node-cron");
const { runDailyCycle } = require("../utils/repaymentEngine");

let scheduledTask = null;

const startScheduler = () => {
  if (process.env.ENABLE_REPAYMENT_CRON !== "true") {
    console.log("[Scheduler] Repayment cron is disabled (ENABLE_REPAYMENT_CRON != true)");
    return null;
  }

  const expr = process.env.REPAYMENT_CRON_SCHEDULE || "0 2 * * *";

  if (!cron.validate(expr)) {
    console.error(`[Scheduler] Invalid cron expression: '${expr}'. Scheduler not started.`);
    return null;
  }

  scheduledTask = cron.schedule(expr, async () => {
    console.log(`[Scheduler] Running daily repayment cycle at ${new Date().toISOString()}`);
    try {
      const stats = await runDailyCycle({ now: new Date() });
      console.log("[Scheduler] Cycle complete:", stats);
    } catch (err) {
      console.error("[Scheduler] Cycle failed:", err);
    }
  });

  console.log(`[Scheduler] Repayment cron scheduled: '${expr}'`);
  return scheduledTask;
};

const stopScheduler = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Repayment cron stopped");
  }
};

module.exports = { startScheduler, stopScheduler };
