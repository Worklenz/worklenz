export const DUPLICATE_KEY_VALUE = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

export const DEFAULT_ERROR_MESSAGE = "Unknown error has occurred.";

export const SessionsStatus = {
  IDLE: "IDLE",
  STARTED: "STARTED",
  ENDED: "ENDED",
};

export const LOG_DESCRIPTIONS = {
  PROJECT_CREATED: "Project created by @user",
  PROJECT_UPDATED: "Project updated by @user",
  TASK_CREATED: "Task created by @user",
  TASK_UPDATED: "Task updated by @user",
  PROJECT_MEMBER_ADDED: "was added to the project by",
  PROJECT_MEMBER_REMOVED: "was removed from the project by",
};

export const WorklenzColorShades = {
  "#154c9b": ["#0D2A50", "#112E54", "#153258", "#19365C", "#1D3A60", "#213E64", "#254268", "#29466C", "#2D4A70", "#314E74"],
  "#3b7ad4": ["#224884", "#26528A", "#2A5C90", "#2E6696", "#32709C", "#367AA2", "#3A84A8", "#3E8EAE", "#4298B4", "#46A2BA"],
  "#70a6f3": ["#3D5D8A", "#46679E", "#5071B2", "#597BC6", "#6385DA", "#6C8FEE", "#7699F2", "#7FA3F6", "#89ADFA", "#92B7FE"],
  "#7781ca": ["#42486F", "#4C5283", "#565C97", "#6066AB", "#6A70BF", "#747AD3", "#7E84E7", "#888EFB", "#9298FF", "#9CA2FF"],
  "#9877ca": ["#542D70", "#6E3A8A", "#8847A4", "#A254BE", "#BC61D8", "#D66EF2", "#E07BFC", "#EA88FF", "#F495FF", "#FEA2FF"],
  "#c178c9": ["#6A2E6F", "#843B89", "#9E48A3", "#B855BD", "#D262D7", "#EC6FF1", "#F67CFB", "#FF89FF", "#FF96FF", "#FFA3FF"],
  "#ee87c5": ["#832C6A", "#9D3984", "#B7469E", "#D153B8", "#EB60D2", "#FF6DEC", "#FF7AF6", "#FF87FF", "#FF94FF", "#FFA1FF"],
  "#ca7881": ["#6F2C3E", "#893958", "#A34672", "#BD538C", "#D760A6", "#F16DC0", "#FB7ADA", "#FF87F4", "#FF94FF", "#FFA1FF"],
  "#75c9c0": ["#3F6B66", "#497E7A", "#53918E", "#5DA4A2", "#67B7B6", "#71CBCA", "#7BDEDE", "#85F2F2", "#8FFFFF", "#99FFFF"],
  "#75c997": ["#3F6B54", "#497E6A", "#53917F", "#5DA495", "#67B7AA", "#71CBBF", "#7BDED4", "#85F2E9", "#8FFFFF", "#99FFFF"],
  "#80ca79": ["#456F3E", "#5A804D", "#6F935C", "#84A66B", "#99B97A", "#AECC89", "#C3DF98", "#D8F2A7", "#EDFFB6", "#FFFFC5"],
  "#aacb78": ["#5F6F3E", "#7A804D", "#94935C", "#AFA66B", "#CAB97A", "#E5CC89", "#FFDF98", "#FFF2A7", "#FFFFB6", "#FFFFC5"],
  "#cbbc78": ["#6F5D3E", "#8A704D", "#A4835C", "#BF966B", "#DAA97A", "#F5BC89", "#FFCF98", "#FFE2A7", "#FFF5B6", "#FFFFC5"],
  "#cb9878": ["#704D3E", "#8B604D", "#A6735C", "#C1866B", "#DC997A", "#F7AC89", "#FFBF98", "#FFD2A7", "#FFE5B6", "#FFF8C5"],
  "#bb774c": ["#653D27", "#80502C", "#9B6331", "#B67636", "#D1893B", "#EC9C40", "#FFAF45", "#FFC24A", "#FFD54F", "#FFE854"],
  "#905b39": ["#4D2F1A", "#623C23", "#774A2C", "#8C5735", "#A1643E", "#B67147", "#CB7E50", "#E08B59", "#F59862", "#FFA56B"],
  "#903737": ["#4D1A1A", "#622323", "#772C2C", "#8C3535", "#A13E3E", "#B64747", "#CB5050", "#E05959", "#F56262", "#FF6B6B"],
  "#bf4949": ["#661212", "#801B1B", "#992424", "#B32D2D", "#CC3636", "#E63F3F", "#FF4848", "#FF5151", "#FF5A5A", "#FF6363"],
  "#f37070": ["#853A3A", "#A04D4D", "#BA6060", "#D47373", "#EF8686", "#FF9999", "#FFA3A3", "#FFACAC", "#FFB6B6", "#FFBFBF"],
  "#ff9c3c": ["#8F5614", "#AA6F1F", "#C48829", "#DFA233", "#F9BB3D", "#FFC04E", "#FFC75F", "#FFCE70", "#FFD581", "#FFDB92"],
  "#fbc84c": ["#8F6D14", "#AA862F", "#C4A029", "#DFB933", "#F9D23D", "#FFD74E", "#FFDC5F", "#FFE170", "#FFE681", "#FFEB92"],
  "#cbc8a1": ["#6F6D58", "#8A886F", "#A4A286", "#BFBC9D", "#DAD6B4", "#F5F0CB", "#FFFEDE", "#FFFFF2", "#FFFFCD", "#FFFFCD"],
  "#a9a9a9": ["#5D5D5D", "#757575", "#8D8D8D", "#A5A5A5", "#BDBDBD", "#D5D5D5", "#EDEDED", "#F5F5F5", "#FFFFFF", "#FFFFFF"],
  "#767676": ["#404040", "#4D4D4D", "#5A5A5A", "#676767", "#747474", "#818181", "#8E8E8E", "#9B9B9B", "#A8A8A8", "#B5B5B5"]
} as const;

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
  A: "#154c9b",
  B: "#3b7ad4",
  C: "#70a6f3",
  D: "#7781ca",
  E: "#9877ca",
  F: "#c178c9",
  G: "#ee87c5",
  H: "#ca7881",
  I: "#75c9c0",
  J: "#75c997",
  K: "#80ca79",
  L: "#aacb78",
  M: "#cbbc78",
  N: "#cb9878",
  O: "#bb774c",
  P: "#905b39",
  Q: "#903737",
  R: "#bf4949",
  S: "#f37070",
  T: "#ff9c3c",
  U: "#fbc84c",
  V: "#cbc8a1",
  W: "#a9a9a9",
  X: "#767676",
  Y: "#cb9878",
  Z: "#903737",
  "+": "#9e9e9e",
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
  "9": "#75c997",
};

