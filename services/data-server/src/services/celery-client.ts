/**
 * Celery Client - Interface to the email worker task queue
 *
 * Allows the data server to queue background tasks for email processing
 */

import { createClient } from 'celery-node';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';

// Create Celery client connected to Redis broker
const celeryClient = createClient(REDIS_URL, REDIS_URL);

/**
 * Queue a digest generation task for a specific user
 *
 * This triggers the email worker to:
 * 1. Fetch emails from Gmail using OAuth tokens
 * 2. Extract and clean newsletter content
 * 3. Process with OpenAI to generate digest
 * 4. Save results to database
 *
 * @param userId - The user's Firebase UID
 * @returns Task ID for tracking
 */
export async function queueDigestGeneration(userId: string, force: boolean = false): Promise<string> {
  console.log(`📤 Queuing digest generation task for user ${userId} (force=${force})`);

  try {
    // Send task to Celery worker with args and kwargs explicitly defined.
    // `force=true` bypasses the worker's same-day idempotency guard and is
    // set when the user explicitly confirms a re-run from the UI.
    const task = celeryClient.sendTask('tasks.process_user_emails', [userId, force], {});

    console.log(`✅ Task queued with ID: ${task.taskId}`);

    return task.taskId;

  } catch (error) {
    console.error(`❌ Error queuing digest generation task:`, error);
    throw new Error(`Failed to queue digest generation: ${error}`);
  }
}

/**
 * Queue daily digest generation for all active users
 *
 * @returns Task ID for tracking
 */
export async function queueDailyDigests(): Promise<string> {
  console.log(`📤 Queuing daily digest generation for all users`);

  try {
    const task = celeryClient.sendTask('tasks.generate_daily_digests', []);

    console.log(`✅ Daily digest task queued with ID: ${task.taskId}`);

    return task.taskId;

  } catch (error) {
    console.error(`❌ Error queuing daily digests:`, error);
    throw new Error(`Failed to queue daily digests: ${error}`);
  }
}

export { celeryClient };
