import db from "../config/db";
import {
  ContactRow,
  ContactServiceError,
  Queryable,
  ProjectAccessInput,
  createContact,
  isValidContactEmail,
  normalizeContactEmail,
  replaceProjectAccess,
  withTransaction,
} from "./client-contacts-service";
import { ClientContactRole } from "../shared/client-portal-permissions";

/**
 * The ways a client is added in the Add Client wizard: a new company with its first contact, a
 * user added to an existing company, and a CSV import of several of either.
 */

/** clients.name is CHECK-limited to this many characters. */
export const CLIENT_NAME_MAX_LENGTH = 60;

export const IMPORT_MAX_ROWS = 500;

export function buildFullName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export interface CompanyFirstContactInput {
  teamId: string;
  companyName?: string | null;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
}

export interface CreatedCompany {
  id: string;
  name: string;
  company_name: string | null;
}

/** Checks a client name is usable in this team: not empty, within the limit, and not taken. */
async function assertClientNameFree(q: Queryable, teamId: string, name: string) {
  if (!name) {
    throw new ContactServiceError("INVALID_NAME", "A company or contact name is required");
  }
  if (name.length > CLIENT_NAME_MAX_LENGTH) {
    throw new ContactServiceError(
      "INVALID_NAME",
      `The company name can be at most ${CLIENT_NAME_MAX_LENGTH} characters`
    );
  }

  const existing = await q.query(
    `SELECT id FROM clients WHERE team_id = $1 AND lower(name) = lower($2) LIMIT 1`,
    [teamId, name]
  );
  if (existing.rows.length > 0) {
    throw new ContactServiceError("COMPANY_EXISTS", `A client named "${name}" already exists`, {
      clientId: existing.rows[0].id,
    });
  }
}

/**
 * Creates a company and its first contact together. The first contact is the company's POC. The
 * company's own email / contact_person / phone mirror that contact, which older client-portal
 * features (invitations, chats, invoices) still read. Without a company name the person's own name
 * is used for the client, as for a client who is an individual.
 */
export async function createCompanyWithFirstContact(
  q: Queryable,
  input: CompanyFirstContactInput
): Promise<{ client: CreatedCompany; contact: ContactRow }> {
  const firstName = input.firstName?.trim();
  if (!firstName) throw new ContactServiceError("MISSING_FIELDS", "First name is required");

  const email = normalizeContactEmail(input.email ?? "");
  if (!isValidContactEmail(email)) {
    throw new ContactServiceError("INVALID_EMAIL", "A valid email address is required");
  }

  const fullName = buildFullName(firstName, input.lastName);
  const companyName = input.companyName?.trim() || null;
  const clientName = companyName ?? fullName;

  await assertClientNameFree(q, input.teamId, clientName);

  const inserted = await q.query(
    `INSERT INTO clients (name, email, company_name, phone, contact_person, status, team_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING id, name, company_name`,
    [clientName, email, companyName, input.phone?.trim() || null, fullName, input.teamId]
  );
  const client: CreatedCompany = inserted.rows[0];

  const contact = await createContact(q, {
    teamId: input.teamId,
    clientId: client.id,
    name: fullName,
    email,
    phone: input.phone,
    jobTitle: input.jobTitle,
    role: "poc",
  });

  return { client, contact };
}

export interface CompanyUserInput {
  teamId: string;
  clientId: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  role?: ClientContactRole;
  projectAccess?: ProjectAccessInput[];
}

/** Adds a user to a company that already exists, optionally with per-project access. */
export async function addContactToCompany(q: Queryable, input: CompanyUserInput): Promise<ContactRow> {
  const firstName = input.firstName?.trim();
  if (!firstName) throw new ContactServiceError("MISSING_FIELDS", "First name is required");

  const company = await q.query(`SELECT id FROM clients WHERE id = $1 AND team_id = $2`, [
    input.clientId,
    input.teamId,
  ]);
  if (company.rows.length === 0) throw new ContactServiceError("NOT_FOUND", "Client not found");

  const contact = await createContact(q, {
    teamId: input.teamId,
    clientId: input.clientId,
    name: buildFullName(firstName, input.lastName),
    email: input.email ?? "",
    phone: input.phone,
    jobTitle: input.jobTitle,
    role: input.role ?? "member",
  });

  if (input.projectAccess && input.projectAccess.length > 0) {
    await replaceProjectAccess(q, {
      contactId: contact.id,
      clientId: input.clientId,
      teamId: input.teamId,
      access: input.projectAccess,
    });
  }

  return contact;
}

