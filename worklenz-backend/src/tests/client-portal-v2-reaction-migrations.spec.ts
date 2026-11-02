import { randomUUID } from 'crypto';
import { Client } from 'pg';

// This optional integration test creates a temporary schema in a disposable database.
const describeDatabase = process.env.REACTIONS_TEST_DATABASE_URL ? describe : describe.skip;
describeDatabase('discussion reaction migration (PostgreSQL)', () => {
  const client = new Client({ connectionString: process.env.REACTIONS_TEST_DATABASE_URL });
  const statements = (name: string, direction: 'up' | 'down'): Promise<string[]> => {
    const sql: string[] = [];
    const migration = require(`../../database/pg-migrations/${name}`);
    return Promise.resolve(migration[direction]({ sql: (value: string) => sql.push(value) })).then(() => sql);
  };
  const apply = async (name: string, direction: 'up' | 'down') => {
    for (const sql of await statements(name, direction)) await client.query(sql);
  };
  const create = '1792900000000_client_portal_thread_message_reactions.js';
  const single = '1792900001000_client_portal_reactions_single_per_user.js';

  beforeAll(async () => {
    await client.connect();
    await client.query('BEGIN');
    const schema = `reaction_test_${randomUUID().replace(/-/g, '')}`;
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}, public;`);
    await client.query(`CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE SQL AS 'SELECT gen_random_uuid()';
      CREATE TABLE users(id uuid PRIMARY KEY);
      CREATE TABLE client_contacts(id uuid PRIMARY KEY);
      CREATE TABLE client_portal_thread_messages(id uuid PRIMARY KEY);`);
  });
  afterAll(async () => {
    await client.query('ROLLBACK');
    await client.end();
  });

  it('deduplicates tied timestamps for both actor types and restores emoji indexes on rollback', async () => {
    await apply(create, 'up');
    const user = randomUUID(); const contact = randomUUID(); const message = randomUUID();
    await client.query('INSERT INTO users VALUES ($1)', [user]);
    await client.query('INSERT INTO client_contacts VALUES ($1)', [contact]);
    await client.query('INSERT INTO client_portal_thread_messages VALUES ($1)', [message]);
    await client.query(`INSERT INTO client_portal_thread_message_reactions
      (message_id,reactor_side,user_id,contact_id,reactor_name,emoji,created_at) VALUES
      ($1,'internal',$2,NULL,'Staff','👍','2026-11-01T10:00:00Z'),
      ($1,'internal',$2,NULL,'Staff','❤️','2026-11-01T10:00:00Z'),
      ($1,'client',NULL,$3,'Client','👍','2026-11-01T10:00:00Z'),
      ($1,'client',NULL,$3,'Client','❤️','2026-11-01T10:00:00Z')`, [message,user,contact]);
    await apply(single, 'up');
    const rows = await client.query(`SELECT reactor_side,count(*)::int AS count FROM client_portal_thread_message_reactions GROUP BY reactor_side ORDER BY reactor_side`);
    expect(rows.rows).toEqual([{ reactor_side: 'client', count: 1 }, { reactor_side: 'internal', count: 1 }]);
    await apply(single, 'up'); // Repeat applications must not discard the retained reaction.
    await apply(single, 'down');
    await client.query(`INSERT INTO client_portal_thread_message_reactions
      (message_id,reactor_side,user_id,reactor_name,emoji) VALUES ($1,'internal',$2,'Staff','🚀')`, [message,user]);
    expect((await client.query('SELECT count(*)::int AS count FROM client_portal_thread_message_reactions')).rows[0].count).toBe(3);
    await apply(create, 'down');
  });
});
