import { Vector } from "./Vector"
import { Shape } from "../instances/Shape"
import { Sprite } from "../instances/_shapes/Sprite";
import { v4 as uuidv4 } from "uuid";
import { Render } from "../Render";
import { Arrow } from "../instances/_shapes/Arrow";
import type {
    ControllerKeyWords,
    ControllerStatus,
    ControllerConfig,
    ControllerProps,
} from "../types/Controller";
import type { ControllerRawData } from "../types/raw";

/**
 * Controller class for handling keyboard input, movement, physics, and animations
 * Provides a complete input system with jump physics, gravity, and state-based animations
 * Supports binding/unbinding to different shapes for flexible control management
 */
export class Controller {
    /** Controller unique identifier */
    private _id: string;
    /** The render instance associated with the controller */
    private _render: Render;
    /** The shape currently being controlled, null if unbound */
    private _target: Shape | null = null;
    /** Keyboard mappings for controller actions */
    private _keywords: ControllerKeyWords;
    /** Animation patterns for different controller states */
    private _status: ControllerStatus;
    /** Directional vectors for movement configuration */
    private _config: ControllerConfig = {
        up: Vector.up,
        down: Vector.down,
        left: Vector.left,
        right: Vector.right
    };
    /** Movement speed multiplier */
    private _speed: number = 1;
    /** Set of currently pressed keys */
    private _keysPressed: Set<string> = new Set();
    /** Current animation status for state management */
    private _currentStatus: string | null = null;

    /** Debug arrow for velocity */
    private _velocityArrow: Arrow;
    /** Debug arrow for gravity */
    private _gravityArrow: Arrow;

    /** Last ground position for jump physics calculations */
    private _lastPosition: Vector = Vector.zero;
    /** Direction of movement */
    private _direction: Vector = Vector.zero;
    /** Current velocity vector for physics simulation */
    private _velocity: Vector = Vector.zero;
    /** Jump force applied when jumping (positive Y moves down) */
    private _jumpForce: Vector;
    /** Whether the controller is currently jumping */
    private _isJumping: boolean = false;
    /** Cool down for jump */
    private _coolDownJump: number = 0.15 * 1000; // Miliseconds
    /** Last jump time */
    private _lastJumpTime: number = performance.now();
    /** Gravity force constantly applied during jumps */
    private _gravity: Vector = new Vector(0, 0.5);
    /** Whether the controlled shape is currently on the ground */
    private _isOnGround: boolean = true;
    /** Bound reference to the keydown handler for add/removeEventListener parity */
    private _onKeyDownBind: (event: KeyboardEvent) => void = this._onKeyDown.bind(this);
    /** Bound reference to the keyup handler for add/removeEventListener parity */
    private _onKeyUpBind: (event: KeyboardEvent) => void = this._onKeyUp.bind(this);

    /**
     * Creates a new Controller instance with the specified configuration
     * @param props - Configuration object containing keywords, status patterns, and speed
     * @param props.keywords - Keyboard mappings for controller actions (defaults: w/s/a/d/space)
     * @param props.status - Animation patterns for different states
     * @param props.speed - Movement speed multiplier (default: 1)
     */
    public constructor(props: ControllerProps, render: Render, id?: string) {
        this._id = id ?? uuidv4();
        this._keywords = props.keywords ?? { up: "w", down: "s", left: "a", right: "d", jump: "space" };
        this._speed = props.speed ?? 1;
        this._jumpForce = new Vector(0, props.jumpForce ?? 15);
        this._status = props.status ?? {
            up: ["0"],
            down: ["0"],
            left: ["0"],
            right: ["0"],
            jump: ["0"],
            fall: ["0"],
            idle: ["0"]
        };

        this._velocityArrow = render.creator.Arrow({
            position: Vector.zero,
            target: Vector.zero,
            color: "red",
            strokeWidth: 3,
            zIndex: 1000
        });

        this._velocityArrow._autoSave = false;

        this._gravityArrow = render.creator.Arrow({
            position: Vector.zero,
            target: Vector.zero,
            color: "blue",
            strokeWidth: 3,
            zIndex: 1000
        });

        this._gravityArrow._autoSave = false;

        this._render = render;
        render._controllers.set(this._id, this);
        this._setup();
    }

    /**
     * Initializes the controller by setting up event listeners.
     * The per-frame update is now driven by the single `Render` tick
     * (see {@link tick}); the controller no longer owns its own rAF loop.
     * @private
     */
    private _setup(): void {
        this._events();
    }

    /**
     * Restores the controller to its initial state
     * @private
     */
    private _restore(): void {
        this._keysPressed.clear();
        this._currentStatus = null;
        this._isOnGround = true;
        this._velocity = Vector.zero;
    }

