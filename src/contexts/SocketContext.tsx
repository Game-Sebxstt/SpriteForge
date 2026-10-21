"use client"

import { createContext, ReactNode, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface SocketContextProps {
    socket: Socket | null;
}

export const SocketContext = createContext<SocketContextProps | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const url = process.env.NEXT_PUBLIC_WS_URL;
        // No URL configured -> never construct the socket (no connection
        // attempts, no console noise). Collaboration stays dormant until wired.
        if (!url) return;

        const instance = io(url, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
        });

        instance.connect();
        setSocket(instance);

        return () => {
            instance.disconnect();
            setSocket(null);
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
}
