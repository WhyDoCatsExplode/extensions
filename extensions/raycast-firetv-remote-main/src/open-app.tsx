import {
  Action,
  ActionPanel,
  closeMainWindow,
  Form,
  Icon,
  List,
  launchCommand,
  LaunchType,
  popToRoot,
  showToast,
  Toast,
  useNavigation,
  Keyboard,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { ExtraApp, loadExtraApps, loadPairing, pressIn, saveExtraApps } from "./shared";
import { installedApps, InstalledApp, openApp, Pairing, validPackage } from "./tv";

function AddApp({ onAdd }: { onAdd: (app: ExtraApp) => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle="Add an App"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Add App"
            icon={Icon.Plus}
            onSubmit={({ name, pkg }: { name: string; pkg: string }) => {
              if (!name.trim() || !validPackage(pkg.trim())) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "It needs a name and a package name, like com.example.app",
                });
                return;
              }
              onAdd({ name: name.trim(), pkg: pkg.trim() });
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="For sideloaded apps, which the TV doesn't list." />
      <Form.TextField id="name" title="Name" placeholder="Stremio" />
      <Form.TextField id="pkg" title="Package Name" placeholder="com.stremio.one" />
    </Form>
  );
}

export default function OpenApp() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [extras, setExtras] = useState<ExtraApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, saved] = await Promise.all([loadPairing(), loadExtraApps()]);
      setExtras(saved);
      setPairing(p);
      if (!p) {
        setLoading(false);
        await launchCommand({ name: "pair", type: LaunchType.UserInitiated });
        return;
      }
      try {
        setApps(await installedApps(p));
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "The TV didn't list its apps",
          message: (e as Error).message,
        });
      }
      setLoading(false);
    })();
  }, []);

  const changeExtras = useCallback((next: ExtraApp[]) => {
    setExtras(next);
    saveExtraApps(next);
  }, []);

  const open = async (pkg: string) => {
    if (!pairing) return;
    await closeMainWindow();
    await pressIn(pairing, openApp(pkg));
    await popToRoot({ clearSearchBar: true });
  };

  const addAction = (
    <Action.Push
      title="Add an App"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<AddApp onAdd={(app) => changeExtras([...extras.filter((x) => x.pkg !== app.pkg), app])} />}
    />
  );
  const listed = new Set(apps.map((a) => a.pkg));

  return (
    <List isLoading={loading} searchBarPlaceholder="Open an app on your Fire TV">
      {loading ? null : (
        <List.EmptyView
          icon={Icon.AppWindow}
          title="No Apps Found"
          description="Your TV didn't list any apps. Add one by package name with ⌘N."
          actions={<ActionPanel>{addAction}</ActionPanel>}
        />
      )}
      <List.Section title="Added by You">
        {extras
          .filter((x) => !listed.has(x.pkg))
          .map((app) => (
            <List.Item
              key={app.pkg}
              title={app.name}
              subtitle={app.pkg}
              icon={Icon.AppWindow}
              actions={
                <ActionPanel>
                  <Action title={`Open ${app.name}`} icon={Icon.Play} onAction={() => open(app.pkg)} />
                  {addAction}
                  <Action
                    title="Remove"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={() => changeExtras(extras.filter((x) => x.pkg !== app.pkg))}
                  />
                </ActionPanel>
              }
            />
          ))}
      </List.Section>
      <List.Section title="On Your TV">
        {apps.map((app) => (
          <List.Item
            key={app.pkg}
            title={app.name}
            icon={app.icon ?? Icon.AppWindow}
            actions={
              <ActionPanel>
                <Action title={`Open ${app.name}`} icon={Icon.Play} onAction={() => open(app.pkg)} />
                {addAction}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
