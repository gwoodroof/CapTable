const MAILDROP_API = 'https://maildrop.cc/v2/mailbox';

export function uniqueMailbox(): string {
  return `captable-${crypto.randomUUID().slice(0, 8)}`;
}

export function maildropAddress(mailbox: string): string {
  return `${mailbox}@maildrop.cc`;
}

/**
 * Poll until a verification email arrives, then return the link and a cleanup callback.
 * Call deleteEmail() only after your assertions pass — if the test fails, the email
 * remains in the mailbox for inspection.
 */
export async function getVerificationLink(
  mailbox: string,
  { timeoutMs = 30_000, intervalMs = 2_000 } = {},
): Promise<{ url: string; deleteEmail: () => Promise<void> }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const listRes = await fetch(`${MAILDROP_API}/${mailbox}`);
    if (listRes.ok) {
      const messages: { id: string; subject: string }[] = await listRes.json();
      const msg = messages.find((m) => /verify/i.test(m.subject));
      if (msg) {
        const msgRes = await fetch(`${MAILDROP_API}/${mailbox}/${msg.id}`);
        if (msgRes.ok) {
          const full = await msgRes.json();
          const body: string = full.body ?? full.text ?? '';
          const match = body.match(/https?:\/\/\S+\/auth\/verify-email\S+/);
          if (match) {
            const messageId = msg.id;
            return {
              url: match[0],
              deleteEmail: async () => {
                await fetch(`${MAILDROP_API}/${mailbox}/${messageId}`, { method: 'DELETE' }).catch(() => {});
              },
            };
          }
        }
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Verification email for mailbox "${mailbox}" not received within ${timeoutMs}ms`);
}
