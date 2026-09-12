// Original vector illustrations for the explicitly labeled sample collection.
// Run: pnpm exec tsx scripts/generate-sample-art.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSampleContent } from "../lib/sample-content.ts";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const output = new URL("../public/images/samples-v1/", import.meta.url);
await mkdir(output, { recursive: true });
const palette = {
  s1n: ["#eee9d8", "#285941"], s1e: ["#eee9d8", "#285941"], s2r: ["#f1efe2", "#bd6337"], s2t: ["#f1efe2", "#3a658e"],
  s3d: ["#2d4057", "#efeddf"], s3k: ["#efeddf", "#2d4057"], s4n1: ["#e7e6dc", "#74796d"], s4n2: ["#a6aaa1", "#4c6153"],
  s4r: ["#31573e", "#eee9d8"], s5e: ["#424849", "#cccebe"], s5d: ["#efeddf", "#c57361"],
  a1: ["#a55738", "#eee3c9"], a2: ["#efeddf", "#557546"], a3: ["#355b43", "#efeddf"], a4: ["#48779b", "#eee9d8"],
  a5: ["#777d7a", "#d9dccc"], a6: ["#e7e6d8", "#929784"], a7: ["#eee3c9", "#3b6a61"], a8: ["#d4843d", "#633f31"],
  p1: ["#3e6692", "#eee9d8"], x1: ["#303737", "#e1e4d9"],
};
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const data = buildSampleContent(new Date("2026-09-12T12:00:00Z"));
for (const listing of data.listings) {
  const key = listing.id.replace("l_samplev1", "");
  const [body, ink] = palette[key];
  const long = /long sleeve|warmup/.test(listing.title);
  const item = listing.type === "disc" ? `
    <circle cx="400" cy="278" r="207" fill="${body}" stroke="#d8d4c3" stroke-width="3"/>
    <circle cx="400" cy="278" r="180" fill="none" stroke="${ink}" stroke-opacity=".38" stroke-width="2"/>
    <circle cx="400" cy="278" r="169" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="2"/>
    <g fill="none" stroke="${ink}" stroke-width="7" stroke-linejoin="round">
    ${/moon/.test(listing.title) ? '<path d="M442 180a105 105 0 1 0 60 174A113 113 0 0 1 442 180Z"/>' : /canoe/.test(listing.title) ? '<path d="M284 286q110 65 233-4l-35 67H322Z"/><path d="m380 222 97 90m-36-127-75 140"/>' : /tent/.test(listing.title) ? '<path d="m299 328 101-161 101 161Z"/><path d="m372 327 28-79 32 79"/>' : /Loop/.test(listing.title) ? '<path d="M312 250c0-110 176-80 176 10 0 120-176 120-176 10 0-65 110-70 110 5 0 46-56 60-56 14"/>' : '<path d="m328 309 71-106 71 106m-147 22h154"/>'}
    </g><text x="400" y="401" text-anchor="middle" fill="${ink}" font-family="Arial" font-size="19" letter-spacing="3">${escape(listing.team.toUpperCase())}</text>` : `
    <path d="M310 89 231 125 ${long ? '146 359 201 387 280 219' : '176 226 247 256 280 195'} 284 454Q401 475 516 454L520 195 ${long ? "599 387 654 359 569 125" : "553 256 624 226 569 125"} 490 89 453 81Q449 123 400 126 351 123 347 81Z" fill="${body}" stroke="#333b32" stroke-opacity=".2" stroke-width="2"/>
    <path d="M347 82q3 42 53 44 50-2 53-44m-170 116 10 232m225-232-11 232m-220 8q112 15 223 0" fill="none" stroke="${ink}" stroke-opacity=".32" stroke-width="3"/>
    <path d="m315 113-26 75m196-75 29 75" stroke="${ink}" stroke-opacity=".2" stroke-width="2"/>
    <text x="400" y="244" text-anchor="middle" fill="${ink}" font-family="Arial" font-size="${listing.team.length > 12 ? 22 : 27}" letter-spacing="3">${escape(listing.team.toUpperCase())}</text>
    <path d="m377 289 24-36 23 36m-45 12h43" fill="none" stroke="${ink}" stroke-width="5"/>
    <text x="400" y="397" text-anchor="middle" fill="${ink}" font-family="Arial" font-size="16" letter-spacing="4">${listing.size}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#3d463b" flood-opacity=".15"/></filter></defs><rect width="800" height="600" fill="#ebe8dc"/><path d="M0 500h800M70 0v500M730 0v500" stroke="#d8d6c9" stroke-width="1"/><g filter="url(#shadow)">${item}</g><rect y="525" width="800" height="75" fill="#f5f2e8"/><text x="38" y="569" fill="#2b5b3b" font-family="Arial" font-size="20" font-weight="bold">Poachland ↗</text><text x="760" y="568" text-anchor="end" fill="#625f52" font-family="Arial" font-size="16" letter-spacing="2">SAMPLE ILLUSTRATION</text></svg>`;
  await writeFile(new URL(`${key}.svg`, output), svg);
  await sharp(Buffer.from(svg)).png().toFile(new URL(`${key}.png`, output).pathname);
}
for (const [i, user] of data.users.entries()) {
  const key = user.id.replace("u_samplev1", "");
  const initials = user.displayName.split(" ").map((part) => part[0]).join("");
  const colors = ["#355a43", "#93533b", "#4c6372", "#3c658c", "#6c6243", "#795f65"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="150" fill="${colors[i]}"/><circle cx="150" cy="150" r="128" fill="none" stroke="#ede8d5" stroke-opacity=".5"/><text x="150" y="175" fill="#f4f0df" text-anchor="middle" font-family="Arial" font-size="80">${initials}</text><text x="150" y="229" fill="#f4f0df" text-anchor="middle" font-family="Arial" font-size="15" letter-spacing="4">SAMPLE</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(new URL(`avatar-${key}.png`, output).pathname);
}
console.log(`Created ${data.listings.length} original item illustrations and ${data.users.length} initial avatars.`);
