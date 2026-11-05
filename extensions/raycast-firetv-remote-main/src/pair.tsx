import { Action, ActionPanel, Form, Icon, popToRoot, showToast, Toast, Keyboard } from "@raycast/api";
import { useEffect, useState } from "react";
import { findFireTVs, FoundTV } from "./discover";
import { savedAddress, savePairing } from "./shared";
import { showPin, verifyPin } from "./tv";

export default function Pair() {
  const [address, setAddress] = useState("");
  const [found, setFound] = useState<FoundTV[]>([]);
  const [searching, setSearching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pinFor, setPinFor] = useState("");

  async function search() {
    setSearching(true);
    const [saved, tvs] = await Promise.all([savedAddress(), findFireTVs().catch(() => [] as FoundTV[])]);
    setFound(tvs);
    // Keep what's already there, unless one TV is the obvious answer.
    setAddress((current) => current || saved || (tvs.length ? tvs[0].address : ""));
    setSearching(false);
  }

  useEffect(() => {
    search();
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const askForPin = () =>
    run(async () => {
      const typed = address.trim();
      if (!typed) throw new Error("Choose a Fire TV, or type its address.");
      await showPin(typed);
      setPinFor(typed);
    });

  const finish = (values: { pin: string }) =>
    run(async () => {
      const pin = values.pin.trim();
      if (!/^\d+$/.test(pin)) throw new Error("The PIN is the numbers on the TV.");
      const token = await verifyPin(pinFor, pin);
      await savePairing({ address: pinFor, token });
      const name = found.find((tv) => tv.address === pinFor)?.name ?? "your Fire TV";
      await showToast({ style: Toast.Style.Success, title: `Paired with ${name}` });
      await popToRoot();
    });

  if (pinFor) {
    return (
      <Form
        isLoading={busy}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Pair" icon={Icon.Link} onSubmit={finish} />
          </ActionPanel>
        }
      >
        <Form.Description text="Enter the PIN showing on your TV." />
        <Form.TextField id="pin" title="PIN" placeholder="1234" />
      </Form>
    );
  }

  const selected = found.some((tv) => tv.address === address) ? address : "";
  return (
    <Form
      isLoading={searching || busy}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Show PIN on TV" icon={Icon.Monitor} onSubmit={askForPin} />
          <Action
            title="Search Again"
            icon={Icon.MagnifyingGlass}
            onAction={search}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
        </ActionPanel>
      }
    >
      {found.length ? (
        <Form.Dropdown
          id="tv"
          title="Found on Your Network"
          value={selected}
          onChange={(value) => {
            if (value) setAddress(value);
          }}
        >
          {selected ? null : <Form.Dropdown.Item value="" title="Choose a Fire TV" />}
          {found.map((tv) => (
            <Form.Dropdown.Item key={tv.address} value={tv.address} title={`${tv.name} (${tv.address})`} />
          ))}
        </Form.Dropdown>
      ) : (
        <Form.Description
          text={
            searching
              ? "Looking for Fire TVs on your network…"
              : "No Fire TV found on your network. Check it's on, or type its address from Settings → My Fire TV → About → Network."
          }
        />
      )}
      <Form.TextField id="address" title="Address" placeholder="192.168.1.50" value={address} onChange={setAddress} />
    </Form>
  );
}
