"use client"

import { createContext, useRef, useState } from "react";
import { Render } from "@/lib/Render";

interface AppContextProps {
    setup: (canvas: HTMLCanvasElement) => (() => void) | void;
    render: Render | null;
}

export const AppContext = createContext<AppContextProps | null>(null);

export const AppContextProvider = ({ children } : { children: React.ReactNode }) => {
    const [render, setRender] = useState<Render | null>(null);

    const renderRef = useRef<Render | null>(null);

    const setup = (canvas: HTMLCanvasElement): (() => void) | void => {
      if (!canvas) return;

      // StrictMode double-invoke / remount guard: tear down any prior instance
      // this provider created before constructing a new one.
      if (renderRef.current) {
        renderRef.current.destroy();
        renderRef.current = null;
      }

      const instance = new Render(canvas);
      renderRef.current = instance;
      setRender(instance);
      // Do NOT start here; the page.tsx isPlaying effect is the single start owner.

      return () => {
        instance.destroy();
        if (renderRef.current === instance) {
          renderRef.current = null;
        }
      }
    }

    return (
        <AppContext.Provider value={{ setup, render }}>
            {children}
        </AppContext.Provider>
    )
}
