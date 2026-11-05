import {
  Action,
  ActionPanel,
  Detail,
  environment,
  Form,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  useNavigation,
} from "@raycast/api";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { useEffect, useRef, useState } from "react";
import ChangeHotkeys from "./change-hotkeys";
import { ACTIONS, ActionId, defaultHotkeys, Hotkey, hotkeyLabel, Hotkeys } from "./hotkeys";
import { ART_HEIGHT, ART_WIDTH, remoteSvg } from "./remote-art";
import { loadHotkeys, loadPairing, pressIn, saveHotkeys } from "./shared";
import { checkConnection, Command, FAST_FORWARD, KEYS, openApp, Pairing, REWIND, typeText } from "./tv";

const COMMANDS: Partial<Record<ActionId, Command[]>> = {
  up: [KEYS.up],
  down: [KEYS.down],
  left: [KEYS.left],
  right: [KEYS.right],
  select: [KEYS.select],
  back: [KEYS.back],
  home: [KEYS.home],
  menu: [KEYS.menu],
  rewind: REWIND,
  playPause: [KEYS.playPause],
  fastForward: FAST_FORWARD,
  volumeDown: [KEYS.volumeDown],
  mute: [KEYS.mute],
  volumeUp: [KEYS.volumeUp],
  sleep: [KEYS.sleep],
};
const ICONS: Record<ActionId, Icon> = {
  up: Icon.ArrowUp,
  down: Icon.ArrowDown,
  left: Icon.ArrowLeft,
  right: Icon.ArrowRight,
  select: Icon.CheckCircle,
  back: Icon.Undo,
  home: Icon.House,
  menu: Icon.List,
  rewind: Icon.Rewind,
  playPause: Icon.Play,
  fastForward: Icon.Forward,
  volumeDown: Icon.SpeakerDown,
  mute: Icon.SpeakerOff,
  volumeUp: Icon.SpeakerUp,
  sleep: Icon.Moon,
  type: Icon.Keyboard,
  openApp: Icon.AppWindow,
  hotkeys: Icon.Gear,
};

const shortcut = (hotkey: Hotkey | null): Keyboard.Shortcut | undefined =>
  hotkey && hotkey.key !== "return"
    ? { modifiers: hotkey.modifiers, key: hotkey.key as Keyboard.KeyEquivalent }
    : undefined;

// Written to a file: Raycast shows images in markdown from a path. The name changes with the content,
// so a changed hotkey shows straight away.
function drawRemote(hotkeys: Hotkeys, status: string) {
  const commands = ACTIONS.map((a) => ({
    id: a.id,
    title: a.title,
    section: a.section,
    label: hotkeyLabel(hotkeys.actions[a.id]),
  }));
  const svg = remoteSvg(
    commands,
    hotkeys.apps.map((a) => ({ name: a.name, label: hotkeyLabel(a.hotkey) })),
    status,
    environment.appearance === "dark",
  );
  const name = `remote-${crypto.createHash("sha1").update(svg).digest("hex").slice(0, 12)}.svg`;
  fs.mkdirSync(environment.supportPath, { recursive: true });
  for (const old of fs.readdirSync(environment.supportPath)) {
    if (/^remote-.*\.svg$/.test(old) && old !== name)
      fs.rmSync(path.join(environment.supportPath, old), { force: true });
  }
  const file = path.join(environment.supportPath, name);
  fs.writeFileSync(file, svg);
  return `file://${encodeURI(file)}`;
}

function TypeOnTV({ send }: { send: (...commands: Command[]) => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle="Type on TV"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Send to TV"
            icon={Icon.Keyboard}
            onSubmit={({ text }: { text: string }) => {
              if (text) send(typeText(text));
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="text" title="Text" placeholder="What to type on the TV" />
    </Form>
  );
}

export default function Remote() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [hotkeys, setHotkeys] = useState<Hotkeys>(defaultHotkeys());
  const [status, setStatus] = useState("Connecting…");
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    (async () => {
      setHotkeys(await loadHotkeys());
      const saved = await loadPairing();
      if (!saved) return launchCommand({ name: "pair", type: LaunchType.UserInitiated });
      setPairing(saved);
      setStatus(await checkConnection(saved.address, saved.token));
    })();
  }, []);

  // One at a time and in order, so a quick up-up-OK arrives the way it was pressed.
  const send = (...commands: Command[]) => {
    if (!pairing) return;
    queue.current = queue.current.then(() => pressIn(pairing, ...commands));
  };
  const change = (next: Hotkeys) => {
    setHotkeys(next);
    saveHotkeys(next);
  };

  const actionFor = (a: (typeof ACTIONS)[number]) => {
    const keys = shortcut(hotkeys.actions[a.id]);
    if (a.id === "type")
      return (
        <Action.Push key={a.id} title={a.title} icon={ICONS[a.id]} shortcut={keys} target={<TypeOnTV send={send} />} />
      );
    if (a.id === "hotkeys")
      return (
        <Action.Push
          key={a.id}
          title={a.title}
          icon={ICONS[a.id]}
          shortcut={keys}
          target={
            pairing ? (
              <ChangeHotkeys pairing={pairing} hotkeys={hotkeys} onSave={change} />
            ) : (
              <Detail markdown="Pair with your Fire TV first." />
            )
          }
        />
      );
    if (a.id === "openApp")
      return (
        <Action
          key={a.id}
          title={a.title}
          icon={ICONS[a.id]}
          shortcut={keys}
          onAction={() => launchCommand({ name: "open-app", type: LaunchType.UserInitiated })}
        />
      );
    return (
      <Action
        key={a.id}
        title={a.title}
        icon={ICONS[a.id]}
        shortcut={keys}
        onAction={() => send(...(COMMANDS[a.id] ?? []))}
      />
    );
  };
  const sections = [...new Set(ACTIONS.map((a) => a.section))];

  return (
    <Detail
      markdown={`![Fire TV remote](${drawRemote(hotkeys, status)}?raycast-width=${ART_WIDTH}&raycast-height=${ART_HEIGHT})`}
      actions={
        <ActionPanel>
          {/* First, so Return is always OK. */}
          {actionFor(ACTIONS.find((a) => a.id === "select")!)}
          {sections.map((section) => (
            <ActionPanel.Section key={section} title={section}>
              {ACTIONS.filter((a) => a.section === section && a.id !== "select").map(actionFor)}
            </ActionPanel.Section>
          ))}
          {hotkeys.apps.length ? (
            <ActionPanel.Section title="Apps">
              {hotkeys.apps.map((app) => (
                <Action
                  key={app.pkg}
                  title={`Open ${app.name}`}
                  icon={Icon.AppWindow}
                  shortcut={shortcut(app.hotkey)}
                  onAction={() => send(openApp(app.pkg))}
                />
              ))}
            </ActionPanel.Section>
          ) : null}
        </ActionPanel>
      }
    />
  );
}
