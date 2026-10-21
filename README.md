# Packet Studio

A browser-based tool for building, editing and previewing network packets and exporting them as capture files. Packets are assembled layer by layer, every computed field (lengths, checksums, protocol numbers) can be overridden to produce deliberately malformed test traffic, and the result is exported as PCAP, PCAPNG or a ready-to-run Scapy script. Packet Studio never sends packets itself; everything runs in the browser.

> Published with permission from Xtramus.

## Why it exists

Testing how a switch or other network device handles traffic often calls for exact packets: a particular address, a field that is wrong on purpose, or a run of packets whose addresses step through a range. Written by hand in a script, such packets are slow to produce and easy to get subtly wrong, and a wrong length or checksum can make a test measure something other than intended. Packet Studio builds them visually: every field is editable, the decode tree and hex view show the exact bytes that will be written, and the result is a standard capture file that traffic generators and replay tools can use, such as the PCAP replay test in the companion [XMNT web app](https://github.com/isoroku41226971/Xtramus-Modular-Network-Testing/tree/main/web-app).

## Features

- **Layer-based packet builder** with Ethernet, VLAN (including Q-in-Q), IPv4, ARP, ICMP, IGMP, UDP, TCP, DHCP and a Raw layer for arbitrary bytes ([`lib/packet/layers/`](lib/packet/layers/)).
- **Auto-computed fields that can always be overridden**: lengths, checksums and protocol numbers are filled in automatically, but any computed field can be set by hand, and out-of-range values only produce a warning ([`lib/packet/fields.ts`](lib/packet/fields.ts), [`lib/editor/field-edit.ts`](lib/editor/field-edit.ts)).
- **15 built-in templates**, from IPv4/UDP and ARP request/reply to the DHCP handshake, ICMP echo, IGMP and Q-in-Q ([`lib/editor/templates.ts`](lib/editor/templates.ts)).
- **Field variation rules** that change a field across a run of packets: increment, decrement or enumerate values (numbers, MAC addresses and IPv4 addresses), or pick random values within a numeric range ([`lib/variation/`](lib/variation/)).
- **Payload control**: fixed bytes, a zero / incrementing / random pattern of a given size, or padding to a total frame size for frame-size sweeps ([`lib/emulator/payload.ts`](lib/emulator/payload.ts)).
- **Send sequences**: order packet definitions, repeat entries, and set the interval and loop count ([`lib/emulator/sequence.ts`](lib/emulator/sequence.ts)).
- **Live preview**: a virtualized packet list, a Wireshark-style decode tree and a hex view. The preview decodes the exact bytes about to be exported, so a wrong checksum or length shows up immediately ([`lib/editor/preview.ts`](lib/editor/preview.ts), [`components/viewer/`](components/viewer/)).
- **Import and export**: read PCAP / PCAPNG captures into editable packets, and export PCAP, PCAPNG or a Scapy script that reproduces every field byte for byte ([`lib/pcap/`](lib/pcap/), [`lib/scapy/`](lib/scapy/)).
- **Project files** (`.psproj`) saved and reopened through the File System Access API, with a download fallback in browsers that lack it ([`components/file-handle.ts`](components/file-handle.ts)).

## Tech stack and design choices

- **Next.js (App Router) + TypeScript + Tailwind CSS.**
- **The packet engine is pure TypeScript**, independent of React and the DOM. Building, decoding, checksums, PCAP/PCAPNG reading and writing and Scapy generation are plain functions in [`lib/`](lib/).
- **No backend.** Everything a user does (building headers, computing checksums, reading and writing captures, saving projects) is possible in the browser, so there is no server-side component.
- **Lazy sequences.** A sequence's length is pure arithmetic and each packet is built only when needed, so previewing a million-packet sequence never holds more than one packet in memory, and the preview table decodes only its visible rows. Exporting expands the sequence, which is fine at realistic sizes.

## Architecture

```
app/                 pages: home (new / open project) and the studio workspace
components/          React UI
  builder/           packet list, editor dialog, layer stack, field form, variation editor
  viewer/            virtualized packet table, decode tree, export bar
lib/                 framework-independent engine
  packet/            layer registry, layer implementations, build / decode, checksums
  editor/            editing logic: field parsing, templates, layer tiers, project state
  emulator/          packet definitions, payloads, lazy send sequences, capture export
  variation/         variation rules and deterministic pseudo-random values
  pcap/              PCAP and PCAPNG readers and writers
  scapy/             Scapy script generation
types/               File System Access API type additions
```

## Verification

- **744 unit tests** (Vitest) cover the packet engine, editing logic, variation rules, send sequences and file formats. The test suite is not included in this repository.
- **Byte-exact packets.** Layers are checked byte for byte against known-good reference packets, and every layer stack must survive `build → decode → build` unchanged.
- **File formats.** PCAP and PCAPNG headers are checked byte for byte against the format specifications, and importing a capture and exporting it again yields an identical file.
- **Cross-checked with Wireshark and Scapy.** Exported captures open cleanly in Wireshark, which reports their checksums as valid. Generated Scapy scripts were run with `sendp(...)` replaced by `wrpcap(...)`; for six packet types, including the DHCP exchange, the capture Scapy wrote matched Packet Studio's own export byte for byte.
- `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Running locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. `npm run build` produces a production build and `npm run typecheck` runs the TypeScript checks.

## Notes

- The UI text is in Traditional Chinese, the language of the tool's users; code, comments and documentation are in English.
- The visual design (colors, header, dropdown, home page cards) follows the author's companion project, the [XMNT web app](https://github.com/isoroku41226971/Xtramus-Modular-Network-Testing/tree/main/web-app) (a separate repository). Comments that mention "the XMNT web app" refer to files under that project's `web-app/ui/` folder.
- Developed during an internship at Xtramus (July–August 2026).
- No open-source license is granted; all rights are reserved.
