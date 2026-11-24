// Each bot's unsent message, kept in this browser until it's sent or emptied: across other screens, reloads, a new
// build, and the app closing. Storage can be off, as in a private window, and then a draft lasts while its chat is open.
// Only one with words: a box left with blank lines, as Messages' box keeps them, came back that tall with no placeholder.
const key = (bot: string) => `fxbot.draft.${bot}`;

export function draftOf(bot: string) {
  try {
    const kept = localStorage.getItem(key(bot)) ?? "";
    return kept.trim() ? kept : "";
  } catch {
    return "";
  }
}

export function keepDraft(bot: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(key(bot), text);
    else localStorage.removeItem(key(bot));
  } catch {}
}
