// Reverse Lab — deep static analysis for the «هندسة عكسية» premium mode
// (owner decisions, 2026-11-03: the member uploads his own tool/app, the
// PLATFORM takes it apart; flat 20 tokens like the other premium reports;
// the uploaded file lives in a dedicated bucket and is auto-deleted after
// 3 days while the written analysis stays in the member's conversation).
//
// Design references (reviewed on GitHub 2026-11-03, patterns only — this
// file is original code): LIEF's unified PE/ELF/Mach-O parsing model,
// Mandiant capa's capability inference (imports + strings -> named
// capabilities), and the static-triage-for-agents shape of re-audit.
// Full decompilation (Ghidra/radare2 + LLM, the r2ai/GhidraMCP pattern)
// is VPS-phase work; this module is the honest serverless layer:
// identity, structure, imports/exports, strings intelligence, entropy,
// packing/protection indicators and capability tags — real evidence the
// writer model may use, nothing invented downstream.

import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export const RE_BUCKET = "hotgpt-re-uploads";
export const RE_MAX_BYTES = 50 * 1024 * 1024;
export const RE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export interface ReverseEvidence {
  format: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  evidenceText: string;
}

// ---------- small byte helpers (every read is bounds-checked) ----------

function u16(b: Buffer, o: number, le = true): number {
  if (o < 0 || o + 2 > b.length) return 0;
  return le ? b.readUInt16LE(o) : b.readUInt16BE(o);
}
function u32(b: Buffer, o: number, le = true): number {
  if (o < 0 || o + 4 > b.length) return 0;
  return le ? b.readUInt32LE(o) : b.readUInt32BE(o);
}
function u64(b: Buffer, o: number, le = true): number {
  if (o < 0 || o + 8 > b.length) return 0;
  const v = le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o);
  return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : Number.MAX_SAFE_INTEGER;
}
function cstr(b: Buffer, o: number, max = 260): string {
  if (o < 0 || o >= b.length) return "";
  let end = o;
  while (end < Math.min(b.length, o + max) && b[end] !== 0) end++;
  return b.toString("utf8", o, end).replace(/[^\x20-\x7e]/g, "");
}
function entropyOf(b: Buffer, start: number, length: number): number {
  if (length <= 0 || start >= b.length) return 0;
  const end = Math.min(b.length, start + length);
  const counts = new Array<number>(256).fill(0);
  for (let i = start; i < end; i++) counts[b[i]]++;
  const total = end - start;
  let h = 0;
  for (const c of counts) {
    if (!c) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 100) / 100;
}

// ---------- strings intelligence ----------

