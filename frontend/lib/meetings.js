import { teacherRequest as api } from "@/lib/teaching";

export { api };

export function send(path, method, body) {
  return api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const STATUS = {
  scheduled: { label: "Scheduled", tone: undefined },
  live: { label: "Live now", tone: "good" },
  ended: { label: "Ended", tone: "off" },
  cancelled: { label: "Cancelled", tone: "red" },
};

// A room pass for the live room, from the site: the host's or a student's.
export function hostPass(id) {
  return () => send(`/admin/meetings/${id}/pass`, "POST");
}

export function studentPass(id) {
  return () => send(`/meetings/${id}/pass`, "POST");
}

// ---------------------------------------------------------------------------------------------
// Browser push. The service worker (public/sw.js) shows what the server sends and opens the page
// it points at when the notification is clicked.
// ---------------------------------------------------------------------------------------------

function keyBytes(base64url) {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// "unsupported" | "blocked" | "on" | "off", for this browser.
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

// Asks the browser (from a click), subscribes and tells the server.
export async function turnOnPush(pushKey) {
  if (!pushSupported()) throw new Error("This browser can't show notifications from websites.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("The browser didn't allow notifications. You can allow them in the site settings.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  // The browser asks its push service (Google's, Apple's, Mozilla's) for an address; that can hang
  // when it can't reach it, so give up after a while instead of leaving the switch spinning.
  const giveUp = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("The browser didn't finish setting up notifications. Check the connection and try again.")), 30000),
  );
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey) }), giveUp]));
  await send("/notifications/push", "POST", sub.toJSON());
}

export async function turnOffPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await send("/notifications/push", "DELETE", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
