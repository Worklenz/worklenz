import axios from "axios";
import { PoolClient } from "pg";
import { importTaskAttachments } from "../services/imports/commit-helpers";
import { TaskAttachmentImportContext } from "../services/imports/types";

jest.mock("axios");
jest.mock("../shared/storage", () => ({ getKey: jest.fn(() => "key"), uploadBuffer: jest.fn(async () => true) }));

const context: TaskAttachmentImportContext = {
  shouldImportAttachments: true,
  targetTeamId: "team",
  targetProjectId: "project",
  createdByUserId: "user",
  jiraAuthHeader: "Basic secret",
  jiraDomain: "jira.example.com",
};
const client = { query: jest.fn(async () => ({ rows: [{ id: "attachment" }] })) } as unknown as PoolClient;
const request = (url: string) => importTaskAttachments(client, "task", {
  __jira_attachments: [{ url, filename: "file.txt" }],
}, context);

beforeEach(() => {
  jest.clearAllMocks();
  (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from("data") });
});

describe("import attachment URL security", () => {
  it.each(["http://127.0.0.1/secret", "http://169.254.169.254/secret", "file:///etc/passwd"])(
    "rejects internal or invalid URL %s before fetching", async url => {
      expect(await request(url)).toEqual({ attachments: 0, attachmentFailures: 1 });
      expect(axios.get).not.toHaveBeenCalled();
    }
  );
  it("checks connection addresses and refuses redirects or proxies", async () => {
    expect(await request("https://jira.example.com/file")).toEqual({ attachments: 1, attachmentFailures: 0 });
    expect(axios.get).toHaveBeenCalledWith("https://jira.example.com/file", expect.objectContaining({
      maxRedirects: 0, proxy: false, headers: { Authorization: "Basic secret", Accept: "*/*" },
      httpsAgent: expect.anything(), httpAgent: expect.anything(),
    }));
  });
  it("does not send Jira credentials to another host", async () => {
    await request("https://other.example.com/file");
    expect(axios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Accept: "*/*" } }));
  });
  it("follows safe 303 redirect and strips credentials for external target", async () => {
    (axios.get as jest.Mock)
      .mockResolvedValueOnce({
        status: 303,
        headers: { location: "https://cdn.example.com/download.pdf" }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: Buffer.from("pdf-data")
      });

    const result = await request("https://jira.example.com/file");
    expect(result).toEqual({ attachments: 1, attachmentFailures: 0 });
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenLastCalledWith("https://cdn.example.com/download.pdf", expect.objectContaining({
      headers: { Accept: "*/*" }
    }));
  });
  it("rejects 303 redirect pointing to internal host", async () => {
    (axios.get as jest.Mock).mockResolvedValueOnce({
      status: 303,
      headers: { location: "http://127.0.0.1/admin" }
    });

    const result = await request("https://jira.example.com/file");
    expect(result).toEqual({ attachments: 0, attachmentFailures: 1 });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
  it("rejects 303 redirect missing Location header", async () => {
    (axios.get as jest.Mock).mockResolvedValueOnce({
      status: 303,
      headers: {}
    });

    const result = await request("https://jira.example.com/file");
    expect(result).toEqual({ attachments: 0, attachmentFailures: 1 });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