    /**
     * Sets up keyboard event listeners for keydown and keyup events
     * Manages the set of currently pressed keys for input handling
     * @private
     */
    private _events(): void {
        document.addEventListener("keydown", this._onKeyDownBind);
        document.addEventListener("keyup", this._onKeyUpBind);
    }

    /**
     * Records a pressed key for input handling.
     * @param event - The keyboard event.
     * @private
     */
    private _onKeyDown(event: KeyboardEvent): void {
        this._keysPressed.add(event.key);
    }

    /**
     * Clears a released key and flushes the pending save once all keys are up,
     * so a controlled sprite's resting position is persisted promptly.
     * @param event - The keyboard event.
     * @private
     */
    private _onKeyUp(event: KeyboardEvent): void {
        this._keysPressed.delete(event.key);
        if (this._keysPressed.size === 0) {
            this._render.flushSave();
        }
    }

    /**
     * Advances the controller one frame (physics, movement, debug arrows).
     * Called once per frame by the single `Render` tick instead of a
     * per-controller `requestAnimationFrame` loop (PERF-1).
     */
    public tick(): void {
        this._updateDebug();
        this._updatePhysics();
        this._updateMovement();
    }

    private _updateDebug(): void {
        if (!this._target || !(this._target as Sprite).debug) {
            this._gravityArrow.visible = false;
            this._velocityArrow.visible = false;
            return;
        }

        this._velocityArrow.visible = true;
        this._gravityArrow.visible = !this._isOnGround;

        const width = this._getWidthSprite();
        const height = this._getHeightSprite();
        const centerOffset = new Vector(width / 2, height / 2);
        
        let totalMovement = Vector.zero;
        
        if (this._direction.x !== 0 || this._direction.y !== 0) {
            totalMovement = totalMovement.add(this._direction.normalize().scale(this._speed));
        }
        
        totalMovement = totalMovement.add(this._velocity);
        
        this._velocityArrow.position = this._target.position.add(centerOffset);
        this._velocityArrow.target = this._velocityArrow.position.add(totalMovement.normalize().scale(100));
        
        this._gravityArrow.position = this._target.position.add(centerOffset);
        this._gravityArrow.target = this._gravityArrow.position.add(this._gravity.normalize().scale(100));
    }

    /**
     * Updates physics simulation including gravity, velocity, and ground collision
     * Only applies physics when the target is not on the ground (jumping/falling)
     * @private
     */
    private _updatePhysics(): void {
        if (!this._target) return;
        if (this._isOnGround) {
            this._velocity = Vector.zero;
            return;
        }

        this._velocity = this._velocity.add(this._gravity);
        this._target.position = this._target.position.add(this._velocity);

        if (this._target.position.y >= this._lastPosition.y) {
            this._isOnGround = true;
            this._velocity = Vector.zero;
            this._target.position.y = this._lastPosition.y;
        }
    }

    /**
     * Handles movement input, jump mechanics, and animation state management
     * Processes keyboard input and updates target position and animation status
     * @private
     */
    private _updateMovement(): void {
        if (!this._target) return;
        let movement = Vector.zero;
        let newStatus: string;

        if (this._keysPressed.has(this._keywords.up)) {
            movement = movement.add(this._config.up);
        }
        if (this._keysPressed.has(this._keywords.down)) {
            movement = movement.add(this._config.down);
        }
        if (this._keysPressed.has(this._keywords.left)) {
            movement = movement.add(this._config.left);
        }
        if (this._keysPressed.has(this._keywords.right)) {
            movement = movement.add(this._config.right);
        }

        this._direction = movement;

        if (this._keysPressed.has(this._keywords.jump) && !this._isJumping && this._isOnGround && performance.now() - this._lastJumpTime > this._coolDownJump) {
            this._lastPosition = this._target.position;
            this._isOnGround = false;
            this._velocity = this._jumpForce.scale(-1);
            this._isJumping = true;
        }

        if (this._keysPressed.size === 0) {
            newStatus = "idle";
        } else {
            if (this._keysPressed.has(this._keywords.jump) && this._isOnGround) {
                newStatus = "jump";
            } else if (this._keysPressed.has(this._keywords.up)) {
                newStatus = "up";
            } else if (this._keysPressed.has(this._keywords.down)) {
                newStatus = "down";
            } else if (this._keysPressed.has(this._keywords.left)) {
                newStatus = "left";
            } else if (this._keysPressed.has(this._keywords.right)) {
                newStatus = "right";
            } else {
                newStatus = "idle";
            }
        }

        if (this._velocity.y < 0 && !this._isOnGround) {
            newStatus = "jump";
        }

        if (this._velocity.y > 0 && !this._isOnGround) {
            newStatus = "fall";
        }

        if (this._isOnGround && this._isJumping) {
            this._lastJumpTime = performance.now();
            this._isJumping = false;
        }

        if (newStatus !== this._currentStatus) {
            this._currentStatus = newStatus;
            if (this._hasPlayMethod(this._target)) {
                this._target.play(this._status[newStatus as keyof ControllerStatus]);
            }
        }

        if ((movement.x !== 0 || movement.y !== 0) && this._isOnGround) {
            const len = movement.len();
            if (len > 0) {
                // Mutate position in place to avoid per-frame Vector allocations
                // in this hot path (PERF-3); the result is consumed immediately.
                this._target.position.x += (movement.x / len) * this._speed;
                this._target.position.y += (movement.y / len) * this._speed;
            }
            this._render.autoSave();
        }
    }

