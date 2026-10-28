type FunnelEvent = {
  name: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export function trackFunnelEvent(event: FunnelEvent) {
  if (typeof window === "undefined") return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: event.name, metadata: event.metadata ?? {}, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {});
}
