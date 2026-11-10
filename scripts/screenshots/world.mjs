// The demo world the screenshots show: bots, what the owner says to them, and what each answers. Everything here is
// made up, so a screenshot holds nothing from anyone's install. The scripted model in shoot.mjs answers from `script`.

// The owner's bots, in sidebar order. The first three are pinned, and Juniper is the default bot.
export const bots = [
  { name: "Juniper", shape: "circle", color: "blue", mood: "happy", head: "headphones", pinned: true, about: "plans, trips, and the week ahead" },
  { name: "Atlas", shape: "egg", color: "amber", mood: "calm", head: "beret", outfit: "scarf", pinned: true, about: "looking things up" },
  { name: "Pixel", shape: "squircle", color: "purple", mood: "bright", face: "glasses", outfit: "turtleneck", pinned: true, about: "design and making things look good" },
  { name: "Ledger", shape: "toast", color: "orange", mood: "focus", head: "cap", about: "money and budgets" },
  { name: "Sprout", shape: "sprout", color: "teal", mood: "happy", about: "the garden" },
  { name: "Rook", shape: "cat", color: "red", mood: "shy", outfit: "badge", about: "reminders around the house" },
];

const lisbon = `# A slow weekend in Lisbon

Two easy days on foot, with a long lunch each day and the busy sights early.

## Saturday

- [x] Tram 28 from Martim Moniz before 9, while it's quiet
- [x] Coffee and a pastel de nata at the top of Alfama
- [ ] Wander down to the river through the old streets
- [ ] Lunch: grilled fish in Alfama, no booking needed before 12:30
- [ ] Sunset from the Santa Luzia lookout

## Sunday

- [ ] Belém Tower when it opens, then the monastery
- [ ] Pastries in Belém, eaten warm
- [ ] Afternoon in LX Factory: books, prints, and coffee
- [ ] Dinner in Príncipe Real

## Good to know

| | |
| --- | --- |
| Getting around | A rechargeable card covers trams, buses, and the metro |
| Shoes | Flat and grippy: the stone pavements are slippery |
| Dinner | Most places open at 7:30, and fill up by 8:30 |
`;

