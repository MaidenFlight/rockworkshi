// A take that hasn't been sent yet, kept in this browser (IndexedDB) so a reload, a closed tab or a
// walk to another page doesn't lose it. One per song and piece of work, and nothing here ever leaves
// the browser: sending is still the only way a take reaches the school.
//
// The audio and the details are separate records, so renaming a take or nudging it into time
// rewrites a few bytes rather than the whole recording. Every call settles quietly: a browser that
// won't store anything (a private window, no space, storage blocked) just reports that it didn't.

const DB_NAME = "rw-takes";
const AUDIO = "audio";
const DETAILS = "details";
// Takes nobody came back for are cleared after this long.
const KEEP_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser has no IndexedDB."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUDIO);
      request.result.createObjectStore(DETAILS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("The take store is blocked."));
  });
}

// Runs `work(stores)` in one transaction and resolves with what it returns once that commits.
// `work` may return an IDBRequest, whose result is read after the commit.
async function transact(mode, work) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([AUDIO, DETAILS], mode);
      const out = work({ audio: tx.objectStore(AUDIO), details: tx.objectStore(DETAILS) });
      tx.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("The take store gave up."));
    });
  } finally {
    db.close();
  }
}

// Which take this is: the song, and the practice work it's for (if any).
export function takeKey(songId, assignmentId) {
  return `${songId}:${assignmentId || "song"}`;
}

// When a kept take was recorded, for people: the time today, the date and time before that.
export function keptWhen(at) {
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

// Keeps a take: { wav (ArrayBuffer), songTime, duration, number, name, nudgeMs, recordedAt }.
// Resolves true once it's stored, false when this browser won't keep it.
export async function keepTake(key, { wav, ...details }) {
  try {
    await transact("readwrite", ({ audio, details: store }) => {
      audio.put(wav, key);
      store.put({ ...details, key }, key);
      // While here, clear any take left behind long ago.
      const old = Date.now() - KEEP_FOR_MS;
      store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        if ((cursor.value.recordedAt ?? 0) < old) {
          audio.delete(cursor.key);
          cursor.delete();
        }
        cursor.continue();
      };
    });
    return true;
  } catch {
    return false;
  }
}

// Updates a kept take's name or nudge. Resolves false when there was nothing to update or it failed.
export async function updateTake(key, changes) {
  try {
    return await transact("readwrite", ({ details }) => {
      const result = { updated: false };
      details.get(key).onsuccess = (e) => {
        const current = e.target.result;
        if (!current) return;
        details.put({ ...current, ...changes }, key);
        result.updated = true;
      };
      return result;
    }).then((r) => r.updated);
  } catch {
    return false;
  }
}

// The kept take's details, without the audio (for a reminder elsewhere), or null.
export async function takeDetails(key) {
  try {
    return (await transact("readonly", ({ details }) => details.get(key))) ?? null;
  } catch {
    return null;
  }
}

// The kept take with its audio, or null.
export async function readTake(key) {
  try {
    const found = await transact("readonly", ({ audio, details }) => {
      const both = {};
      details.get(key).onsuccess = (e) => (both.details = e.target.result);
      audio.get(key).onsuccess = (e) => (both.wav = e.target.result);
      return both;
    });
    return found.details && found.wav ? { ...found.details, wav: found.wav } : null;
  } catch {
    return null;
  }
}

export async function forgetTake(key) {
  try {
    await transact("readwrite", ({ audio, details }) => {
      audio.delete(key);
      details.delete(key);
    });
  } catch {
    // Nothing to do: it will be cleared with the old ones.
  }
}
