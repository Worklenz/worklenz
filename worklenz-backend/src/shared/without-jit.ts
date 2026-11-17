import { PoolClient } from "pg";
import db from "../config/db";

/** Run measured read-only workloads without JIT, scoped to one transaction. */
export async function withReadOnlyWithoutJit<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db.connect();
    let discardClient = false;
    try {
        await client.query("BEGIN READ ONLY");
        await client.query("SET LOCAL jit = off");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            discardClient = true;
        }
        throw error;
    } finally {
        client.release(discardClient);
    }
}
