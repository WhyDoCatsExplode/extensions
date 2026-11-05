// Finds Fire TVs on the network with macOS's own dns-sd tool, which keeps this small: no packet handling
// here. It runs until stopped, so each step listens for a moment and takes what it printed.
import { execFile } from "node:child_process";

export type FoundTV = { name: string; address: string };

const DNS_SD = "/usr/bin/dns-sd";
const SERVICE = "_amzn-wplay._tcp";

const listen = (args: string[], ms: number) =>
  new Promise<string>((resolve) => {
    execFile(DNS_SD, args, { timeout: ms }, (_error, stdout) => resolve(String(stdout)));
  });

// " 12:00:00.000  Add  2  12 local.  _amzn-wplay._tcp.  amzn.dmgr:ABC123" → the instance name
export function parseBrowse(output: string): string[] {
  const names = output
    .split("\n")
    .map((line) => line.match(/\sAdd\s+\d+\s+\d+\s+\S+\s+\S+\s+(.+)$/)?.[1]?.trim())
    .filter((name): name is string => !!name);
  return [...new Set(names)];
}

// From dns-sd -L: "... can be reached at 192-168-1-50.local.:40000 (interface 12)", then the TXT entries,
// with spaces and quotes escaped: "n=Sam\'s\ Fire\ TV".
export function parseLookup(output: string): { host: string; name: string } | null {
  const host = output.match(/can be reached at (\S+?)\.?:\d+/)?.[1];
  if (!host) return null;
  const name = output.match(/(?:^|\s)n=((?:\\.|\S)+(?:\\ (?:\\.|\S)+)*)/m)?.[1]?.replace(/\\(.)/g, "$1") ?? "";
  return { host, name };
}

export const parseAddress = (output: string) => output.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0] ?? null;

export async function findFireTVs(ms = 2500): Promise<FoundTV[]> {
  const instances = parseBrowse(await listen(["-B", SERVICE, "local."], ms));
  const found = await Promise.all(
    instances.map(async (instance): Promise<FoundTV | null> => {
      const lookup = parseLookup(await listen(["-L", instance, SERVICE, "local."], 1500));
      if (!lookup) return null;
      const address = parseAddress(await listen(["-G", "v4", lookup.host], 1500));
      return address ? { name: lookup.name || "Fire TV", address } : null;
    }),
  );
  return found.filter((tv): tv is FoundTV => !!tv);
}
