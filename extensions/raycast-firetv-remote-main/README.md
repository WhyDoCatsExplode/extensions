# Fire TV Remote

Control a Fire TV on your local network from Raycast, with your keyboard. It connects directly to the TV, so there's no account or cloud service, and you don't need ADB or Developer Options.

This is an unofficial extension, and isn't made by or affiliated with Amazon. It uses the local API that Amazon's own remote app uses, which isn't documented, so a Fire TV update could break it.

## Setup

1. Make sure your Mac and your Fire TV are on the same network, and the TV is on.
2. Run **Pair Fire TV**. It searches your network, so choose your TV. If it isn't found, type its address, which is under Settings → My Fire TV → About → Network on the TV.
3. Choose **Show PIN on TV**, then enter the PIN that appears on your TV.

Giving the TV a fixed IP address on your router means you won't need to pair again if its address changes.

## Commands

- **Show Remote:** a remote you control from the keyboard while the window is open.
- **Open App:** apps installed on your TV. Sideloaded apps aren't listed, so add those by package name.
- **Pair Fire TV:** finds your TV and pairs with it.

## Keys in Show Remote

| Default key | Does |
|---|---|
| Arrow keys | Navigate |
| Return | OK |
| B, H, M | Back, Home, Menu |
| P | Play or pause |
| 7, 9 | Rewind, fast forward |
| -, 0, = | Volume down, mute, volume up |
| S | Sleep |
| T, A | Type on TV, Open an App |
| , | Change Hotkeys |

**Change Hotkeys** lets you rebind any of these, and add hotkeys that open a chosen app. Return always stays as OK.

The window shows the first five app hotkeys. They all work, and ⌘K lists every one.

## Limits

- Hotkeys only work while the **Show Remote** window is open.
- Rewind and Fast Forward are single taps, because Raycast doesn't report when a key is released.
- Your keyboard's F keys and media keys can't be used, because they don't reach Raycast.
- Volume control depends on your TV and setup.

## Privacy

Everything stays between your Mac and your TV. The pairing token is kept in Raycast's encrypted local storage. The TV uses a self-signed certificate, so the connection is encrypted but the TV's identity isn't verified.

## Development

```bash
npm install
npm run dev
npm test
```

The tests run against a stand-in TV, so they don't need Raycast or a real TV.
