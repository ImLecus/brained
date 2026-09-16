import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
} from "node:crypto";
import { copyFileSync, existsSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { readdir, readFile, rename, rm, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import fg from "fast-glob";
import { homedir } from "node:os";
import type { BrainInfo } from "../../shared/types.js";
import type { EventBus } from "./events.js";

const BRAIN_DIR = join(homedir(), "brained");
const WORK_DIR = join(BRAIN_DIR, ".work");
const MAGIC = Buffer.from("BRAINED1");
const VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const RESYNC_DEBOUNCE = 400;

interface BrainState {
  name: string;
  path: string;
  password: string;
  workDir: string;
  files: Map<string, string>;
  watcher?: FSWatcher;
  resyncTimer?: ReturnType<typeof setTimeout>;
}

function keyOf(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

async function encrypt(state: BrainState, files: Map<string, string>): Promise<Buffer> {
  const payload = JSON.stringify({
    files: Object.fromEntries([...files.entries()].sort(([a], [b]) => a.localeCompare(b))),
  });
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", keyOf(state.password, salt), iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, cipher.getAuthTag(), encrypted]);
}

async function decrypt(path: string, password: string): Promise<Map<string, string>> {
  let blob: Buffer;
  try {
    blob = await readFile(path);
  } catch {
    throw codeError("invalid_file");
  }
  if (blob.length < MAGIC.length + 1 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw codeError("invalid_file");
  }
  const salt = blob.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LENGTH);
  const iv = blob.subarray(
    MAGIC.length + 1 + SALT_LENGTH,
    MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH,
  );
  const tag = blob.subarray(
    MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH,
    MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH,
  );
  const encrypted = blob.subarray(MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", keyOf(password, salt), iv);
  decipher.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw codeError("invalid_password");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plain.toString("utf8"));
  } catch {
    throw codeError("invalid_file");
  }
  const payload = parsed as { files?: Record<string, string> };
  return new Map(Object.entries(payload.files ?? {}));
}

function codeError(code: string): Error {
  const error = new Error(code);
  (error as Error & { code: string }).code = code;
  return error;
}

function sanitizeName(name: string): string {
  const cleaned = name.trim().replace(/[\/\\:*?"<>|]/g, "-");
  if (cleaned.length === 0 || cleaned === "." || cleaned === "..") {
    throw codeError("invalid_name");
  }
  return cleaned;
}

function workDirFor(brainPath: string): string {
  const hash = createHash("sha256").update(brainPath).digest("hex").slice(0, 16);
  return join(WORK_DIR, `${hash}.brain`);
}

async function materialize(state: BrainState): Promise<void> {
  await rm(state.workDir, { recursive: true, force: true });
  await mkdir(state.workDir, { recursive: true });
  for (const [relative, content] of state.files) {
    const target = join(state.workDir, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  const instructions = join(BRAIN_DIR, "AGENTS.md");
  if (existsSync(instructions)) {
    copyFileSync(instructions, join(state.workDir, "AGENTS.md"));
  }
}

export class BrainService {
  private current: BrainState | null = null;

  constructor(private events: EventBus) {}

  status(): { loaded: boolean; name?: string; path?: string } {
    if (!this.current) {
      return { loaded: false };
    }
    return { loaded: true, name: this.current.name, path: this.current.path };
  }

  files(): Map<string, string> {
    return this.current?.files ?? new Map();
  }

  file(relative: string): string | null {
    return this.current?.files.get(relative) ?? null;
  }

  workDir(): string {
    if (!this.current) {
      throw codeError("no_brain");
    }
    return this.current.workDir;
  }

  async list(): Promise<BrainInfo[]> {
    const entries = await readdir(BRAIN_DIR).catch(() => [] as string[]);
    return entries
      .filter((entry) => entry.endsWith(".brain"))
      .sort()
      .map((entry) => ({ name: entry.slice(0, entry.length - ".brain".length), path: join(BRAIN_DIR, entry) }));
  }

  async create(nameInput: string, password: string): Promise<BrainInfo> {
    const name = sanitizeName(nameInput);
    const path = join(BRAIN_DIR, `${name}.brain`);
    if (existsSync(path)) {
      throw codeError("exists");
    }
    this.stopWatch();
    const state: BrainState = {
      name,
      path,
      password,
      workDir: workDirFor(path),
      files: new Map<string, string>([
        [
          "welcome.md",
          "# Welcome\n\nEste cerebro nace vacío. Pide al agente que cree tus primeras notas.\n\n# Welcome\n\nThis brain starts empty. Ask the agent to create your first notes.\n",
        ],
      ]),
    };
    await writeFile(path, await encrypt(state, state.files));
    await materialize(state);
    this.current = state;
    this.startWatch(state);
    return { name, path };
  }

  async open(pathOrName: string, password: string): Promise<BrainInfo> {
    const cleaned = pathOrName.trim();
    const path = cleaned.includes("/") || cleaned.endsWith(".brain")
      ? cleaned
      : join(BRAIN_DIR, `${cleaned}.brain`);
    const files = await decrypt(path, password);
    this.stopWatch();
    const state: BrainState = {
      name: basename(path, ".brain"),
      path,
      password,
      workDir: workDirFor(path),
      files,
    };
    await materialize(state);
    this.current = state;
    this.startWatch(state);
    return { name: state.name, path };
  }

  async save(): Promise<void> {
    if (!this.current) {
      return;
    }
    const blob = await encrypt(this.current, this.current.files);
    const temporary = `${this.current.path}.tmp`;
    await writeFile(temporary, blob);
    await rename(temporary, this.current.path);
  }

  async syncFromDisk(): Promise<void> {
    if (!this.current) {
      return;
    }
    const discovered = await fg("**/*.{md,csv}", {
      cwd: this.current.workDir,
      absolute: false,
      ignore: ["**/node_modules/**", "**/.git/**", "AGENTS.md"],
    });
    const files = new Map<string, string>();
    for (const relative of discovered.sort()) {
      const content = await readFile(join(this.current.workDir, relative), "utf8").catch(() => null);
      if (content !== null) {
        files.set(relative, content);
      }
    }
    this.current.files = files;
  }

  async close(): Promise<void> {
    if (!this.current) {
      return;
    }
    const state = this.current;
    this.stopWatch();
    await this.syncFromDisk();
    await this.save();
    await rm(state.workDir, { recursive: true, force: true });
    this.current = null;
  }

  private startWatch(state: BrainState): void {
    if (state.watcher) {
      return;
    }
    state.watcher = watch(state.workDir, { recursive: true }, () => {
      this.scheduleResync(state);
    });
  }

  private stopWatch(): void {
    if (!this.current) {
      return;
    }
    if (this.current.watcher) {
      this.current.watcher.close();
      this.current.watcher = undefined;
    }
    if (this.current.resyncTimer) {
      clearTimeout(this.current.resyncTimer);
      this.current.resyncTimer = undefined;
    }
  }

  private scheduleResync(state: BrainState): void {
    if (state.resyncTimer) {
      return;
    }
    state.resyncTimer = setTimeout(() => {
      state.resyncTimer = undefined;
      void this.resync(state);
    }, RESYNC_DEBOUNCE);
  }

  private async resync(state: BrainState): Promise<void> {
    if (this.current !== state) {
      return;
    }
    try {
      await this.syncFromDisk();
      await this.save();
      this.events.publish({ type: "file.edited", properties: {} });
    } catch (error) {
      console.error(`brain resync failed: ${String(error)}`);
    }
  }
}