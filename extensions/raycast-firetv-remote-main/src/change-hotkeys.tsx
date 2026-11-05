import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  ACTIONS,
  AppHotkey,
  defaultHotkeys,
  Hotkey,
  hotkeyLabel,
  hotkeyProblem,
  Hotkeys,
  KEY_CHOICES,
  Modifier,
} from "./hotkeys";
import { loadExtraApps } from "./shared";
import { installedApps, Pairing } from "./tv";

type Values = { key: string; cmd: boolean; opt: boolean; ctrl: boolean; shift: boolean; app?: string };

const toHotkey = (v: Values): Hotkey => ({
  key: v.key,
  modifiers: (["cmd", "opt", "ctrl", "shift"] as Modifier[]).filter((m) => v[m]),
});

function KeyFields({ current }: { current?: Hotkey | null }) {
  // OK is the one action that starts on Return, which isn't otherwise offered.
  const choices = current?.key === "return" ? [{ value: "return", title: "Return" }, ...KEY_CHOICES] : KEY_CHOICES;
  return (
    <>
      <Form.Dropdown id="key" title="Key" defaultValue={current?.key ?? "1"}>
        {choices.map((k) => (
          <Form.Dropdown.Item key={k.value} value={k.value} title={k.title} />
        ))}
      </Form.Dropdown>
      <Form.Checkbox id="cmd" title="Hold" label="⌘ Command" defaultValue={current?.modifiers.includes("cmd")} />
      <Form.Checkbox id="opt" label="⌥ Option" defaultValue={current?.modifiers.includes("opt")} />
      <Form.Checkbox id="ctrl" label="⌃ Control" defaultValue={current?.modifiers.includes("ctrl")} />
      <Form.Checkbox id="shift" label="⇧ Shift" defaultValue={current?.modifiers.includes("shift")} />
    </>
  );
}

const refuse = (title: string) => showToast({ style: Toast.Style.Failure, title });

function ActionForm({
  action,
  hotkeys,
  onSave,
}: {
  action: (typeof ACTIONS)[number];
  hotkeys: Hotkeys;
  onSave: (next: Hotkeys) => void;
}) {
  const { pop } = useNavigation();
  const save = (value: Hotkey | null) => {
    onSave({ ...hotkeys, actions: { ...hotkeys.actions, [action.id]: value } });
    pop();
  };
  return (
    <Form
      navigationTitle={action.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Hotkey"
            icon={Icon.Check}
            onSubmit={(v: Values) => {
              const hotkey = toHotkey(v);
              const problem = hotkeyProblem(hotkey, hotkeys, { action: action.id });
              if (problem) return void refuse(problem);
              save(hotkey);
            }}
          />
          {action.id === "select" ? null : (
            <Action title="Remove Hotkey" icon={Icon.Trash} onAction={() => save(null)} />
          )}
          <Action
            title="Use the Default"
            icon={Icon.Undo}
            onAction={() => {
              const problem = hotkeyProblem(action.hotkey, hotkeys, { action: action.id });
              if (problem) return void refuse(problem);
              save(action.hotkey);
            }}
          />
        </ActionPanel>
      }
    >
      {action.id === "select" ? (
        <Form.Description text="Return always works as OK. You can set another key as well." />
      ) : null}
      <KeyFields current={hotkeys.actions[action.id]} />
    </Form>
  );
}