const spending = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:15px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0;padding:24px;color:#1f2328;background:#fff}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:#59636e}
.row{display:grid;grid-template-columns:110px 1fr 70px;gap:12px;align-items:center;margin:10px 0}
.bar{height:22px;border-radius:6px;background:#ffa27c}.amt{text-align:right;font-variant-numeric:tabular-nums}
@media (prefers-color-scheme:dark){body{background:#17181c;color:#e6e6e6}p{color:#9aa0a6}}
</style></head><body><h1>Spending this month</h1><p>$1,840 so far, $160 under budget.</p>
<div class="row"><span>Rent</span><div class="bar" style="width:100%"></div><span class="amt">$950</span></div>
<div class="row"><span>Groceries</span><div class="bar" style="width:37%"></div><span class="amt">$352</span></div>
<div class="row"><span>Eating out</span><div class="bar" style="width:22%"></div><span class="amt">$214</span></div>
<div class="row"><span>Transport</span><div class="bar" style="width:13%"></div><span class="amt">$126</span></div>
<div class="row"><span>Fun</span><div class="bar" style="width:11%"></div><span class="amt">$108</span></div>
<div class="row"><span>Other</span><div class="bar" style="width:9%"></div><span class="amt">$90</span></div>
</body></html>`;

// Each entry: the bot, the words that start it (found anywhere in the newest message to it, so a room's or another
// bot's frame works too), and its steps: a tool call, or what it says. Step n answers after n tool calls.
// A subagent's task, for one host.
const hosting = (host, others) =>
  `The owner is choosing a host for a small Postgres database, about 20 GB, in the EU, for under €30 a month. Look at ${host} only: others cover ${others}. Find the plans that fit, with price, memory, disk, and backups: how often, kept how long, and what they cost. Hand back a table with a row for each plan.`;
const order = `Here's the journey, from the click to the doorstep:

\`\`\`mermaid
flowchart LR
  order[Order placed] --> paid{Paid?}
  paid -->|yes| pack[Packed in the studio]
  paid -->|no| remind[Reminder email]
  remind --> paid
  pack --> ship[Shipped with tracking]
  ship --> door[At the customer's door]
\`\`\`

Packing is the slow step, about a day, so that's where a second pair of hands would help most.`;

export const script = [
  { bot: "Juniper", when: "What's on this week?", steps: [{ say: "Here's your week:\n\n- **Tuesday:** dentist at 10:30. I'll remind you at 9.\n- **Wednesday:** Maya's birthday. The card is in the drawer by the door.\n- **Friday:** fly to Lisbon at 18:40, so leave by 15:30.\n\nThe weather looks dry all week, and warm by the weekend." }] },
  { bot: "Juniper", when: "plan a slow weekend in Lisbon", steps: [{ tool: "pages_write", input: { title: "A slow weekend in Lisbon", text: lisbon } }, { say: "I put it in a page you can tick off as you go: two easy days on foot, with a long lunch each day and the busy sights early, before the crowds.\n\nI've already ticked the tram and the coffee for Saturday, since you said you'd do those first. Want me to find a table for Sunday's dinner?" }] },
  { bot: "Atlas", when: "history of maps", steps: [{ say: "Three good ones, from easiest to deepest:\n\n1. **On the Map** by Simon Garfield: short, funny chapters, one story each.\n2. **The History of Cartography**, volume one: the big reference, and free to read online.\n3. **Maps of the Imagination** by Peter Turchi: maps as a way to think about writing.\n\nStart with the first if you want something for the plane." }] },
  { bot: "Sprout", when: "safe to plant the tomatoes", steps: [{ tool: "messages_send", input: { to: "Atlas", text: "When is our last frost usually? The owner wants to plant tomatoes outside." } }, { say: "I've asked Atlas about our frost dates. I'll tell you as soon as I hear back." }] },
  { bot: "Atlas", when: "When is our last frost usually?", steps: [{ say: "The last frost here is usually in mid-April. Tomatoes want nights above 10°C, so early May is the safe bet." }] },
  { bot: "Sprout", when: "last frost here is usually in mid-April", steps: [{ say: "Atlas says the last frost is usually mid-April, so plant the tomatoes out in early May, once nights stay above 10°C. Until then, keep them by the sunniest window, and put them outside for an hour or two on warm days so they toughen up." }] },
  { bot: "Rook", when: "water the plants every morning", steps: [{ tool: "routines_add", input: { name: "Water the plants", task: "Remind the owner to water the plants on the balcony.", cron: "0 8 * * *" } }, { say: "Done." }] },
  { bot: "Pixel", when: "Every Monday at 9", steps: [{ tool: "routines_add", input: { name: "Design reading", task: "Find three new articles about interface design worth reading, and send them to the owner with a line on each.", cron: "0 9 * * 1" } }, { say: "Done: every Monday at 9:00 I'll send you three design reads, each with a line on why it's worth your time. The first one comes on Monday." }] },
  { bot: "Ledger", when: "chart of this month's spending", steps: [{ tool: "pages_html", input: { title: "Spending this month", html: spending } }, { say: "Here's this month so far: $1,840, which is $160 under budget. Eating out is a little higher than last month, and everything else is about the same." }] },
  { bot: "Pixel", when: "garden party on Saturday", steps: [{ say: "A long table under the tree, a white cloth, and mismatched jars of wildflowers down the middle. Add string lights in the branches for after dark." }] },
  { bot: "Sprout", when: "garden party on Saturday", steps: [{ say: "Pot up lavender and rosemary in small terracotta pots for the table. They smell lovely, they're cheap, and guests can take one home." }] },
  // Atlas hands a comparison to three subagents, which stay at work for the shot.
  { bot: "Atlas", when: "Compare the three hosting offers", steps: [
    { tool: "subagents_start", input: { title: "Hetzner's offers", task: hosting("Hetzner", "OVH and Scaleway") } },
    { tool: "subagents_start", input: { title: "OVH's offers", task: hosting("OVH", "Hetzner and Scaleway") } },
    { tool: "subagents_start", input: { title: "Scaleway's offers", task: hosting("Scaleway", "Hetzner and OVH") } },
    { say: "I've handed this to three subagents, one for each host, so they can dig at once. I'll come back with the plans side by side, and what each says about backups, when they report." },
  ] },
  { bot: "Atlas", when: 'Your task, "', steps: [{ hold: true }] },
  { bot: "Pixel", when: "how an order gets from our shop", steps: [{ say: order }] },
];
