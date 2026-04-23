import "server-only";

import fs from "fs/promises";
import path from "path";

type UploadInput = {
  key: string;
  body: string;
};

type StoredObject = {
  key: string;
  path: string;
};

export interface ObjectStorage {
  uploadText(input: UploadInput): Promise<StoredObject>;
  readText(key: string): Promise<string>;
}

const storageRoot = path.join("/tmp", "governix-exports");

class LocalObjectStorage implements ObjectStorage {
  async uploadText(input: UploadInput) {
    const filePath = path.join(storageRoot, input.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.body, "utf8");

    return {
      key: input.key,
      path: filePath
    };
  }

  async readText(key: string) {
    const filePath = path.join(storageRoot, key);
    return fs.readFile(filePath, "utf8");
  }
}

let storage: ObjectStorage | null = null;

export function getObjectStorage() {
  if (!storage) {
    storage = new LocalObjectStorage();
  }

  return storage;
}