export const PriorityColorCodes: { [x: number]: string } = {
  0: "#2E8B57",
  1: "#DAA520",
  2: "#CD5C5C",
};

export const PriorityColorCodesDark: { [x: number]: string } = {
  0: "#3CB371",
  1: "#B8860B",
  2: "#F08080",
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
export const AZURE_STORAGE_ACCOUNT_NAME =
  process.env.AZURE_STORAGE_ACCOUNT_NAME;
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
export const UAT_SERVER_URL =
  process.env.UAT_SERVER_URL || "https://your-uat-server-url";
export const DEV_SERVER_URL =
  process.env.DEV_SERVER_URL || "https://your-dev-server-url";
export const PRODUCTION_SERVER_URL =
  process.env.PRODUCTION_SERVER_URL || "https://your-production-server-url";

// *Sync with the client
export const PASSWORD_POLICY =
  "Minimum of 8 characters, with upper and lowercase and a number and a symbol.";

// paddle status to exclude
export const statusExclude = ["past_due", "paused", "deleted"];

// Trial user team member limit
export const TRIAL_MEMBER_LIMIT = 10;

export const HTML_TAG_REGEXP = /<\/?[^>]+>/gi;

export const UNMAPPED = "Unmapped";

export const DATE_RANGES = {
  YESTERDAY: "YESTERDAY",
  LAST_WEEK: "LAST_WEEK",
  LAST_MONTH: "LAST_MONTH",
  LAST_QUARTER: "LAST_QUARTER",
  ALL_TIME: "ALL_TIME",
};
