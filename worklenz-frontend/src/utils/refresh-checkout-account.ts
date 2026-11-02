// Webhooks can arrive after checkout.completed. Retry independently of the pricing modal's
// lifecycle, stopping as soon as the server confirms the purchased plan and seats.
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

export async function refreshCheckoutAccount(refresh: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (await refresh()) return;
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}
