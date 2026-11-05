// Draws Remote's whole view as one SVG: the remote on the left, and the commands in two columns on the
// right. It's one image because Raycast's side panel can't have columns, and it's sized to fit the
// window so nothing scrolls. Nothing here depends on Raycast.

export type ArtCommand = { id: string; title: string; section: string; label: string };
export type ArtApp = { name: string; label: string };

// Raycast's window leaves about this much room between its title and action bars.
export const ART_WIDTH = 700;
export const ART_HEIGHT = 340;
const MAX_APPS = 5;

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const GLYPHS: Record<string, string> = {
  up: "m-8 4 8-8 8 8",
  down: "m-8 -4 8 8 8-8",
  left: "m4 -8 -8 8 8 8",
  right: "m-4 -8 8 8-8 8",
  back: "M-3 -2-8-7-3-12M-8-7H3a6 6 0 0 1 0 12H-2",
  home: "M-9 0 0-8 9 0M-6-2V8H6V-2",
  menu: "M-8-6H8M-8 0H8M-8 6H8",
  rewind: "M0-6-8 0 0 6ZM8-6 0 0 8 6Z",
  playPause: "M-9-7V7L-1 0ZM3-7V7M8-7V7",
  fastForward: "M-8-6 0 0-8 6ZM0-6 8 0 0 6Z",
  volumeDown: "M-9-3V3H-5L0 7V-7L-5-3ZM4 0H10",
  mute: "M-9-3V3H-5L0 7V-7L-5-3ZM4-3 10 3M10-3 4 3",
  volumeUp: "M-9-3V3H-5L0 7V-7L-5-3ZM4 0H10M7-3V3",
  sleep: "M6 3A8 8 0 0 1-3-7 8 8 0 1 0 6 3Z",
  type: "M-9-6H9V6H-9ZM-5-2H-4M-1-2H1M4-2H5M-4 2H4",
  openApp: "M-7-7H-1V-1H-7ZM1-7H7V-1H1ZM-7 1H-1V7H-7ZM1 1H7V7H1Z",
};

export function remoteSvg(commands: ArtCommand[], apps: ArtApp[], status: string, dark: boolean): string {
  const c = dark
    ? {
        body: "#1c1c1e",
        edge: "#3a3a3c",
        button: "#2c2c2e",
        ink: "#f5f5f4",
        muted: "#a1a1aa",
        line: "#3a3a3c",
        ok: "#f5f5f4",
        okInk: "#171717",
      }
    : {
        body: "#fbfbfa",
        edge: "#d4d4d8",
        button: "#efeff0",
        ink: "#171717",
        muted: "#71717a",
        line: "#e4e4e7",
        ok: "#171717",
        okInk: "#fbfbfa",
      };
  const label = (id: string) => commands.find((x) => x.id === id)?.label ?? "";

  const text = (x: number, y: number, value: string, size: number, fill: string, anchor = "middle", weight = 400) =>
    `<text x="${x}" y="${y}" font-family="-apple-system, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escape(value)}</text>`;
  const glyph = (name: string, x: number, y: number, scale: number, color = c.ink) =>
    `<path transform="translate(${x} ${y}) scale(${scale})" d="${GLYPHS[name]}" fill="none" stroke="${color}" stroke-width="${2.2 / scale}" stroke-linecap="round" stroke-linejoin="round"/>`;

  /* ---------- The remote ---------- */
  const REMOTE_WIDTH = 204;
  const middle = REMOTE_WIDTH / 2;
  const ringY = 76;
  const button = (name: string, x: number, y: number) =>
    `<circle cx="${x}" cy="${y}" r="14" fill="${c.button}"/>${glyph(name, x, y, 0.64)}${text(x, y + 25, short(label(name), 7), 10, c.muted)}`;
  const COLUMNS = [middle - 62, middle, middle + 62];
  const ROWS = [
    ["back", "home", "menu"],
    ["rewind", "playPause", "fastForward"],
    ["volumeDown", "mute", "volumeUp"],
    ["sleep", "type", "openApp"],
  ];

  const remote = [
    `<rect x="1" y="1" width="${REMOTE_WIDTH - 2}" height="${ART_HEIGHT - 2}" rx="26" fill="${c.body}" stroke="${c.edge}" stroke-width="1.5"/>`,
    `<circle cx="${middle}" cy="${ringY}" r="66" fill="${c.button}"/>`,
    glyph("up", middle, ringY - 51, 0.75),
    glyph("down", middle, ringY + 51, 0.75),
    glyph("left", middle - 51, ringY, 0.75),
    glyph("right", middle + 51, ringY, 0.75),
    `<circle cx="${middle}" cy="${ringY}" r="27" fill="${c.ok}"/>`,
    text(middle, ringY + 1, "OK", 13, c.okInk, "middle", 600),
    text(middle, ringY + 13, short(label("select"), 8), 8.5, c.okInk),
    ...ROWS.flatMap((row, r) => row.map((name, i) => button(name, COLUMNS[i], 166 + r * 44))),
  ];

  /* ---------- The commands, in two columns ---------- */
  const LEFT = REMOTE_WIDTH + 24;
  const RIGHT_MARGIN = 10;
  const COLUMN_WIDTH = (ART_WIDTH - LEFT - 24 - RIGHT_MARGIN) / 2;
  const ROW_HEIGHT = 20;
  const TOP = 40;

  const heading = (x: number, y: number, title: string) => text(x, y, title.toUpperCase(), 9.5, c.muted, "start", 500);
  const row = (x: number, y: number, title: string, key: string) =>
    text(x, y, short(title, 22), 12.5, c.ink, "start") +
    text(x + COLUMN_WIDTH, y, short(key, 12), 12, c.muted, "end", 500);

  const section = (name: string) => commands.filter((x) => x.section === name);
  const lines: string[] = [];
  const stack = (x: number, groups: { title: string; rows: { title: string; label: string }[] }[]) => {
    let y = TOP;
    for (const group of groups) {
      if (!group.rows.length) continue;
      lines.push(heading(x, y, group.title));
      y += ROW_HEIGHT;
      for (const item of group.rows) {
        lines.push(row(x, y, item.title, item.label));
        y += ROW_HEIGHT;
      }
    }
  };
  const shownApps = apps.slice(0, MAX_APPS).map((a) => ({ title: a.name, label: a.label }));
  stack(LEFT, [
    { title: "Navigate", rows: section("Navigate") },
    { title: apps.length > MAX_APPS ? `Apps (${MAX_APPS} of ${apps.length})` : "Apps", rows: shownApps },
  ]);
  const secondColumn = LEFT + COLUMN_WIDTH + 24;
  stack(secondColumn, [
    { title: "Playback", rows: section("Playback") },
    { title: "Volume", rows: section("Volume") },
    { title: "More", rows: section("More") },
  ]);

  const parts = [
    ...remote,
    text(LEFT, 16, short(status, 74), 12.5, c.ink, "start", 500),
    `<path d="M${LEFT} 25H${ART_WIDTH - RIGHT_MARGIN}" stroke="${c.line}"/>`,
    ...lines,
  ];
  // Drawn at twice the size it's shown, so it stays sharp on a Retina screen.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_WIDTH * 2}" height="${ART_HEIGHT * 2}" viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}">${parts.join("")}</svg>`;
}
