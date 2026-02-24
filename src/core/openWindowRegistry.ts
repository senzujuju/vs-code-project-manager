import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export const DEFAULT_OPEN_WINDOW_HEARTBEAT_MS = 30_000;
export const DEFAULT_OPEN_WINDOW_STALE_AFTER_MS = 90_000;

const DEFAULT_WRITE_DEBOUNCE_MS = 150;
const DEFAULT_NOTIFY_DEBOUNCE_MS = 80;

export interface OpenWindowSessionRecord {
  sessionId: string;
  workspaceUri?: string;
  focused: boolean;
  updatedAt: number;
  badgeColor?: string;
  branch?: string;
}

export interface OpenWindowRegistryOptions {
  sessionsDirectoryPath: string;
  sessionId?: string;
  staleAfterMs?: number;
  writeDebounceMs?: number;
  notifyDebounceMs?: number;
  now?: () => number;
}

export interface OpenWindowRegistryStartInput {
  workspaceUri?: string;
  focused: boolean;
  heartbeatMs?: number;
}

export interface CollectOpenElsewhereUrisInput {
  sessions: OpenWindowSessionRecord[];
  currentSessionId: string;
  now: number;
  staleAfterMs: number;
}

export function collectOpenElsewhereUris({
  sessions,
  currentSessionId,
  now,
  staleAfterMs
}: CollectOpenElsewhereUrisInput): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const session of sessions) {
    if (session.sessionId === currentSessionId) {
      continue;
    }

    if (now - session.updatedAt > staleAfterMs) {
      continue;
    }

    const workspaceUri = session.workspaceUri?.trim();
    if (!workspaceUri || seen.has(workspaceUri)) {
      continue;
    }

    seen.add(workspaceUri);
    result.push(workspaceUri);
  }

  return result;
}

export class OpenWindowRegistry {
  private readonly now: () => number;
  private readonly staleAfterMs: number;
  private readonly writeDebounceMs: number;
  private readonly notifyDebounceMs: number;
  private readonly listeners = new Set<() => void>();
  private readonly sessionId: string;
  private workspaceUri?: string;
  private badgeColor?: string;
  private branch?: string;
  private focused = false;
  private heartbeatMs = DEFAULT_OPEN_WINDOW_HEARTBEAT_MS;
  private watcher?: fs.FSWatcher;
  private writeTimer?: NodeJS.Timeout;
  private notifyTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private started = false;

  constructor(private readonly options: OpenWindowRegistryOptions) {
    this.now = options.now ?? (() => Date.now());
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_OPEN_WINDOW_STALE_AFTER_MS;
    this.writeDebounceMs = options.writeDebounceMs ?? DEFAULT_WRITE_DEBOUNCE_MS;
    this.notifyDebounceMs = options.notifyDebounceMs ?? DEFAULT_NOTIFY_DEBOUNCE_MS;
    this.sessionId = options.sessionId ?? randomUUID();
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start({ workspaceUri, focused, heartbeatMs }: OpenWindowRegistryStartInput): void {
    this.ensureSessionsDirectory();
    this.workspaceUri = normalizeWorkspaceUri(workspaceUri);
    this.focused = focused;
    this.heartbeatMs = normalizeHeartbeatMs(heartbeatMs);
    this.started = true;

    this.persistSessionNow();
    this.startWatcher();
    this.startHeartbeat();
    this.emitDidChange();
  }

  setWorkspaceUri(workspaceUri: string | undefined): void {
    const normalized = normalizeWorkspaceUri(workspaceUri);
    if (normalized === this.workspaceUri) {
      return;
    }

    this.workspaceUri = normalized;
    this.schedulePersistSession();
  }

  setFocused(focused: boolean): void {
    if (focused === this.focused) {
      return;
    }

    this.focused = focused;
    this.schedulePersistSession();
  }

  setBadgeColor(badgeColor: string | undefined): void {
    const normalized = normalizeBadgeColorValue(badgeColor);
    if (normalized === this.badgeColor) {
      return;
    }

    this.badgeColor = normalized;
    this.schedulePersistSession();
  }

  setBranch(branch: string | undefined): void {
    const normalized = normalizeBranchValue(branch);
    if (normalized === this.branch) {
      return;
    }

    this.branch = normalized;
    this.schedulePersistSession();
  }

  refresh(): void {
    this.scheduleEmitDidChange();
  }

  getOpenElsewhereUris(): string[] {
    return collectOpenElsewhereUris({
      sessions: this.readSessionRecords(),
      currentSessionId: this.sessionId,
      now: this.now(),
      staleAfterMs: this.staleAfterMs
    });
  }

  getOpenElsewhereSnapshots(): OpenWindowSessionRecord[] {
    return this.readSessionRecords();
  }

  dispose(): void {
    this.started = false;

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }

    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = undefined;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    try {
      fs.unlinkSync(this.getSessionFilePath());
    } catch {
      return;
    }
  }

