const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));
jest.mock("../services/client-portal-v2/notify.service", () => ({
  __esModule: true,
  notifyStaff: jest.fn(),
  notifyClientUsers: jest.fn(),
}));

import db from "../config/db";
import { toggleClientMessageReaction } from "../services/client-portal-v2/client-write.service";
import { toggleStaffMessageReaction, getThread } from "../services/client-portal-v2/discussions.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;

const clientAdmin: ClientSubject = {
  contactId: "11111111-1111-1111-1111-111111111111",
  clientId: "22222222-2222-2222-2222-222222222222",
  teamId: "33333333-3333-3333-3333-333333333333",
  role: "admin",
  name: "Client Admin User",
  email: "admin@client.com",
};

const clientViewer: ClientSubject = {
  ...clientAdmin,
  role: "viewer",
  name: "Client Viewer User",
};

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
});

describe("toggleClientMessageReaction", () => {
  const messageId = "44444444-4444-4444-4444-444444444444";
  const projectId = "55555555-5555-5555-5555-555555555555";

  it("rejects when the client user lacks comment capability (Viewer)", async () => {
    await expect(
      toggleClientMessageReaction(clientViewer, messageId, "👍")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an invalid message id", async () => {
    await expect(
      toggleClientMessageReaction(clientAdmin, "not-a-uuid", "👍")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an empty emoji", async () => {
    await expect(
      toggleClientMessageReaction(clientAdmin, messageId, "   ")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects reacting to a deleted message", async () => {
    // Subject project scope
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ project_id: projectId }]));
    // Message query returning a deleted message
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: messageId, thread_id: "thread-1", deleted_at: new Date() }])
    );

    await expect(
      toggleClientMessageReaction(clientAdmin, messageId, "👍")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("adds a reaction if not present and returns updated reactions", async () => {
    // Subject project scope
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ project_id: projectId }]));
    // Message lookup
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: messageId, thread_id: "thread-1", deleted_at: null }])
    );

    // In transaction:
    // 1. BEGIN
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));
    // 2. Existing check (not found)
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));
    // 3. INSERT
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));
    // 4. Updated aggregation
    const updatedReactions = [
      {
        emoji: "👍",
        count: 1,
        has_reacted: true,
        users: [{ id: clientAdmin.contactId, name: clientAdmin.name, side: "client" }],
      },
    ];
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ reactions: updatedReactions }]));
    // 5. COMMIT
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));

    const result = await toggleClientMessageReaction(clientAdmin, messageId, "👍");
    expect(result).toEqual(updatedReactions);

    const insertCall = mockTxQuery.mock.calls.find(([sql]) =>
      /INSERT INTO client_portal_thread_message_reactions/.test(String(sql))
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toEqual([messageId, clientAdmin.contactId, clientAdmin.name, "👍"]);
  });

    it("removes a reaction if already present with same emoji (toggle off)", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ project_id: projectId }]));
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: messageId, thread_id: "thread-1", deleted_at: null }])
    );

    // In transaction:
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // BEGIN
    // Existing check (found existing reaction with same emoji)
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ id: "reaction-1", emoji: "👍" }]));
    // DELETE
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));
    // Updated aggregation (empty)
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ reactions: [] }]));
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // COMMIT

    const result = await toggleClientMessageReaction(clientAdmin, messageId, "👍");
    expect(result).toEqual([]);

    const deleteCall = mockTxQuery.mock.calls.find(([sql]) =>
      /DELETE FROM client_portal_thread_message_reactions WHERE id = \$1/.test(String(sql))
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toEqual(["reaction-1"]);
  });

  it("switches reaction if user selects a different emoji (single reaction per user)", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ project_id: projectId }]));
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: messageId, thread_id: "thread-1", deleted_at: null }])
    );

    // In transaction:
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // BEGIN
    // Existing check (found previous reaction with different emoji 👍)
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ id: "reaction-1", emoji: "👍" }]));
    // UPDATE to ❤️
    mockTxQuery.mockResolvedValueOnce(createQueryResult([]));
    // Updated aggregation
    const updated = [
      {
        emoji: "❤️",
        count: 1,
        has_reacted: true,
        users: [{ id: clientAdmin.contactId, name: clientAdmin.name, side: "client" }],
      },
    ];
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ reactions: updated }]));
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // COMMIT

    const result = await toggleClientMessageReaction(clientAdmin, messageId, "❤️");
    expect(result).toEqual(updated);

    const updateCall = mockTxQuery.mock.calls.find(([sql]) =>
      /UPDATE client_portal_thread_message_reactions/.test(String(sql))
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual(["❤️", "reaction-1"]);
  });
});

describe("toggleStaffMessageReaction", () => {
  const teamId = "33333333-3333-3333-3333-333333333333";
  const userId = "77777777-7777-7777-7777-777777777777";
  const messageId = "44444444-4444-4444-4444-444444444444";

  it("allows a staff user to toggle a reaction on a discussion message", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: messageId, thread_id: "thread-1", deleted_at: null }])
    );

    // In transaction:
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // BEGIN
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // Check existing
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // INSERT
    const updated = [
      {
        emoji: "🎉",
        count: 1,
        has_reacted: true,
        users: [{ id: userId, name: "Staff Member", side: "internal" }],
      },
    ];
    mockTxQuery.mockResolvedValueOnce(createQueryResult([{ reactions: updated }]));
    mockTxQuery.mockResolvedValueOnce(createQueryResult([])); // COMMIT

    const result = await toggleStaffMessageReaction(teamId, userId, "Staff Member", messageId, "🎉");
    expect(result).toEqual(updated);

    const insertCall = mockTxQuery.mock.calls.find(([sql]) =>
      /INSERT INTO client_portal_thread_message_reactions/.test(String(sql))
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toEqual([messageId, userId, "Staff Member", "🎉"]);
  });
});
