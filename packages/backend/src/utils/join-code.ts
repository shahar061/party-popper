const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, L, 1

export async function generateJoinCode(kv: KVNamespace, maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * VALID_CHARS.length);
      code += VALID_CHARS[randomIndex];
    }

    // Check for collision
    const existing = await kv.get(code);
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique join code after max attempts');
}
