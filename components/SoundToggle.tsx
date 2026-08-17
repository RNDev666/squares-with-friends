// components/SoundToggle.tsx — mute button + volume slider, persisted locally.
"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_VOLUME, getVolume, play, setVolume } from "@/lib/sfx";

export function SoundToggle() {
  const [vol, setVol] = useState(DEFAULT_VOLUME);
  const lastOn = useRef(DEFAULT_VOLUME);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only SSR hydration guard: localStorage is unreadable during SSR, so we sync it once the client mounts.
    setVol(getVolume());
  }, []);

  const change = (v: number) => {
    setVol(v);
    setVolume(v);
    if (v) {
      lastOn.current = v;
      play("tick"); // audition the new level
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => change(vol ? 0 : lastOn.current)}
        aria-label={vol ? "Mute sound" : "Unmute sound"}
        className="rounded-lg px-1.5 py-1 text-lg leading-none"
      >
        {vol ? "🔊" : "🔇"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={vol}
        onChange={(e) => change(Number(e.target.value))}
        aria-label="Volume"
        className="w-20 accent-indigo-600"
      />
    </div>
  );
}