    /**
     * Type guard to check if the target shape has a play method for animations
     * @param target - The shape to check for animation capabilities
     * @returns True if the target has a play method, false otherwise
     * @private
     */
    private _hasPlayMethod(target: Shape): target is Shape & { play: (pattern?: string[]) => void } {
        return 'play' in target && typeof (target as Sprite).play === 'function';
    }

    /**
     * Type guard to check if the target shape has a restorePattern method for animations
     * @param target - The shape to check for animation capabilities
     * @returns True if the target has a restorePattern method, false otherwise
     * @private
     */
    private _hasRestorePatternMethod(target: Shape): target is Shape & { _restorePattern: () => void } {
        return '_restorePattern' in target && typeof (target as Sprite)._restorePattern === 'function';
    }

    /**
     * Gets the width of the sprite
     * @returns The width of the sprite
     * @private
     */
    private _getWidthSprite(): number {
        if (!this._target) return 0;
        return (this._target as Sprite).getWidth();
    }

    /**
     * Gets the height of the sprite
     * @returns The height of the sprite
     * @private
     */
    private _getHeightSprite(): number {
        if (!this._target) return 0;
        return (this._target as Sprite).getHeight();
    }

    /**
     * Gets the current keyboard mappings for controller actions
     * @returns The keyboard configuration object
     */
    public get keywords(): ControllerKeyWords {
        return this._keywords;
    }

    /**
     * Gets the current movement speed multiplier
     * @returns The speed value
     */
    public get speed(): number {
        return this._speed;
    }

    /**
     * Gets the current jump force
     * @returns The jump force value
     */
    public get jumpForce(): Vector {
        return this._jumpForce;
    }

    /**
     * Gets the current controller configuration.
     * @returns The configuration object containing keywords, status, speed, and jumpForce.
     */
    public get config(): ControllerProps {
        return {
            keywords: this._keywords,
            status: this._status,
            speed: this._speed,
            jumpForce: this._jumpForce.y,
        };
    }

    /**
     * Sets new keyboard mappings for controller actions
     * @param value - New keyboard configuration object
     */
    public set keywords(value: ControllerKeyWords) {
        this._keywords = value;
    }

    /**
     * Sets the movement speed multiplier
     * @param value - New speed value (higher = faster movement)
     */
    public set speed(value: number) {
        this._speed = value;
    }

    /**
     * Sets the jump force
     * @param value - New jump force value (higher = stronger jump)
     */
    public set jumpForce(value: Vector) {
        this._jumpForce = value;
    }

    /**
     * Binds the controller to a specific shape for control
     * Allows the controller to move and animate the target shape
     * @param shape - The shape to bind to this controller
     */
    public bind(shape: Shape): void {
        this._target = shape;
        this._restore();
        this._render.autoSave();
    }

    /**
     * Unbinds the controller from its current target
     * The controller will no longer affect any shape until rebound
     */
    public unbind(): void {
        if (this._target && this._hasRestorePatternMethod(this._target)) {
            this._target._restorePattern();
        }

        this._target = null;
        this._restore();
        this._render.flushSave();
    }

    /**
     * Checks if the controller is currently bound to a shape
     * @returns True if the controller is bound, false otherwise
     */
    public isBind(): boolean {
        return this._target !== null;
    }

    /**
     * Destroys the controller and cleans up all resources
     * Stops the update loop, unbinds from target, and clears input state
     */
    public destroy(): void {
        document.removeEventListener("keydown", this._onKeyDownBind);
        document.removeEventListener("keyup", this._onKeyUpBind);

        this._render._controllers.delete(this._id);
        this.unbind();
    }

    /**
     * @internal
     * Returns the raw data of the controller.
     * @returns The raw data of the controller.
     */
    public _rawData() : ControllerRawData {
        return {
            id: this._id,
            type: "controller",
            keywords: this._keywords,
            status: this._status,
            speed: this._speed,
            jumpForce: this._jumpForce.y,
        };
    }

    /**
     * @internal
     * Creates a new controller instance from raw data.
     * @param data - The raw data of the controller.
     * @returns A new `Controller` instance with identical properties.
     */
    public static _fromRawData(data: ControllerRawData, render: Render) : Controller {
        const controller = new Controller(data, render, data.id);
        return controller;
    }
}