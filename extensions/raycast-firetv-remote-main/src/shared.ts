import { LaunchType, launchCommand, LocalStorage, showToast, Toast } from "@raycast/api";
import { Hotkeys, readHotkeys } from "./hotkeys";
import { Command, NotPaired, Pairing, send } from "./tv";

const ADDRESS = "address";
const TOKEN = "token";
const EXTRA_APPS = "extraApps";
const HOTKEYS = "hotkeys";

export type ExtraApp = { name: string; pkg: string };
// Often sideloaded, so the TV won't list it. Remove it from Open App if you don't have it.
const DEFAULT_EXTRAS: ExtraApp[] = [{ name: "Stremio", pkg: "com.stremio.one" }];

export async function savedAddress() {
  return (await LocalStorage.getItem<string>(ADDRESS)) ?? "";
}

export async function loadPairing(): Promise<Pairing | null> {
  const address = await savedAddress();
  const token = await LocalStorage.getItem<string>(TOKEN);
  return address && token ? { address, token } : null;
}

export async function savePairing({ address, token }: Pairing) {
  await LocalStorage.setItem(ADDRESS, address);
  await LocalStorage.setItem(TOKEN, token);
}

export async function loadExtraApps(): Promise<ExtraApp[]> {
  const saved = await LocalStorage.getItem<string>(EXTRA_APPS);
  try {
    return saved ? JSON.parse(saved) : DEFAULT_EXTRAS;
  } catch {
    return DEFAULT_EXTRAS;
  }
}

export const saveExtraApps = (apps: ExtraApp[]) => LocalStorage.setItem(EXTRA_APPS, JSON.stringify(apps));

export const loadHotkeys = async () => readHotkeys(await LocalStorage.getItem<string>(HOTKEYS));
export const saveHotkeys = (hotkeys: Hotkeys) => LocalStorage.setItem(HOTKEYS, JSON.stringify(hotkeys));

const goPair = () => launchCommand({ name: "pair", type: LaunchType.UserInitiated });

// For a command with a window: the failure shows in it, and it stays open.
export async function pressIn(pairing: Pairing, ...commands: Command[]) {
  try {
    await send(pairing, ...commands);
  } catch (e) {
    await showToast({ style: Toast.Style.Failure, title: (e as Error).message });
    if (e instanceof NotPaired) await goPair();
  }
}