  private schedulePersistSession(): void {
    if (!this.started) {
      return;
    }

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined;
      this.persistSessionNow();
      this.scheduleEmitDidChange();
    }, this.writeDebounceMs);
  }

  private persistSessionNow(): void {
    this.ensureSessionsDirectory();

    const payload: OpenWindowSessionRecord = {
      sessionId: this.sessionId,
      workspaceUri: this.workspaceUri,
      focused: this.focused,
      updatedAt: this.now(),
      badgeColor: this.badgeColor,
      branch: this.branch
    };

    try {
      fs.writeFileSync(this.getSessionFilePath(), JSON.stringify(payload), "utf8");
    } catch {
      return;
    }
  }

  private startWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    try {
      this.watcher = fs.watch(this.options.sessionsDirectoryPath, () => {
        this.scheduleEmitDidChange();
      });
    } catch {
      this.watcher = undefined;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.heartbeatTimer = setInterval(() => {
      if (!this.started) {
        return;
      }

      this.persistSessionNow();
      this.scheduleEmitDidChange();
    }, this.heartbeatMs);

    this.heartbeatTimer.unref();
  }

  private ensureSessionsDirectory(): void {
    try {
      fs.mkdirSync(this.options.sessionsDirectoryPath, {
        recursive: true
      });
    } catch {
      return;
    }
  }

  private readSessionRecords(): OpenWindowSessionRecord[] {
    let entries: fs.Dirent[] = [];

    try {
      entries = fs.readdirSync(this.options.sessionsDirectoryPath, {
        withFileTypes: true
      });
    } catch {
      return [];
    }

    const now = this.now();
    const staleFilePaths: string[] = [];
    const records: OpenWindowSessionRecord[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(this.options.sessionsDirectoryPath, entry.name);
      const record = this.readSessionRecord(filePath);
      if (!record) {
        continue;
      }

      if (now - record.updatedAt > this.staleAfterMs) {
        staleFilePaths.push(filePath);
        continue;
      }

      records.push(record);
    }

    for (const staleFilePath of staleFilePaths) {
      try {
        fs.unlinkSync(staleFilePath);
      } catch {
        continue;
      }
    }

    return records;
  }

  private readSessionRecord(filePath: string): OpenWindowSessionRecord | undefined {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<OpenWindowSessionRecord>;

      if (typeof parsed.sessionId !== "string" || parsed.sessionId.trim().length === 0) {
        return undefined;
      }

      if (typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) {
        return undefined;
      }

      return {
        sessionId: parsed.sessionId,
        workspaceUri: normalizeWorkspaceUri(parsed.workspaceUri),
        focused: Boolean(parsed.focused),
        updatedAt: parsed.updatedAt,
        badgeColor: normalizeBadgeColorValue(parsed.badgeColor),
        branch: normalizeBranchValue(parsed.branch)
      };
    } catch {
      return undefined;
    }
  }

  private scheduleEmitDidChange(): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
    }

    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      this.emitDidChange();
    }, this.notifyDebounceMs);
  }

  private emitDidChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private getSessionFilePath(): string {
    return path.join(this.options.sessionsDirectoryPath, `${this.sessionId}.json`);
  }
}

function normalizeWorkspaceUri(workspaceUri: unknown): string | undefined {
  if (typeof workspaceUri !== "string") {
    return undefined;
  }

  const normalized = workspaceUri.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeHeartbeatMs(heartbeatMs: unknown): number {
  if (typeof heartbeatMs !== "number" || !Number.isFinite(heartbeatMs) || heartbeatMs <= 0) {
    return DEFAULT_OPEN_WINDOW_HEARTBEAT_MS;
  }

  return heartbeatMs;
}

function normalizeBadgeColorValue(badgeColor: unknown): string | undefined {
  if (typeof badgeColor !== "string") {
    return undefined;
  }

  const normalized = badgeColor.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

function normalizeBranchValue(branch: unknown): string | undefined {
  if (typeof branch !== "string") {
    return undefined;
  }

  const normalized = branch.trim();
  return normalized.length > 0 ? normalized : undefined;
}
