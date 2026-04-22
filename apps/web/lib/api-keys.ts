import { randomBytes } from "crypto";

import { hash } from "bcryptjs";

export function generatePlaintextApiKey() {
  return `govx_${randomBytes(18).toString("hex")}`;
}

export async function createApiKeyHashPair() {
  const plaintext = generatePlaintextApiKey();
  const hashed = await hash(plaintext, 10);

  return {
    plaintext,
    hashed
  };
}
