import {customAlphabet} from "nanoid";
import {isUnicode} from "../shared/utils";

function getInitialKey(value: any) {
  if (typeof value !== "string") return null;
  const str = value.trim();
  const words = str.replace(/[^\w\s-_]/g, "").split(/[\s-_]/g);

  if (words.length < 2) {
    if (str.length <= 3) return str.toUpperCase();
    return str.substring(0, 3).toUpperCase();
  }

  const key = words.map(word => word.charAt(0).toUpperCase()).join("");
  return key;
}

function customKey(initialKey: string | null, existingKeys: string[], len = 3): string {
  const allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const key = initialKey || customAlphabet(allChars, len)();

  if (!existingKeys.includes(key)) return key;

  let baseKey = key;
  let randomKey = key;
  let index = 0;

  while (existingKeys.includes(randomKey)) {
    const char = allChars[~~(Math.random() * allChars.length)];
    randomKey = baseKey + char;
    if (!existingKeys.includes(randomKey)) return randomKey;
    index++;
    if (index >= allChars.length) {
      baseKey += char;
    }
  }

  return customKey(null, existingKeys, len + 1);
}

const MAX_KEY_LENGTH = 5;

/** The key cut to MAX_KEY_LENGTH; if the cut key is taken, random keys of that length until one is free. */
function fitKey(key: string, existingKeys: string[]) {
  let fitted = key.slice(0, MAX_KEY_LENGTH);
  while (existingKeys.includes(fitted)) {
    fitted = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ", MAX_KEY_LENGTH)();
  }
  return fitted;
}

export function generateProjectKey(projectName: string, existingKeys: string[] = []) {
  if (isUnicode(projectName)) return fitKey(customKey(null, existingKeys), existingKeys);

  const key = getInitialKey(projectName)?.slice(0, MAX_KEY_LENGTH);
  if (existingKeys.includes(key as string)) {

    // try with project name; a key that is already MAX_KEY_LENGTH long gives its last letter up for the new one,
    // since a letter appended to it would be cut off again
    const base = (key as string).slice(0, MAX_KEY_LENGTH - 1);
    const name = projectName.toUpperCase().trim();
    const chars = [...name.slice(1).replace(/\s/g, "")];
    for (const char of chars) {
      const k = base + char;
      if (!existingKeys.includes(k))
        return k;
    }

    return fitKey(customKey(key as string, existingKeys), existingKeys);
  }

  return key;
}