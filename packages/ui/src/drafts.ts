// Each bot's unsent message, kept in this browser until it's sent or emptied: across other screens, reloads, a new
// build, and the app closing. Storage can be off, as in a private window, and then a draft lasts while its chat is open.
const key = (bot: string) => `fxbot.draft.${bot}`;

export function draftOf(bot: string) {
  try {
    return localStorage.getItem(key(bot)) ?? "";
  } catch {
    return "";
  }
}

export function keepDraft(bot: string, text: string) {
  try {
    if (text) localStorage.setItem(key(bot), text);
    else localStorage.removeItem(key(bot));
  } catch {}
}
