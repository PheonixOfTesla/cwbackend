// programProgressionJob.js - Auto-progress active programs weekly
const cron = require('node-cron');
const Program = require('../models/Program');
const CalendarEvent = require('../models/CalendarEvent');

/**
 * Auto-progression job - runs every Monday at 12:01 AM
 * Advances all active programs to next week and regenerates calendar
 */
function startProgramProgressionJob() {
  // Run every Monday at 00:01 (just after midnight)
  const job = cron.schedule('1 0 * * 1', async () => {
    try {
      console.log('[CRON] Starting program progression job');

      // Get all active programs
      const activePrograms = await Program.find({
        status: 'active',
        currentWeek: { $lt: '$durationWeeks' }  // Not yet completed
      });

      console.log(`[CRON] Found ${activePrograms.length} active programs to progress`);

      for (const program of activePrograms) {
        try {
          // Advance to next week
          await program.progressToNextWeek();

          console.log(`[CRON] Advanced program "${program.name}" to week ${program.currentWeek}`);

          // TODO: Regenerate next week's calendar events with updated RPE/intensity
          // This is optional - can be implemented to auto-update calendar
          // For now, programs are pre-generated at program creation time

        } catch (progErr) {
          console.error(`[CRON] Error progressing program ${program._id}:`, progErr.message);
        }
      }

      console.log('[CRON] Program progression job completed');

    } catch (error) {
      console.error('[CRON] Program progression job error:', error);
    }
  });

  return job;
}

/**
 * Optional: Daily autoregulation adjustment check
 * Runs every day at 8 AM to check readiness and suggest adjustments
 */
function startAutoregulationCheckJob() {
  // Run daily at 08:00
  const job = cron.schedule('0 8 * * *', async () => {
    try {
      console.log('[CRON] Starting autoregulation check job');

      const activePrograms = await Program.find({
        status: 'active',
        'autoregulation.enabled': true
      });

      console.log(`[CRON] Checking autoregulation for ${activePrograms.length} programs`);

      // TODO: Implement autoregulation logic
      // - Check user readiness (HRV, sleep, stress, etc.)
      // - Suggest workout adjustments based on readiness
      // - Log adjustments for future FORGE learning

      console.log('[CRON] Autoregulation check completed');

    } catch (error) {
      console.error('[CRON] Autoregulation check error:', error);
    }
  });

  return job;
}

/**
 * Optional: Weekly program review
 * Runs every Friday to summarize progress and suggest adjustments
 */
function startWeeklyReviewJob() {
  // Run every Friday at 6 PM
  const job = cron.schedule('0 18 * * 5', async () => {
    try {
      console.log('[CRON] Starting weekly program review');

      const activePrograms = await Program.find({
        status: 'active'
      });

      console.log(`[CRON] Reviewing ${activePrograms.length} programs`);

      // TODO: Generate weekly summary
      // - Calculate volume, intensity, frequency
      // - Compare to actual workouts completed
      // - Suggest adjustments for next week
      // - Log for FORGE learning

      console.log('[CRON] Weekly program review completed');

    } catch (error) {
      console.error('[CRON] Weekly review error:', error);
    }
  });

  return job;
}

/**
 * Initialize all program jobs
 */
function initializeProgramJobs() {
  console.log('[JOBS] Initializing program scheduling jobs');

  const jobs = {
    progression: startProgramProgressionJob(),
    autoregulation: startAutoregulationCheckJob(),
    review: startWeeklyReviewJob()
  };

  console.log('[JOBS] Program jobs initialized');

  return jobs;
}

module.exports = {
  initializeProgramJobs,
  startProgramProgressionJob,
  startAutoregulationCheckJob,
  startWeeklyReviewJob
};