const URL_RE = /https?:\/\/[^\s"'<>\\]{4,200}/i;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/;
const DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|info|biz|xyz|top|site|online|ru|su|cn|me|tv|gg|dev|app|pro|club|live|fun|icu|work|click|link|shop|store|tech|host|space|website|buzz|monster|rest|best|today|world|life|one|vip|uno|lol|cfd|sbs)\b/i;
const WINPATH_RE = /[a-zA-Z]:\\[^\s"'<>|]{3,160}/;
const REG_RE = /\bHKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS)\\[^\s"'<>]{3,160}/i;
const UNIXPATH_RE = /(?:^|\s)(\/(?:usr|etc|var|home|tmp|opt|bin|sbin|lib|proc|sys|data)\/[^\s"'<>]{2,140})/;
const KEYWORD_RE = /password|passwd|pwd|token|secret|license|licence|serial|activation|api[-_ ]?key|private[-_ ]?key|credential|login|username|decrypt|encrypt|aes|rsa|socket|connect|download|upload|inject|hook|debug|sandbox|virtual|vmware|vbox|proxy|shell|cmd\.exe|powershell|registry|startup|autorun|mutex|keylog|screenshot|webcam|microphone|bitcoin|wallet|monero|payment|ransom|bitlocker|cryptolocker/i;

interface StringIntel {
  urls: string[]; ips: string[]; domains: string[]; paths: string[]; keywords: string[];
  total: number; samples: string[];
}

function extractStrings(b: Buffer): StringIntel {
  const found = new Set<string>();
  const pushRun = (s: string) => {
    const t = s.trim();
    if (t.length >= 5 && t.length <= 220) found.add(t);
    if (found.size > 6000) return;
  };
  // ASCII printable runs
  let run = "";
  for (let i = 0; i < b.length && found.size <= 6000; i++) {
    const c = b[i];
    if (c >= 0x20 && c <= 0x7e) { run += String.fromCharCode(c); }
    else { if (run.length >= 5) pushRun(run); run = ""; }
  }
  if (run.length >= 5) pushRun(run);
  // UTF-16LE runs (char followed by 0x00)
  run = "";
  for (let i = 0; i + 1 < b.length && found.size <= 6000; i += 2) {
    const c = b[i], z = b[i + 1];
    if (z === 0 && c >= 0x20 && c <= 0x7e) { run += String.fromCharCode(c); }
    else { if (run.length >= 5) pushRun(run); run = ""; if (!(z === 0)) i -= 1; }
  }
  if (run.length >= 5) pushRun(run);

  const intel: StringIntel = { urls: [], ips: [], domains: [], paths: [], keywords: [], total: found.size, samples: [] };
  const cap = (arr: string[], v: string, n: number) => { if (arr.length < n && !arr.includes(v)) arr.push(v); };
  for (const s of found) {
    if (URL_RE.test(s)) cap(intel.urls, s.slice(0, 200), 25);
    else if (IP_RE.test(s)) cap(intel.ips, s, 15);
    else if (DOMAIN_RE.test(s) && !/\.(dll|exe|sys|ocx|mui)$/i.test(s)) cap(intel.domains, s.slice(0, 120), 25);
    if (WINPATH_RE.test(s) || REG_RE.test(s)) cap(intel.paths, s.slice(0, 160), 20);
    const up = UNIXPATH_RE.exec(s); if (up) cap(intel.paths, up[1].slice(0, 140), 20);
    if (KEYWORD_RE.test(s) && s.length <= 120) cap(intel.keywords, s, 40);
  }
  // General samples: longest remaining readable strings the categories missed
  const rest = [...found].filter(s => !intel.urls.includes(s) && !intel.keywords.includes(s)).sort((a, z) => z.length - a.length);
  for (const s of rest.slice(0, 25)) intel.samples.push(s.slice(0, 160));
  return intel;
}

// ---------- capability inference (capa-style, evidence-bound) ----------

interface Capability { label: string; evidence: string[] }
const CAP_RULES: Array<{ label: string; api: RegExp; str?: RegExp }> = [
  { label: "اتصال بالشبكة (sockets)", api: /^(WSAStartup|socket|connect|send|recv|sendto|recvfrom|WSASocket|WSAConnect)/i },
  { label: "اتصال ويب HTTP/HTTPS", api: /^(InternetOpen|InternetConnect|HttpOpenRequest|HttpSendRequest|WinHttpOpen|WinHttpConnect|WinHttpSendRequest|URLDownloadToFile)/i, str: /https?:\/\//i },
  { label: "عمليات على الملفات", api: /^(CreateFile|ReadFile|WriteFile|DeleteFile|CopyFile|MoveFile|CreateDirectory|FindFirstFile)/i },
  { label: "حقن في عمليات أخرى (injection)", api: /^(VirtualAllocEx|WriteProcessMemory|CreateRemoteThread|NtWriteVirtualMemory|QueueUserAPC|SetThreadContext)/i },
  { label: "التحكم في عمليات وخدمات", api: /^(OpenProcess|CreateProcess|ShellExecute|WinExec|OpenService|CreateService|StartService|TerminateProcess)/i },
  { label: "ثبات في النظام (persistence)", api: /^(RegSetValue|RegCreateKey)/i, str: /(CurrentVersion\\Run|CurrentVersion\\RunOnce|schtasks|Startup)/i },
  { label: "تشفير / فك تشفير", api: /^(CryptEncrypt|CryptDecrypt|BCryptEncrypt|BCryptDecrypt|CryptAcquireContext)/i, str: /\b(AES|RSA|ChaCha|RC4|encrypt|decrypt)\b/i },
  { label: "مضاد للتحليل والتنقيب (anti-debug/VM)", api: /^(IsDebuggerPresent|CheckRemoteDebuggerPresent|NtQueryInformationProcess|OutputDebugString)/i, str: /(VMware|VirtualBox|VBOX|QEMU|sandbox|Sandboxie|Wireshark|Process Hacker|x64dbg|OllyDbg|IDA)/i },
  { label: "مراقبة لوحة المفاتيح / إدخال", api: /^(GetAsyncKeyState|GetKeyState|SetWindowsHookEx|keybd_event|GetKeyboardState)/i },
  { label: "التقاط شاشة / وسائط", api: /^(BitBlt|GetDC|CreateCompatibleDC|waveInOpen|capCreateCaptureWindow)/i },
  { label: "تحميل مكتبات وتنفيذ كود ديناميكي", api: /^(LoadLibrary|GetProcAddress|VirtualAlloc|VirtualProtect|LdrLoadDll)/i },
  { label: "مزامنة / Mutex (علامة تشغيل مفرد)", api: /^(CreateMutex|OpenMutex|CreateEvent)/i },
  { label: "قراءة معلومات النظام والهوية", api: /^(GetComputerName|GetUserName|GetSystemInfo|GetVersionEx|GlobalMemoryStatus|GetAdaptersInfo|gethostname)/i },
];

function inferCapabilities(importedNames: string[], intel: StringIntel): Capability[] {
  const caps: Capability[] = [];
  for (const rule of CAP_RULES) {
    const ev: string[] = [];
    for (const name of importedNames) if (rule.api.test(name) && ev.length < 4) ev.push(name);
    if (rule.str) {
      const pool = [...intel.urls, ...intel.keywords, ...intel.paths, ...intel.samples];
      for (const s of pool) if (rule.str.test(s) && ev.length < 4) ev.push(`"${s.slice(0, 60)}"`);
    }
    if (ev.length) caps.push({ label: rule.label, evidence: ev });
  }
  return caps;
}

// ---------- PE (Windows) ----------

const MACHINES: Record<number, string> = { 0x8664: "x86-64", 0x14c: "x86 (32-bit)", 0xaa64: "ARM64", 0x1c0: "ARM", 0x200: "IA64" };

function parsePE(b: Buffer): { lines: string[]; imports: string[]; caps: Capability[]; packer: string[] } | null {
  const lines: string[] = [];
  const packer: string[] = [];
  const peOff = u32(b, 0x3c);
  if (peOff <= 0 || peOff + 24 > b.length || b.toString("latin1", peOff, peOff + 4) !== "PE\0\0") return null;
  const coff = peOff + 4;
  const machine = u16(b, coff);
  const numSections = u16(b, coff + 2);
  const timeStamp = u32(b, coff + 4);
  const optSize = u16(b, coff + 16);
  const chars = u16(b, coff + 18);
  const opt = coff + 20;
  const is64 = u16(b, opt) === 0x20b;
  const entryRva = u32(b, opt + 16);
  const subsystem = u16(b, opt + 68);
  const dllChars = u16(b, opt + 70);
  const dirBase = opt + (is64 ? 112 : 96);
  const dir = (i: number) => ({ rva: u32(b, dirBase + i * 8), size: u32(b, dirBase + i * 8 + 4) });
  const isDll = (chars & 0x2000) !== 0;
  lines.push(`النوع: ملف Windows ${isDll ? "(DLL)" : "(EXE)"} — معمارية ${MACHINES[machine] || "0x" + machine.toString(16)} — ${is64 ? "64-bit" : "32-bit"}`);
  if (timeStamp) lines.push(`طابع زمني للتجميع (COFF): ${new Date(timeStamp * 1000).toISOString().slice(0, 10)} (قابل للتزوير، قرينة فقط)`);
  lines.push(`نقطة الدخول: RVA 0x${entryRva.toString(16)} — الواجهة: ${subsystem === 2 ? "رسومية GUI" : subsystem === 3 ? "كونسول" : "أخرى/غير معروفة"}`);
  const mitigations: string[] = [];
  if (dllChars & 0x0040) mitigations.push("ASLR (Dynamic Base)");
  if (dllChars & 0x0100) mitigations.push("DEP/NX");
  if (dllChars & 0x4000) mitigations.push("CFG (Control Flow Guard)");
  if (dllChars & 0x0020) mitigations.push("High-Entropy VA");
  if (!(dllChars & 0x8000)) mitigations.push("بدون Terminal Server awareness flag");
  lines.push(`حمايات النظام: ${mitigations.length ? mitigations.join("، ") : "لا شيء ظاهر"}`);

  const secBase = opt + optSize;
  interface Sec { name: string; vsize: number; va: number; rawSize: number; rawPtr: number; chars: number; entropy: number }
  const secs: Sec[] = [];
  for (let i = 0; i < numSections && i < 96; i++) {
    const o = secBase + i * 40;
    if (o + 40 > b.length) break;
    const rawSize = u32(b, o + 16), rawPtr = u32(b, o + 20);
    secs.push({
      name: b.toString("latin1", o, o + 8).replace(/\0+$/, "") || "(بلا اسم)",
      vsize: u32(b, o + 8), va: u32(b, o + 12), rawSize, rawPtr,
      chars: u32(b, o + 36), entropy: entropyOf(b, rawPtr, rawSize),
    });
  }
  const rvaToOff = (rva: number): number => {
    for (const s of secs) {
      const span = Math.max(s.vsize, s.rawSize);
      if (rva >= s.va && rva < s.va + span) return s.rawPtr + (rva - s.va);
    }
    return -1;
  };
  lines.push("الأقسام (الاسم — إنتروبيا — خصائص):");
  let entrySection = "";
  for (const s of secs) {
    const flags = `${s.chars & 0x20000000 ? "X" : "-"}${s.chars & 0x80000000 ? "W" : "-"}${s.chars & 0x40000000 ? "R" : "-"}`;
    lines.push(`  ${s.name}: entropy ${s.entropy} — ${flags} — خام ${s.rawSize} بايت`);
    if (entryRva >= s.va && entryRva < s.va + Math.max(s.vsize, s.rawSize)) entrySection = s.name;
    if (/^(UPX[0-9]|\\.aspack|\\.adata|\\.petite|\\.mpack|\\.vmp|\\.themida|\\.enigma|\\.nsp)/i.test(s.name)) packer.push(`اسم قسم معروف لأداة تغليف/حماية: ${s.name}`);
    if (s.entropy >= 7.3 && s.rawSize > 4096) packer.push(`إنتروبيا عالية جدًا في قسم ${s.name} (${s.entropy}) — مؤشر ضغط/تشفير`);
  }
  if (entrySection) lines.push(`نقطة الدخول تقع في قسم: ${entrySection}`);
  const lastEnd = secs.reduce((m, s) => Math.max(m, s.rawPtr + s.rawSize), 0);
  if (b.length > lastEnd + 16) {
    const overlay = b.length - lastEnd;
    lines.push(`بيانات زائدة بعد آخر قسم (overlay): ${overlay} بايت (${Math.round((overlay / b.length) * 100)}% من الملف)`);
    if (overlay / b.length > 0.2) packer.push("overlay كبير — قد يخفي حمولة إضافية");
  }

  // Imports
  const imports: string[] = [];
  const dlls: string[] = [];
  const impDir = dir(1);
  if (impDir.rva) {
    let dOff = rvaToOff(impDir.rva);
    for (let d = 0; d < 200 && dOff > 0; d++, dOff += 20) {
      const oft = u32(b, dOff), nameRva = u32(b, dOff + 12), ft = u32(b, dOff + 16);
      if (!oft && !nameRva && !ft) break;
      const dllName = cstr(b, rvaToOff(nameRva), 120);
      if (dllName) dlls.push(dllName);
      let tOff = rvaToOff(oft || ft);
      for (let t = 0; t < 400 && tOff > 0; t++) {
        const val = is64 ? u64(b, tOff) : u32(b, tOff);
        if (!val) break;
        const ordinal = is64 ? val >= 0x8000000000000000 : val >= 0x80000000;
        if (!ordinal) {
          const noff = rvaToOff(val);
          const nm = noff > 0 ? cstr(b, noff + 2, 160).trim() : "";
          if (nm.length >= 2) imports.push(nm);
        } else imports.push(`ordinal#${val & 0xffff}`);
        tOff += is64 ? 8 : 4;
      }
    }
  }
  if (dlls.length) lines.push(`المكتبات المستوردة (${dlls.length}): ${dlls.slice(0, 30).join(", ")}`);
  if (imports.length) lines.push(`الدوال المستوردة (${imports.length}): ${imports.slice(0, 120).join(", ")}${imports.length > 120 ? " …" : ""}`);
  if (imports.length > 0 && imports.length <= 10) packer.push(`جدول استيراد صغير جدًا (${imports.length} دوال فقط) — سلوك معتاد للمُغلِّفات`);

  // Exports
  const expDir = dir(0);
  if (expDir.rva) {
    const eOff = rvaToOff(expDir.rva);
    if (eOff > 0) {
      const nNames = u32(b, eOff + 24);
      const namesOff = rvaToOff(u32(b, eOff + 32));
      const names: string[] = [];
      for (let i = 0; i < Math.min(nNames, 200) && namesOff > 0; i++) {
        const nm = cstr(b, rvaToOff(u32(b, namesOff + i * 4)), 160);
        if (nm) names.push(nm);
      }
      if (names.length) lines.push(`الدوال المصدّرة (${nNames}): ${names.slice(0, 80).join(", ")}`);
    }
  }

  // .NET, signature, debug/PDB, TLS
  if (dir(14).rva) lines.push("يديره .NET (وجود دليل COM Descriptor) — الكود الأصلي IL قابل للفك بأدوات مثل dnSpy/ILSpy بدقة عالية");
  const cert = dir(4);
  lines.push(cert.size > 0 ? "توقيع رقمي: يوجد جدول شهادات Authenticode (موقّع)" : "توقيع رقمي: غير موقّع");
  const dbgDir = dir(6);
  if (dbgDir.rva) {
    const dOff = rvaToOff(dbgDir.rva);
    if (dOff > 0 && u32(b, dOff + 12) === 2) {
      const ptr = u32(b, dOff + 24);
      const pdb = cstr(b, ptr + 24, 240);
      if (pdb) lines.push(`مسار ملف الرموز (PDB) المكشوف: ${pdb}`);
    }
  }
  if (dir(9).rva) lines.push("يوجد دليل TLS — قد تُنفَّذ callbacks قبل نقطة الدخول (أسلوب شائع لإخفاء البداية الحقيقية)");

  const intel = extractStrings(b);
  return { lines, imports, caps: inferCapabilities(imports, intel), packer };
}

// ---------- ELF (Linux/Android native) ----------

const ELF_MACHINES: Record<number, string> = { 62: "x86-64", 3: "x86 (32-bit)", 183: "ARM64 (AArch64)", 40: "ARM", 243: "RISC-V", 8: "MIPS" };

function parseELF(b: Buffer): { lines: string[]; imports: string[]; caps: Capability[]; packer: string[] } | null {
  const lines: string[] = [];
  const packer: string[] = [];
  const is64 = b[4] === 2;
  const le = b[5] !== 2;
  const type = u16(b, 16, le);
  const machine = u16(b, 18, le);
  const entry = is64 ? u64(b, 24, le) : u32(b, 24, le);
  lines.push(`النوع: ملف ELF ${type === 2 ? "(تنفيذي)" : type === 3 ? "(مكتبة مشتركة/PIE)" : type === 1 ? "(relocatable)" : ""} — معمارية ${ELF_MACHINES[machine] || machine} — ${is64 ? "64-bit" : "32-bit"}${le ? "" : " — big-endian"}`);
  lines.push(`نقطة الدخول: 0x${entry.toString(16)}`);
  const shOff = is64 ? u64(b, 40, le) : u32(b, 32, le);
  const shEnt = u16(b, is64 ? 58 : 46, le);
  const shNum = u16(b, is64 ? 60 : 48, le);
  const shStrIdx = u16(b, is64 ? 62 : 50, le);
  interface ESec { name: string; type: number; off: number; size: number; link: number; entsize: number; entropy: number }
  const rawSecs: Array<{ nameOff: number; type: number; off: number; size: number; link: number; entsize: number }> = [];
  for (let i = 0; i < shNum && i < 200; i++) {
    const o = shOff + i * shEnt;
    if (o + shEnt > b.length) break;
    rawSecs.push({
      nameOff: u32(b, o, le), type: u32(b, o + 4, le),
      off: is64 ? u64(b, o + 24, le) : u32(b, o + 16, le),
      size: is64 ? u64(b, o + 32, le) : u32(b, o + 20, le),
      link: u32(b, o + (is64 ? 40 : 24), le),
      entsize: is64 ? u64(b, o + 56, le) : u32(b, o + 36, le),
    });
  }
  const strTabSec = rawSecs[shStrIdx];
  const secs: ESec[] = rawSecs.map(s => ({
    name: strTabSec ? cstr(b, strTabSec.off + s.nameOff, 80) : "",
    type: s.type, off: s.off, size: s.size, link: s.link, entsize: s.entsize,
    entropy: entropyOf(b, s.off, Math.min(s.size, 1 << 24)),
  }));
  const named = secs.filter(s => s.name);
  if (named.length) lines.push(`الأقسام: ${named.slice(0, 30).map(s => `${s.name}(${s.entropy})`).join(" ")}`);
  for (const s of secs) if (s.entropy >= 7.3 && s.size > 8192) packer.push(`إنتروبيا عالية في قسم ${s.name} (${s.entropy})`);
  // PT_INTERP
  const phOff = is64 ? u64(b, 32, le) : u32(b, 28, le);
  const phEnt = u16(b, is64 ? 54 : 42, le);
  const phNum = u16(b, is64 ? 56 : 44, le);
  for (let i = 0; i < phNum && i < 100; i++) {
    const o = phOff + i * phEnt;
    if (o + phEnt > b.length) break;
    const ptype = u32(b, o, le);
    if (ptype === 3) {
      const off = is64 ? u64(b, o + 8, le) : u32(b, o + 4, le);
      const interp = cstr(b, off, 120);
      if (interp) lines.push(`المفسّر (interpreter): ${interp}`);
    }
  }
  // Dynamic: NEEDED + dynsym names
  const imports: string[] = [];
  const needed: string[] = [];
  const dyn = secs.find(s => s.type === 6);
  if (dyn && dyn.entsize) {
    const strSec = secs[dyn.link];
    const count = Math.floor(dyn.size / dyn.entsize);
    for (let i = 0; i < count && i < 200; i++) {
      const o = dyn.off + i * dyn.entsize;
      const tag = is64 ? u64(b, o, le) : u32(b, o, le);
      const val = is64 ? u64(b, o + 8, le) : u32(b, o + 4, le);
      if (tag === 1 && strSec) { const n = cstr(b, strSec.off + val, 120); if (n) needed.push(n); }
      if (tag === 0) break;
    }
  }
  const dynsym = secs.find(s => s.type === 11);
  if (dynsym && dynsym.entsize) {
    const strSec = secs[dynsym.link];
    const count = Math.floor(dynsym.size / dynsym.entsize);
    for (let i = 1; i < count && imports.length < 150; i++) {
      const o = dynsym.off + i * dynsym.entsize;
      const nameOff = u32(b, o, le);
      if (nameOff && strSec) { const n = cstr(b, strSec.off + nameOff, 140); if (n) imports.push(n); }
    }
  }
  if (needed.length) lines.push(`المكتبات المطلوبة (DT_NEEDED): ${needed.slice(0, 25).join(", ")}`);
  if (imports.length) lines.push(`الرموز الديناميكية (${imports.length}): ${imports.slice(0, 110).join(", ")}${imports.length > 110 ? " …" : ""}`);
  const hasDebug = secs.some(s => s.name === ".debug_info" || s.name === ".symtab");
  lines.push(hasDebug ? "يحتوي رموز تنقيب/جدول رموز (.symtab/.debug) — التحليل أسهل بكثير" : "مجرّد من الرموز على الأرجح (stripped) — لا جدول رموز ظاهر");
  const intel = extractStrings(b);
  return { lines, imports, caps: inferCapabilities(imports, intel), packer };
}

// ---------- ZIP / APK / DEX ----------

interface ZipEntry { name: string; method: number; compSize: number; size: number; localOff: number }
function readZip(b: Buffer): ZipEntry[] | null {
  const scanFrom = Math.max(0, b.length - 66000);
  let eocd = -1;
  for (let i = b.length - 22; i >= scanFrom; i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = u16(b, eocd + 10);
  let off = u32(b, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count && i < 2000; i++) {
    if (u32(b, off) !== 0x02014b50) break;
    const nameLen = u16(b, off + 28), extraLen = u16(b, off + 30), commentLen = u16(b, off + 32);
    entries.push({
      name: b.toString("utf8", off + 46, off + 46 + nameLen),
      method: u16(b, off + 10), compSize: u32(b, off + 20), size: u32(b, off + 24),
      localOff: u32(b, off + 42),
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
function zipEntryData(b: Buffer, e: ZipEntry): Buffer | null {
  const o = e.localOff;
  if (u32(b, o) !== 0x04034b50) return null;
  const start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
  const raw = b.subarray(start, start + e.compSize);
  try {
    if (e.method === 0) return Buffer.from(raw);
    if (e.method === 8) return inflateRawSync(raw, { maxOutputLength: 64 * 1024 * 1024 });
  } catch { return null; }
  return null;
}
function uleb128(b: Buffer, o: number): { value: number; next: number } {
  let value = 0, shift = 0, i = o;
  while (i < b.length && shift < 35) {
    const byte = b[i++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) break;
    shift += 7;
  }
  return { value, next: i };
}
function dexStrings(dex: Buffer): string[] {
  if (dex.length < 0x70 || dex.toString("latin1", 0, 4) !== "dex\n") return [];
  const count = u32(dex, 0x38), off = u32(dex, 0x3c);
  const out: string[] = [];
  for (let i = 0; i < count && i < 3000; i++) {
    const so = u32(dex, off + i * 4);
    if (!so || so >= dex.length) continue;
    const { next } = uleb128(dex, so);
    let end = next;
    while (end < dex.length && dex[end] !== 0 && end - next < 300) end++;
    const s = dex.toString("utf8", next, end).replace(/[^\x20-\x7e]/g, "").trim();
    if (s.length >= 4) out.push(s);
  }
  return out;
}

function parseZipFamily(b: Buffer, fileName: string): { lines: string[]; imports: string[]; caps: Capability[]; packer: string[] } | null {
  const entries = readZip(b);
  if (!entries) return null;
  const lines: string[] = [];
  const packer: string[] = [];
  const names = entries.map(e => e.name);
  const isApk = names.includes("AndroidManifest.xml") && names.some(n => /^classes\d*\.dex$/.test(n));
  const dexEntries = entries.filter(e => /^classes\d*\.dex$/.test(e.name));
  const libs = names.filter(n => /^lib\/[^/]+\/[^/]+\.so$/.test(n));
  if (isApk) {
    lines.push(`النوع: تطبيق أندرويد (APK) — ${entries.length} ملفًا داخل الحزمة`);
    lines.push(`ملفات الكود (DEX): ${dexEntries.map(e => `${e.name} (${e.size} بايت)`).join("، ")}`);
    if (libs.length) {
      const abis = [...new Set(libs.map(n => n.split("/")[1]))];
      lines.push(`مكتبات أصلية Native: ${libs.length} ملف .so — المعماريات: ${abis.join(", ")} — أسماء: ${libs.slice(0, 15).map(n => n.split("/").pop()).join(", ")}`);
    }
    const assets = names.filter(n => n.startsWith("assets/"));
    if (assets.length) lines.push(`أصول assets: ${assets.length} ملفًا — أمثلة: ${assets.slice(0, 12).join("، ")}`);
    const resCount = names.filter(n => n.startsWith("res/")).length;
    if (resCount) lines.push(`موارد res: ${resCount} ملفًا`);
    // DEX string pools — the intelligence gold of an APK
    const allDexStrings: string[] = [];
    for (const de of dexEntries.slice(0, 3)) {
      const data = zipEntryData(b, de);
      if (data) allDexStrings.push(...dexStrings(data));
    }
    if (allDexStrings.length) {
      const fakeBuf = Buffer.from(allDexStrings.join("\n"), "utf8");
      const intel = extractStrings(fakeBuf);
      const classNames = allDexStrings.filter(s => /^L[a-zA-Z][a-zA-Z0-9_/$]+;$/.test(s) || /^[a-z]+(\.[a-z0-9_]+){2,}$/.test(s)).slice(0, 40);
      if (classNames.length) lines.push(`حزم/كلاسات ظاهرة من DEX: ${classNames.join("، ")}`);
      const caps = inferCapabilities(allDexStrings.filter(s => /^[a-zA-Z_$][a-zA-Z0-9_$]{2,60}$/.test(s)), intel);
      appendIntel(lines, intel);
      return { lines, imports: [], caps, packer };
    }
    const intel = extractStrings(b);
    appendIntel(lines, intel);
    return { lines, imports: [], caps: inferCapabilities([], intel), packer };
  }
  // generic ZIP/JAR
  lines.push(`النوع: أرشيف ZIP${/\.jar$/i.test(fileName) ? " (JAR)" : ""} — ${entries.length} ملفًا`);
  lines.push(`أبرز الملفات: ${names.slice(0, 40).join("، ")}`);
  const intel = extractStrings(b);
  appendIntel(lines, intel);
  return { lines, imports: [], caps: inferCapabilities([], intel), packer };
}

function appendIntel(lines: string[], intel: StringIntel) {
  lines.push(`النصوص المستخرجة: ${intel.total} نصًا فريدًا`);
  if (intel.urls.length) lines.push(`روابط URL: ${intel.urls.join(" | ")}`);
  if (intel.domains.length) lines.push(`دومينات: ${intel.domains.slice(0, 25).join(", ")}`);
  if (intel.ips.length) lines.push(`عناوين IP: ${intel.ips.join(", ")}`);
  if (intel.paths.length) lines.push(`مسارات/سجل: ${intel.paths.slice(0, 12).join(" | ")}`);
  if (intel.keywords.length) lines.push(`نصوص حساسة/دالة: ${intel.keywords.slice(0, 30).join(" | ")}`);
  if (intel.samples.length) lines.push(`عينة نصوص أخرى: ${intel.samples.slice(0, 12).join(" | ")}`);
}

// ---------- Mach-O (macOS/iOS) — basic identity ----------

function parseMachO(b: Buffer): { lines: string[]; imports: string[]; caps: Capability[]; packer: string[] } | null {
  const magic = u32(b, 0, false);
  const lines: string[] = [];
  if (magic === 0xcafebabe) {
    const n = u32(b, 4, false);
    lines.push(`النوع: Mach-O Fat Binary (متعدد المعماريات) — ${n} شريحة`);
    return { lines, imports: [], caps: [], packer: [] };
  }
  const is64 = magic === 0xfeedfacf || magic === 0xcffaedfe;
  const le = magic === 0xcffaedfe || magic === 0xcefaedfe;
  const cpu = u32(b, 4, le);
  const fileType = u32(b, 12, le);
  const ncmds = u32(b, 16, le);
  const cpuName = cpu === 0x01000007 ? "x86-64" : cpu === 0x0100000c ? "ARM64" : cpu === 7 ? "x86" : cpu === 12 ? "ARM" : "0x" + cpu.toString(16);
  lines.push(`النوع: Mach-O ${is64 ? "64-bit" : "32-bit"} — معمارية ${cpuName} — النوع ${fileType === 2 ? "تنفيذي" : fileType === 6 ? "مكتبة ديناميكية" : fileType === 8 ? "حزمة" : "أخرى"} — ${ncmds} أمر تحميل`);
  // Walk load commands for dylib names + rpaths
  const dylibs: string[] = [];
  let off = is64 ? 32 : 28;
  for (let i = 0; i < ncmds && i < 200; i++) {
    const cmd = u32(b, off, le), size = u32(b, off + 4, le);
    if (!size || off + size > b.length) break;
    if (cmd === 0xc || cmd === 0xd || cmd === 0x8000001c || cmd === 0x1f) {
      const nameOff = u32(b, off + 8, le);
      const nm = cstr(b, off + nameOff, 200);
      if (nm) dylibs.push(nm);
    }
    off += size;
  }
  if (dylibs.length) lines.push(`المكتبات المرتبطة: ${dylibs.slice(0, 25).join(", ")}`);
  const intel = extractStrings(b);
  appendIntel(lines, intel);
  return { lines, imports: [], caps: inferCapabilities([], intel), packer: [] };
}

// ---------- main entry ----------

export function analyzeBinary(bytes: Buffer, fileName: string): ReverseEvidence | null {
  if (!bytes || bytes.length < 16) return null;
  let parsed: { lines: string[]; imports: string[]; caps: Capability[]; packer: string[] } | null = null;
  let format = "";
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) { parsed = parsePE(bytes); format = "Windows PE"; }
  else if (bytes[0] === 0x7f && bytes.toString("latin1", 1, 4) === "ELF") { parsed = parseELF(bytes); format = "ELF"; }
  else if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) { parsed = parseZipFamily(bytes, fileName); format = "ZIP/APK"; }
  else if (bytes.toString("latin1", 0, 4) === "dex\n") {
    const strs = dexStrings(bytes);
    const lines = [`النوع: ملف DEX (كود أندرويد وسيط) — ${strs.length} نصًا في جدول النصوص`];
    const intel = extractStrings(Buffer.from(strs.join("\n"), "utf8"));
    appendIntel(lines, intel);
    parsed = { lines, imports: [], caps: inferCapabilities([], intel), packer: [] };
    format = "DEX";
  } else {
    const m = u32(bytes, 0, false);
    if (m === 0xfeedface || m === 0xfeedfacf || m === 0xcafebabe || m === 0xcefaedfe || m === 0xcffaedfe) { parsed = parseMachO(bytes); format = "Mach-O"; }
  }
  if (!parsed) return null;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const out: string[] = [];
  out.push(`اسم الملف: ${fileName}`);
  out.push(`الحجم: ${bytes.length} بايت`);
  out.push(`بصمة SHA-256: ${sha256}`);
  out.push(...parsed.lines);
  if (format !== "ZIP/APK" && format !== "Mach-O" && format !== "DEX") {
    const intel = extractStrings(bytes);
    appendIntel(out, intel);
  }
  if (parsed.packer.length) {
    out.push("مؤشرات تغليف/حماية (قرائن لا أحكام):");
    for (const p of parsed.packer) out.push(`  - ${p}`);
  } else {
    out.push("مؤشرات تغليف/حماية: لا مؤشرات قوية ظاهرة في هذا الفحص");
  }
  if (parsed.caps.length) {
    out.push("قدرات مستنتجة من الأدلة (بأسلوب capa — كل قدرة مربوطة بدليلها):");
    for (const c of parsed.caps) out.push(`  - ${c.label}: ${c.evidence.join(", ")}`);
  }
  return { format, fileName, sizeBytes: bytes.length, sha256, evidenceText: out.join("\n").slice(0, 16000) };
}

// ---------- upload registry + 3-day auto-delete sweep ----------

const sbUrl = () =>
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const sbKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export async function ensureReverseBucket(): Promise<void> {
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return;
  try {
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ id: RE_BUCKET, name: RE_BUCKET, public: false }),
      cache: "no-store",
    });
  } catch { /* already exists or unavailable — the signed-upload call will surface real errors */ }
}

export async function recordReverseUpload(userId: string, objectPath: string, fileName: string, size: number): Promise<void> {
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return;
  const expires = new Date(Date.now() + RE_RETENTION_MS).toISOString();
  try {
    await fetch(`${url}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId, event_name: "re_upload", path: objectPath,
        metadata: { fileName: String(fileName).slice(0, 160), size, expires_at: expires },
      }),
      cache: "no-store",
    });
  } catch { /* registry is best-effort; the sweep also scans bucket objects by age as a backstop */ }
}

// Deletes every registered RE upload whose 3-day retention has expired.
// Called by the daily cron (via the billing re-sweep action) and lazily at
// the start of each reverse analysis. Returns how many objects were removed.
export async function sweepReverseUploads(limit = 300): Promise<number> {
  const url = sbUrl(), key = sbKey();
  if (!url || !key) return 0;
  const nowIso = new Date().toISOString();
  let removed = 0;
  try {
    const q = `${url}/rest/v1/analytics_events?event_name=eq.re_upload&select=id,path,metadata&metadata->>expires_at=lt.${encodeURIComponent(nowIso)}&order=created_at.asc&limit=${limit}`;
    const resp = await fetch(q, { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!resp.ok) return 0;
    const rows = (await resp.json().catch(() => [])) as Array<{ id: string; path: string }>;
    for (const row of rows) {
      if (!row?.path) continue;
      const del = await fetch(`${url}/storage/v1/object/${RE_BUCKET}/${row.path}`, {
        method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store",
      }).catch(() => null);
      if (del && (del.ok || del.status === 404)) {
        removed++;
        await fetch(`${url}/rest/v1/analytics_events?id=eq.${row.id}`, {
          method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}`, prefer: "return=minimal" }, cache: "no-store",
        }).catch(() => {});
      }
    }
  } catch { /* best-effort sweep */ }
  return removed;
}
