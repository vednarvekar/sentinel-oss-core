import { Job } from "bullmq";
import { db } from "../../db/client.js";

export async function cleanRepositories(job: Job) {
    console.log("🧹 PIT STOP: Starting repository database maintenance...");
    const result = await db.query(`
        DELETE FROM repos
        WHERE ingested_at < NOW() - INTERVAL '24 hours'
        `)
    console.log(`✅ Maintenance complete. ${result.rowCount} stale repos removed.`);
}