function AppForm({
  pairing,
  existing,
  hotkeys,
  onSave,
}: {
  pairing: Pairing;
  existing?: AppHotkey;
  hotkeys: Hotkeys;
  onSave: (next: Hotkeys) => void;
}) {
  const { pop } = useNavigation();
  const [apps, setApps] = useState<{ name: string; pkg: string }[]>(
    existing ? [{ name: existing.name, pkg: existing.pkg }] : [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const extras = await loadExtraApps();
      const onTV = await installedApps(pairing).catch(() => []);
      const seen = new Set<string>();
      const all = [...(existing ? [{ name: existing.name, pkg: existing.pkg }] : []), ...extras, ...onTV].filter(
        (a) => !seen.has(a.pkg) && seen.add(a.pkg),
      );
      setApps(all);
      setLoading(false);
    })();
  }, []);

  return (
    <Form
      isLoading={loading}
      navigationTitle={existing ? existing.name : "Add an App Hotkey"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Hotkey"
            icon={Icon.Check}
            onSubmit={(v: Values) => {
              const app = apps.find((a) => a.pkg === v.app);
              if (!app) return void refuse("Choose an app.");
              const hotkey = toHotkey(v);
              const problem = hotkeyProblem(hotkey, hotkeys, { app: existing?.pkg ?? app.pkg });
              if (problem) return void refuse(problem);
              const others = hotkeys.apps.filter((a) => a.pkg !== (existing?.pkg ?? app.pkg) && a.pkg !== app.pkg);
              onSave({ ...hotkeys, apps: [...others, { name: app.name, pkg: app.pkg, hotkey }] });
              pop();
            }}
          />
          {existing ? (
            <Action
              title="Remove"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={() => {
                onSave({ ...hotkeys, apps: hotkeys.apps.filter((a) => a.pkg !== existing.pkg) });
                pop();
              }}
            />
          ) : null}
        </ActionPanel>
      }
    >
      <Form.Dropdown id="app" title="App" defaultValue={existing?.pkg}>
        {apps.map((a) => (
          <Form.Dropdown.Item key={a.pkg} value={a.pkg} title={a.name} />
        ))}
      </Form.Dropdown>
      <Form.Description text="Sideloaded apps aren't listed by the TV. Add them under Open App first, and they'll appear here." />
      <KeyFields current={existing?.hotkey} />
    </Form>
  );
}

export default function ChangeHotkeys({
  pairing,
  hotkeys,
  onSave,
}: {
  pairing: Pairing;
  hotkeys: Hotkeys;
  onSave: (next: Hotkeys) => void;
}) {
  const sections = [...new Set(ACTIONS.map((a) => a.section))];
  const reset = async () => {
    const yes = await confirmAlert({
      title: "Reset all hotkeys?",
      message: "Remote's keys go back to their defaults, and your app hotkeys are removed.",
      primaryAction: { title: "Reset", style: Alert.ActionStyle.Destructive },
    });
    if (yes) onSave(defaultHotkeys());
  };
  const resetAction = (
    <Action
      title="Reset All Hotkeys"
      icon={Icon.ArrowCounterClockwise}
      style={Action.Style.Destructive}
      onAction={reset}
    />
  );
  const addApp = (
    <Action.Push
      title="Add an App Hotkey"
      icon={Icon.Plus}
      target={<AppForm pairing={pairing} hotkeys={hotkeys} onSave={onSave} />}
    />
  );

  return (
    <List navigationTitle="Change Hotkeys" searchBarPlaceholder="Find a hotkey">
      <List.Section title="App Hotkeys">
        {hotkeys.apps.map((app) => (
          <List.Item
            key={app.pkg}
            title={app.name}
            icon={Icon.AppWindow}
            accessories={[{ tag: hotkeyLabel(app.hotkey) }]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Change"
                  icon={Icon.Pencil}
                  target={<AppForm pairing={pairing} existing={app} hotkeys={hotkeys} onSave={onSave} />}
                />
                {resetAction}
              </ActionPanel>
            }
          />
        ))}
        <List.Item
          title="Add an App Hotkey"
          icon={Icon.Plus}
          actions={
            <ActionPanel>
              {addApp}
              {resetAction}
            </ActionPanel>
          }
        />
      </List.Section>
      {sections.map((section) => (
        <List.Section key={section} title={section}>
          {ACTIONS.filter((a) => a.section === section).map((action) => (
            <List.Item
              key={action.id}
              title={action.title}
              accessories={[{ tag: hotkeyLabel(hotkeys.actions[action.id]) }]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Change"
                    icon={Icon.Pencil}
                    target={<ActionForm action={action} hotkeys={hotkeys} onSave={onSave} />}
                  />
                  {resetAction}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
