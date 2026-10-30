"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Subscribes to server change events and refreshes the page — realtime collaboration between both of you. */
export function Live() {
  const router = useRouter();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const es = new EventSource("/api/events");
    es.onmessage = () => { clearTimeout(t); t = setTimeout(() => router.refresh(), 150); };
    return () => { clearTimeout(t); es.close(); };
  }, [router]);
  return null;
}
