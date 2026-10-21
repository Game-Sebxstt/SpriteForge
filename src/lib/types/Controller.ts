import type { Vector } from "../common/Vector";

export interface ControllerKeyWords {
    up: string
    down: string
    left: string
    right: string
    jump: string
}

export interface ControllerStatus {
    up: string[]
    down: string[]
    left: string[]
    right: string[]
    jump: string[]
    fall: string[]
    idle: string[]
}

export interface ControllerConfig {
    up: Vector
    down: Vector
    left: Vector
    right: Vector
}

export interface ControllerProps {
    keywords: ControllerKeyWords
    status: ControllerStatus
    speed?: number
    jumpForce?: number
}
