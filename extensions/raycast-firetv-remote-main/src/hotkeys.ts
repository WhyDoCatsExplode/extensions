// What each key in Remote does, and the rules for changing them. Nothing here depends on Raycast.

export type Modifier = "cmd" | "opt" | "ctrl" | "shift";
export type Hotkey = { modifiers: Modifier[]; key: string };
export type AppHotkey = { name: string; pkg: string; hotkey: Hotkey };
export type Hotkeys = { actions: Record<string, Hotkey | null>; apps: AppHotkey[] };

const plain = (key: string): Hotkey => ({ modifiers: [], key });

export const ACTIONS = [
  { id: "up", title: "Up", section: "Navigate", hotkey: plain("arrowUp") },
  { id: "down", title: "Down", section: "Navigate", hotkey: plain("arrowDown") },
  { id: "left", title: "Left", section: "Navigate", hotkey: plain("arrowLeft") },
  { id: "right", title: "Right", section: "Navigate", hotkey: plain("arrowRight") },
  { id: "select", title: "OK", section: "Navigate", hotkey: plain("return") },
  { id: "back", title: "Back", section: "Navigate", hotkey: plain("b") },
  { id: "home", title: "Home", section: "Navigate", hotkey: plain("h") },
  { id: "menu", title: "Menu", section: "Navigate", hotkey: plain("m") },
  { id: "rewind", title: "Rewind", section: "Playback", hotkey: plain("7") },
  { id: "playPause", title: "Play or Pause", section: "Playback", hotkey: plain("p") },
  { id: "fastForward", title: "Fast Forward", section: "Playback", hotkey: plain("9") },
  { id: "volumeDown", title: "Volume Down", section: "Volume", hotkey: plain("-") },
  { id: "mute", title: "Mute", section: "Volume", hotkey: plain("0") },
  { id: "volumeUp", title: "Volume Up", section: "Volume", hotkey: plain("=") },
  { id: "sleep", title: "Sleep", section: "More", hotkey: plain("s") },
  { id: "type", title: "Type on TV", section: "More", hotkey: plain("t") },
  { id: "openApp", title: "Open an App", section: "More", hotkey: plain("a") },
  { id: "hotkeys", title: "Change Hotkeys", section: "More", hotkey: plain(",") },
] as const;

export type ActionId = (typeof ACTIONS)[number]["id"];

// Measured by registering every combination in Raycast and reading which it dropped. Return is always OK.
const RESERVED = new Set([
  "delete",
  "deleteForward",
  "enter",
  "escape",
  "opt+delete",
  "cmd+,",
  "cmd+a",
  "cmd+delete",
  "cmd+enter",
  "cmd+escape",
  "cmd+k",
  "cmd+p",
  "cmd+q",
  "cmd+w",
  "cmd+shift+/",
]);

const MODIFIER_ORDER: Modifier[] = ["cmd", "opt", "ctrl", "shift"];
const id = ({ modifiers, key }: Hotkey) => [...MODIFIER_ORDER.filter((m) => modifiers.includes(m)), key].join("+");
export const sameHotkey = (a: Hotkey, b: Hotkey) => id(a) === id(b);

const SYMBOLS: Record<string, string> = { cmd: "⌘", opt: "⌥", ctrl: "⌃", shift: "⇧" };
const KEY_NAMES: Record<string, string> = {
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  return: "Return",
  space: "Space",
  tab: "Tab",
  pageUp: "Page Up",
  pageDown: "Page Down",
  home: "Home",
  end: "End",
  backspace: "Backspace",
};
const keyName = (key: string) => KEY_NAMES[key] ?? key.toUpperCase();

export function hotkeyLabel(hotkey: Hotkey | null | undefined) {
  if (!hotkey) return "None";
  return `${MODIFIER_ORDER.filter((m) => hotkey.modifiers.includes(m))
    .map((m) => SYMBOLS[m])
    .join("")}${keyName(hotkey.key)}`;
}

// Everything Raycast accepts and doesn't reserve, for the picker.
const CHOICES = [
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split(""),
  ".",
  ",",
  ";",
  "=",
  "-",
  "[",
  "]",
  "/",
  "\\",
  "'",
  "`",
  "arrowUp",
  "arrowDown",
  "arrowLeft",
  "arrowRight",
  "space",
  "tab",
  "pageUp",
  "pageDown",
  "home",
  "end",
  "backspace",
];
export const KEY_CHOICES = CHOICES.map((value) => ({ value, title: keyName(value) }));

export function defaultHotkeys(): Hotkeys {
  return { actions: Object.fromEntries(ACTIONS.map((a) => [a.id, a.hotkey])), apps: [] };
}

// Saved settings, kept safe: a key added in a later version gets its default, and a broken entry is dropped.
export function readHotkeys(saved: string | undefined): Hotkeys {
  const base = defaultHotkeys();
  let data: Partial<Hotkeys> = {};
  try {
    data = saved ? JSON.parse(saved) : {};
  } catch {
    return base;
  }
  for (const { id: action } of ACTIONS) {
    const value = data.actions?.[action];
    if (value === null) base.actions[action] = null;
    else if (value?.key && Array.isArray(value.modifiers)) base.actions[action] = value;
  }
  base.apps = (Array.isArray(data.apps) ? data.apps : []).filter(
    (a) => a?.name && a?.pkg && a?.hotkey?.key && Array.isArray(a.hotkey.modifiers),
  );
  return base;
}

// Why a hotkey can't be used, or null if it can. `owner` is what's being changed, so it can keep its own key.
export function hotkeyProblem(
  hotkey: Hotkey,
  hotkeys: Hotkeys,
  owner: { action?: string; app?: string },
): string | null {
  const wanted = id(hotkey);
  if (RESERVED.has(wanted)) return `Raycast keeps ${hotkeyLabel(hotkey)} for itself. Pick another.`;
  // Return always means OK, so nothing else can have it, even with OK moved elsewhere.
  if (wanted === "return" && owner.action !== "select") return "Return is always OK. Pick another.";
  for (const action of ACTIONS) {
    const current = hotkeys.actions[action.id];
    if (action.id !== owner.action && current && sameHotkey(current, hotkey))
      return `${hotkeyLabel(hotkey)} is already ${action.title}.`;
  }
  const app = hotkeys.apps.find((a) => a.pkg !== owner.app && sameHotkey(a.hotkey, hotkey));
  return app ? `${hotkeyLabel(hotkey)} already opens ${app.name}.` : null;
}