/**
 * Posts a message to the client's Messages from the team member who added them. Best effort: a
 * failure here must never undo the client that was just created.
 */
export async function postWelcomeMessage(input: {
  teamId: string;
  clientId: string;
  userId: string;
  text: string;
}): Promise<boolean> {
  const text = input.text.trim();
  if (!text) return false;

  try {
    await db.query(
      `INSERT INTO client_portal_chat_messages (
         client_id, organization_team_id, sender_type, sender_id, message, message_type, created_at
       ) VALUES ($1, $2, 'team_member', $3, $4, 'text', NOW())`,
      [input.clientId, input.teamId, input.userId, text]
    );
    return true;
  } catch (error) {
    console.error("Could not post the welcome message:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------------------------

export interface ImportRowInput {
  company?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
}

/** Machine-readable so the UI can show each in the user's language. */
export type ImportRowErrorCode =
  | "missing_first_name"
  | "missing_email"
  | "invalid_email"
  | "duplicate_in_file"
  | "email_in_use"
  | "company_name_too_long"
  | "client_name_taken"
  | "import_failed";

export interface ImportRowResult {
  /** 1-based, counting data rows (not the header). */
  row: number;
  status: "ok" | "error";
  errors: ImportRowErrorCode[];
  name: string;
  email: string;
  /** The company this row lands in (its own name when the row has no company). */
  company: string;
  /** True when the company is already a client, so the row is added as a member. */
  company_exists: boolean;
}

interface PreparedRow extends ImportRowResult {
  existingClientId: string | null;
  /** Rows that share a key end up in the same company. */
  groupKey: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
}

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export interface ImportLookups {
  /** Lower-cased emails already used by a company user in the team. */
  existingEmails: Set<string>;
  /** Lower-cased client / company name → client id. */
  existingClients: Map<string, string>;
}

/** Validates rows against the file itself and the team's existing data. Pure. */
export function prepareImportRows(rows: ImportRowInput[], lookups: ImportLookups): PreparedRow[] {
  const seenEmails = new Set<string>();
  const seenPersonClients = new Set<string>();

  return rows.map((raw, index) => {
    const firstName = asText(raw.first_name);
    const lastName = asText(raw.last_name);
    const email = asText(raw.email);
    const company = asText(raw.company);
    const fullName = buildFullName(firstName, lastName);
    const errors: ImportRowErrorCode[] = [];

    if (!firstName) errors.push("missing_first_name");
    if (!email) errors.push("missing_email");
    else if (!isValidContactEmail(email)) errors.push("invalid_email");
    else {
      const key = email.toLowerCase();
      if (seenEmails.has(key)) errors.push("duplicate_in_file");
      else if (lookups.existingEmails.has(key)) errors.push("email_in_use");
      seenEmails.add(key);
    }

    const companyName = company || null;
    const clientName = companyName ?? fullName;
    if (clientName.length > CLIENT_NAME_MAX_LENGTH) errors.push("company_name_too_long");

    // A row that names a company joins it when it already exists. A row with no company becomes a
    // client of its own named after the person, so that name must be free.
    let existingClientId: string | null = null;
    if (companyName) {
      existingClientId = lookups.existingClients.get(companyName.toLowerCase()) ?? null;
    } else if (fullName) {
      const personKey = fullName.toLowerCase();
      if (lookups.existingClients.has(personKey) || seenPersonClients.has(personKey)) {
        errors.push("client_name_taken");
      }
      seenPersonClients.add(personKey);
    }

    return {
      row: index + 1,
      status: errors.length === 0 ? "ok" : "error",
      errors,
      name: fullName,
      email,
      company: clientName,
      company_exists: existingClientId !== null,
      existingClientId,
      // A row with no company stands alone. Rows naming the same company share it.
      groupKey: companyName ? `company:${companyName.toLowerCase()}` : `person:${email.toLowerCase() || index}`,
      firstName,
      lastName,
      companyName,
    };
  });
}

async function loadImportLookups(q: Queryable, teamId: string): Promise<ImportLookups> {
  const [emails, clients] = await Promise.all([
    q.query(`SELECT lower(email) AS email FROM client_contacts WHERE team_id = $1`, [teamId]),
    q.query(`SELECT id, name, company_name FROM clients WHERE team_id = $1`, [teamId]),
  ]);

  const existingClients = new Map<string, string>();
  for (const row of clients.rows) {
    // A company can be matched by either of its names.
    if (row.company_name) existingClients.set(String(row.company_name).trim().toLowerCase(), row.id);
    existingClients.set(String(row.name).trim().toLowerCase(), row.id);
  }

  return {
    existingEmails: new Set(emails.rows.map((row) => String(row.email))),
    existingClients,
  };
}

function assertRowLimit(rows: unknown): asserts rows is ImportRowInput[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ContactServiceError("MISSING_FIELDS", "The file has no rows to import");
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new ContactServiceError(
      "TOO_MANY_ROWS",
      `A file can have at most ${IMPORT_MAX_ROWS} rows (it has ${rows.length})`
    );
  }
}

const toPublicResult = ({ row, status, errors, name, email, company, company_exists }: PreparedRow): ImportRowResult => ({
  row,
  status,
  errors,
  name,
  email,
  company,
  company_exists,
});

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  new_companies: number;
  existing_companies: number;
}

/** Dry run: what would happen to each row, without writing anything. */
export async function validateImport(teamId: string, rows: unknown) {
  assertRowLimit(rows);
  const prepared = prepareImportRows(rows, await loadImportLookups(db, teamId));

  const valid = prepared.filter((row) => row.status === "ok");
  const groups = new Map<string, PreparedRow>();
  valid.forEach((row) => groups.has(row.groupKey) || groups.set(row.groupKey, row));

  const summary: ImportSummary = {
    total: prepared.length,
    valid: valid.length,
    invalid: prepared.length - valid.length,
    new_companies: Array.from(groups.values()).filter((row) => !row.existingClientId).length,
    existing_companies: Array.from(groups.values()).filter((row) => row.existingClientId).length,
  };

  return { summary, rows: prepared.map(toPublicResult) };
}

export interface ImportOutcome {
  created_companies: number;
  added_users: number;
  skipped: number;
  rows: ImportRowResult[];
}

/**
 * Imports every valid row. Rows are grouped by company and each company is written in its own
 * transaction, so one bad company never loses the others. Rows are Not invited afterwards: nothing
 * is emailed, the operator invites from the list.
 */
export async function commitImport(teamId: string, rows: unknown): Promise<ImportOutcome> {
  assertRowLimit(rows);
  const prepared = prepareImportRows(rows, await loadImportLookups(db, teamId));

  const groups = new Map<string, PreparedRow[]>();
  for (const row of prepared) {
    if (row.status !== "ok") continue;
    groups.set(row.groupKey, [...(groups.get(row.groupKey) ?? []), row]);
  }

  let createdCompanies = 0;
  let addedUsers = 0;

  for (const groupRows of groups.values()) {
    try {
      const outcome = await withTransaction(async (tx) => {
        let clientId = groupRows[0].existingClientId;
        let created = false;
        let added = 0;

        for (const row of groupRows) {
          if (!clientId) {
            // A new company: its first row is the POC.
            const { client } = await createCompanyWithFirstContact(tx, {
              teamId,
              companyName: row.companyName,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
            });
            clientId = client.id;
            created = true;
          } else {
            await addContactToCompany(tx, {
              teamId,
              clientId,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              role: "member",
            });
          }
          added += 1;
        }

        return { created, added };
      });

      if (outcome.created) createdCompanies += 1;
      addedUsers += outcome.added;
    } catch (error) {
      console.error("Client import: a company could not be imported", error);
      for (const row of groupRows) {
        row.status = "error";
        row.errors = ["import_failed"];
      }
    }
  }

  const results = prepared.map(toPublicResult);
  return {
    created_companies: createdCompanies,
    added_users: addedUsers,
    skipped: results.filter((row) => row.status === "error").length,
    rows: results,
  };
}
