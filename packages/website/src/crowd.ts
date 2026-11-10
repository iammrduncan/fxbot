// The bots above the home page's headline: Juniper, Atlas, and Pixel from the screenshots, and a few friends. One is
// busy, as a bot is during a turn. scripts/screenshots/card.mjs draws them on the link preview's card too.
export const crowd: { shape: string; color: string; size: number; mood?: string; head?: string; face?: string; outfit?: string; busy?: boolean }[] = [
  { shape: "circle", color: "blue", head: "headphones", size: 76 },
  { shape: "egg", color: "amber", mood: "happy", head: "beret", outfit: "scarf", size: 66 },
  { shape: "squircle", color: "purple", mood: "calm", face: "glasses", outfit: "turtleneck", size: 60 },
  { shape: "toast", color: "orange", mood: "focus", head: "cap", size: 58 },
  { shape: "sprout", color: "teal", size: 68, busy: true },
  { shape: "arch", color: "pink", mood: "doubt", outfit: "bowtie", size: 60 },
  { shape: "cat", color: "red", mood: "shy", outfit: "badge", size: 56 },
];
