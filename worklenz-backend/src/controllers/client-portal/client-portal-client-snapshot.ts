/**
 * The client's details as they were when an invoice or quote was created. Both documents store
 * them (client_snapshot_* columns) so they keep showing the party they were issued to, even if
 * the client is renamed or edited later. Pure helpers, no database access.
 */

export interface ClientSnapshot {
  name: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactPerson: string | null;
}

const MAX_SNAPSHOT_FIELD = 1000;

const clean = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, MAX_SNAPSHOT_FIELD) : null;
};

/** The columns a snapshot is written to, in the same order as `snapshotParams`. */
export const SNAPSHOT_COLUMNS = [
  "client_snapshot_name",
  "client_snapshot_company_name",
  "client_snapshot_email",
  "client_snapshot_phone",
  "client_snapshot_address",
  "client_snapshot_contact_person",
] as const;

/** The clients columns a snapshot is read from (select these in any query that creates a document). */
export const CLIENT_SNAPSHOT_SELECT =
  "c.name AS snapshot_name, c.company_name AS snapshot_company_name, c.email AS snapshot_email, " +
  "c.phone AS snapshot_phone, c.address AS snapshot_address, c.contact_person AS snapshot_contact_person";

/** Builds a snapshot from a row selected with `CLIENT_SNAPSHOT_SELECT`. */
export function snapshotFromRow(row: Record<string, unknown> | undefined): ClientSnapshot {
  return {
    name: clean(row?.snapshot_name),
    companyName: clean(row?.snapshot_company_name),
    email: clean(row?.snapshot_email),
    phone: clean(row?.snapshot_phone),
    address: clean(row?.snapshot_address),
    contactPerson: clean(row?.snapshot_contact_person),
  };
}

/** Values for `SNAPSHOT_COLUMNS`, in order. */
export const snapshotParams = (snapshot: ClientSnapshot): Array<string | null> => [
  snapshot.name,
  snapshot.companyName,
  snapshot.email,
  snapshot.phone,
  snapshot.address,
  snapshot.contactPerson,
];
