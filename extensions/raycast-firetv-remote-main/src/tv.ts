// The Fire TV's local API, the one Amazon's own remote app uses. It isn't documented or supported by
// Amazon. Nothing in this file depends on Raycast.
import http from "node:http";
import https from "node:https";

export type Pairing = { address: string; token: string };
export type Command = { path: string; body?: object };
export type InstalledApp = { name: string; pkg: string; icon?: string };

export class NotPaired extends Error {}
export class Unreachable extends Error {}

const WAKE_WAIT = 1500;
const PACKAGE = /^[\w.]+$/;

// Ports are only for tests: a real Fire TV always uses these two.
export const ports = { control: 8080, dial: 8009 };

const action = (name: string, body?: object): Command => ({
  path: `/v1/FireTV?action=${name}`,
  ...(body ? { body } : {}),
});
const volume = (name: string) => action(name, { keyActionType: "keyDownUp" });

export const KEYS = {
  up: action("dpad_up"),
  down: action("dpad_down"),
  left: action("dpad_left"),
  right: action("dpad_right"),
  select: action("select"),
  back: action("back"),
  home: action("home"),
  menu: action("menu"),
  sleep: action("sleep"),
  playPause: { path: "/v1/media?action=play" },
  volumeUp: volume("volume_up"),
  volumeDown: volume("volume_down"),
  mute: volume("mute"),
} satisfies Record<string, Command>;

const scan = (direction: "forward" | "back", keyActionType: "keyDown" | "keyUp"): Command => ({
  path: "/v1/media?action=scan",
  body: { direction, keyAction: { keyActionType } },
});
// A tap: Raycast doesn't report when a key is let go, so these can't be held.
export const REWIND = [scan("back", "keyDown"), scan("back", "keyUp")];
export const FAST_FORWARD = [scan("forward", "keyDown"), scan("forward", "keyUp")];

export const openApp = (pkg: string): Command => ({ path: `/v1/FireTV/app/${encodeURIComponent(pkg)}` });
export const typeText = (text: string): Command => ({ path: "/v1/FireTV/text", body: { text } });

type Answer = { status: number; text: string };

// The TV has its own certificate, which can't be checked against any authority. This needs its own agent:
// Raycast sets rejectUnauthorized on Node's global agent, and an agent's options beat a request's.
const tvAgent = new https.Agent({ rejectUnauthorized: false });

function request(url: string, method: string, headers: Record<string, string>, body?: string): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const options = { method, headers, timeout: 4000, ...(url.startsWith("https:") ? { agent: tvAgent } : {}) };
    const req = client.request(url, options, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

async function wake(address: string) {
  await request(`http://${address}:${ports.dial}/apps/FireTVRemote`, "POST", {}).catch(() => {});
  await new Promise((r) => setTimeout(r, WAKE_WAIT));
}

function call(address: string, method: string, path: string, token: string | null, body?: object) {
  const headers: Record<string, string> = {
    "X-Api-Key": "0987654321", // A fixed client id, not a secret. The token is what authorises you.
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": "okhttp/4.10.0",
    ...(token ? { "X-Client-Token": token } : {}),
  };
  return request(
    `https://${address}:${ports.control}${path}`,
    method,
    headers,
    body ? JSON.stringify(body) : undefined,
  );
}

// The control service sleeps after a few idle minutes and refuses connections until it's woken. Each
// command starts fresh, so it tries straight away and only waits to wake the TV if it has to.
async function withWake(address: string, attempt: () => Promise<Answer>): Promise<Answer> {
  try {
    return await attempt();
  } catch {
    await wake(address);
    try {
      return await attempt();
    } catch (e) {
      const { code, message } = e as NodeJS.ErrnoException;
      throw new Unreachable(
        `Can't reach the Fire TV at ${address} (${code ?? message}). Is it on, and on this network?`,
      );
    }
  }
}

function checked(answer: Answer) {
  if (answer.status === 401 || answer.status === 403)
    throw new NotPaired("The Fire TV no longer recognizes this pairing. Pair it again.");
  if (answer.status < 200 || answer.status >= 300) throw new Error(`The Fire TV answered ${answer.status}.`);
  return answer;
}

export async function send(pairing: Pairing, ...commands: Command[]) {
  for (const command of commands) {
    checked(
      await withWake(pairing.address, () => call(pairing.address, "POST", command.path, pairing.token, command.body)),
    );
  }
}

export async function showPin(address: string) {
  const answer = await withWake(address, () =>
    call(address, "POST", "/v1/FireTV/pin/display", null, { friendlyName: "Raycast" }),
  );
  if (answer.status < 200 || answer.status >= 300)
    throw new Error(`The Fire TV answered ${answer.status}. This model may not have this API.`);
}

export async function verifyPin(address: string, pin: string): Promise<string> {
  const answer = await withWake(address, () => call(address, "POST", "/v1/FireTV/pin/verify", null, { pin }));
  let token = "";
  try {
    token = JSON.parse(answer.text).description ?? "";
  } catch {
    // Not JSON, so there's no token: reported below.
  }
  if (answer.status < 200 || answer.status >= 300 || !token)
    throw new Error("That PIN didn't work. Check the TV and try again.");
  return token;
}

// Store listings are chatty: "Spotify - Music and Podcasts", "VLC for Fire".
const tidyName = (name: string) =>
  name
    .split(" - ")[0]
    .split(":")[0]
    .replace(/ for Fire( TV)?/, "")
    .trim();

// What's installed from the store. Sideloaded apps aren't listed.
export async function installedApps(pairing: Pairing): Promise<InstalledApp[]> {
  const answer = checked(
    await withWake(pairing.address, () => call(pairing.address, "GET", "/v1/FireTV/apps", pairing.token)),
  );
  const list = JSON.parse(answer.text);
  if (!Array.isArray(list)) throw new Error("The Fire TV didn't list its apps.");
  return list
    .filter((a) => a?.isInstalled !== false && a?.name && PACKAGE.test(a?.appId ?? ""))
    .map((a) => ({ name: tidyName(a.name), pkg: a.appId, ...(a.iconArtSmallUri ? { icon: a.iconArtSmallUri } : {}) }));
}

// In words, for Check Connection. Only asks for the TV's properties, so it changes nothing on the TV.
export async function checkConnection(address: string, token: string | null): Promise<string> {
  try {
    const { status } = await withWake(address, () => call(address, "GET", "/v1/FireTV/properties", token));
    if (status === 401 || status === 403)
      return token
        ? "The Fire TV answered, but this pairing is no longer valid. Pair again."
        : "The Fire TV answered. Run Pair to finish setting up.";
    return status >= 200 && status < 300 ? "Connected to your Fire TV" : `The Fire TV answered ${status}.`;
  } catch (e) {
    return (e as Error).message;
  }
}

export const validPackage = (pkg: string) => PACKAGE.test(pkg);
