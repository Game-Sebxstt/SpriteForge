/**
 * A single reversible command (Phase 3 §3.6).
 * `redo` (re)applies the effect; `undo` reverts it. Both are closures over the
 * engine state they mutate, keeping the history engine-agnostic.
 */
export interface Command {
    /** Short label (e.g. "create", "delete", "move", "edit"). */
    label: string;
    /** Re-applies the command's effect. */
    redo: () => void;
    /** Reverts the command's effect. */
    undo: () => void;
}

/**
 * Bounded undo/redo command history (Phase 3 §3.6).
 *
 * Commands are pushed already-applied via {@link push}; {@link undo}/{@link redo}
 * walk the stack. Pushing a new command after an undo discards the redo tail
 * (standard linear history). History is in-memory only — it is never persisted
 * across reloads.
 */
export class History {
    private _undoStack: Command[] = [];
    private _redoStack: Command[] = [];
    private readonly _limit: number;
    /** Guards against re-entrant pushes while a command is (un)doing. */
    private _applying: boolean = false;

    /**
     * @param limit - Maximum retained commands (older ones are dropped).
     */
    public constructor(limit: number = 100) {
        this._limit = limit;
    }

    /** Whether an undo/redo is currently being applied (suppresses recording). */
    public get isApplying(): boolean {
        return this._applying;
    }

    /** Whether there is a command available to undo. */
    public canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    /** Whether there is a command available to redo. */
    public canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    /**
     * Records an ALREADY-APPLIED command. Clears the redo tail and enforces the
     * bound. No-op while a command is being applied (so undo/redo don't recurse).
     * @param command - The reversible command to record.
     */
    public push(command: Command): void {
        if (this._applying) return;
        this._undoStack.push(command);
        if (this._undoStack.length > this._limit) {
            this._undoStack.shift();
        }
        this._redoStack = [];
    }

    /**
     * Executes a command's effect immediately and records it.
     * @param command - The command to run and record.
     */
    public execute(command: Command): void {
        command.redo();
        this.push(command);
    }

    /** Reverts the most recent command, moving it to the redo stack. */
    public undo(): void {
        const command = this._undoStack.pop();
        if (!command) return;
        this._applying = true;
        try {
            command.undo();
        } finally {
            this._applying = false;
        }
        this._redoStack.push(command);
    }

    /** Re-applies the most recently undone command. */
    public redo(): void {
        const command = this._redoStack.pop();
        if (!command) return;
        this._applying = true;
        try {
            command.redo();
        } finally {
            this._applying = false;
        }
        this._undoStack.push(command);
    }

    /** Clears both stacks (e.g. on scene replace). */
    public clear(): void {
        this._undoStack = [];
        this._redoStack = [];
    }
}
