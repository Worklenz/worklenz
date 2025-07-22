export const DUPLICATE_KEY_VALUE = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

export const DEFAULT_ERROR_MESSAGE = "Unknown error has occurred.";

export const SessionsStatus = {
  IDLE: "IDLE",
  STARTED: "STARTED",
  ENDED: "ENDED"
};

export const LOG_DESCRIPTIONS = {
  PROJECT_CREATED: "Project created by @user",
  PROJECT_UPDATED: "Project updated by @user",
  TASK_CREATED: "Task created by @user",
  TASK_UPDATED: "Task updated by @user",
  PROJECT_MEMBER_ADDED: "was added to the project by",
  PROJECT_MEMBER_REMOVED: "was removed from the project by",
};

export const WorklenzColorCodes = [
  "#154c9b",
  "#3b7ad4",
  "#70a6f3",
  "#7781ca",
  "#9877ca",
  "#c178c9",
  "#ee87c5",
  "#ca7881",
  "#75c9c0",
  "#75c997",
  "#80ca79",
  "#aacb78",
  "#cbbc78",
  "#cb9878",
  "#bb774c",
  "#905b39",
  "#903737",
  "#bf4949",
  "#f37070",
  "#ff9c3c",
  "#fbc84c",
  "#cbc8a1",
  "#a9a9a9",
  "#767676"
];

export const AvatarNamesMap: { [x: string]: string } = {
  "A": "#154c9b",
  "B": "#3b7ad4",
  "C": "#70a6f3",
  "D": "#7781ca",
  "E": "#9877ca",
  "F": "#c178c9",
  "G": "#ee87c5",
  "H": "#ca7881",
  "I": "#75c9c0",
  "J": "#75c997",
  "K": "#80ca79",
  "L": "#aacb78",
  "M": "#cbbc78",
  "N": "#cb9878",
  "O": "#bb774c",
  "P": "#905b39",
  "Q": "#903737",
  "R": "#bf4949",
  "S": "#f37070",
  "T": "#ff9c3c",
  "U": "#fbc84c",
  "V": "#cbc8a1",
  "W": "#a9a9a9",
  "X": "#767676",
  "Y": "#cb9878",
  "Z": "#903737",
  "+": "#9e9e9e"
};

export const NumbersColorMap: { [x: string]: string } = {
  "0": "#154c9b",
  "1": "#3b7ad4",
  "2": "#70a6f3",
  "3": "#7781ca",
  "4": "#9877ca",
  "5": "#c178c9",
  "6": "#ee87c5",
  "7": "#ca7881",
  "8": "#75c9c0",
  "9": "#75c997"
};

export const PriorityColorCodes: { [x: number]: string; } = {
  0: "#2E8B57",
  1: "#DAA520",
  2: "#CD5C5C"
};

export const PriorityColorCodesDark: { [x: number]: string; } = {
  0: "#3CB371",
  1: "#B8860B",
  2: "#F08080"
};

export const TASK_STATUS_TODO_COLOR = "#a9a9a9";
export const TASK_STATUS_DOING_COLOR = "#70a6f3";
export const TASK_STATUS_DONE_COLOR = "#75c997";

export const TASK_PRIORITY_LOW_COLOR = "#2E8B57";
export const TASK_PRIORITY_MEDIUM_COLOR = "#DAA520";
export const TASK_PRIORITY_HIGH_COLOR = "#CD5C5C";

export const TASK_DUE_COMPLETED_COLOR = "#75c997";
export const TASK_DUE_UPCOMING_COLOR = "#70a6f3";
export const TASK_DUE_OVERDUE_COLOR = "#f37070";
export const TASK_DUE_NO_DUE_COLOR = "#a9a9a9";


export const DEFAULT_PAGE_SIZE = 20;

// S3 Credentials
export const REGION = process.env.S3_REGION || "us-east-1";
export const BUCKET = process.env.S3_BUCKET || "your-bucket-name";
export const S3_URL = process.env.S3_URL || "https://your-s3-url";
export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || "";
export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || "";

// Azure Blob Storage Credentials
export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "s3";
export const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
export const AZURE_STORAGE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER;
export const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
export const AZURE_STORAGE_URL = process.env.AZURE_STORAGE_URL;

export function getStorageUrl() {
  if (STORAGE_PROVIDER === "azure") {
    if (!AZURE_STORAGE_URL) {
      console.warn("AZURE_STORAGE_URL is not defined, falling back to S3_URL");
      return S3_URL;
    }
    
    // Return just the base Azure Blob Storage URL
    // AZURE_STORAGE_URL should be in the format: https://storageaccountname.blob.core.windows.net
    return `${AZURE_STORAGE_URL}/${AZURE_STORAGE_CONTAINER}`;
  }
  return S3_URL;
}

export const TASK_STATUS_COLOR_ALPHA = "69";
export const TASK_PRIORITY_COLOR_ALPHA = "69";
export const TEAM_MEMBER_TREE_MAP_COLOR_ALPHA = "40";

// LICENSING SERVER URLS
export const LOCAL_URL = "http://localhost:3001";
export const UAT_SERVER_URL = process.env.UAT_SERVER_URL || "https://your-uat-server-url";
export const DEV_SERVER_URL = process.env.DEV_SERVER_URL || "https://your-dev-server-url";
export const PRODUCTION_SERVER_URL = process.env.PRODUCTION_SERVER_URL || "https://your-production-server-url";

// *Sync with the client
export const PASSWORD_POLICY = "Minimum of 8 characters, with upper and lowercase and a number and a symbol.";

// paddle status to exclude
export const statusExclude = ["past_due", "paused", "deleted"];

export const HTML_TAG_REGEXP = /<\/?[^>]+>/gi;

export const UNMAPPED = "Unmapped";

export const DATE_RANGES = {
  YESTERDAY: "YESTERDAY",
  LAST_WEEK: "LAST_WEEK",
  LAST_MONTH: "LAST_MONTH",
  LAST_QUARTER: "LAST_QUARTER",
  ALL_TIME: "ALL_TIME"
};
