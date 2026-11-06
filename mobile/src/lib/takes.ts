import { Directory, File, Paths } from "expo-file-system";

// One saved take per assignment, kept on the phone until it's sent for review.
// Stored as <assignmentId>.wav plus <assignmentId>.json with its timing.

export type SavedTake = {
  uri: string;
  size: number; // bytes
  offset: number; // song position (seconds) the first sample lines up with
  duration: number; // seconds
  savedAt: string;
};

type TakeMeta = Omit<SavedTake, "uri" | "size">;

const takesDir = new Directory(Paths.document, "takes");

function filesFor(assignmentId: string) {
  return {
    wav: new File(takesDir, `${assignmentId}.wav`),
    meta: new File(takesDir, `${assignmentId}.json`),
  };
}

// 16-bit PCM, one channel. About 5.8 MB a minute at 48 kHz.
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

export async function saveTake(
  assignmentId: string,
  samples: Float32Array,
  sampleRate: number,
  offset: number
): Promise<SavedTake> {
  takesDir.create({ intermediates: true, idempotent: true });
  const { wav, meta } = filesFor(assignmentId);
  const info: TakeMeta = { offset, duration: samples.length / sampleRate, savedAt: new Date().toISOString() };

  wav.create({ overwrite: true });
  await wav.write(encodeWav(samples, sampleRate));
  meta.create({ overwrite: true });
  await meta.write(JSON.stringify(info));
  return { ...info, uri: wav.uri, size: wav.size ?? 0 };
}

export function getSavedTake(assignmentId: string): SavedTake | null {
  const { wav, meta } = filesFor(assignmentId);
  if (!wav.exists || !meta.exists) return null;
  try {
    const info = JSON.parse(meta.textSync()) as TakeMeta;
    return { ...info, uri: wav.uri, size: wav.size ?? 0 };
  } catch {
    return null;
  }
}

export function deleteSavedTake(assignmentId: string) {
  const { wav, meta } = filesFor(assignmentId);
  if (wav.exists) wav.delete();
  if (meta.exists) meta.delete();
}

export function takeFile(take: SavedTake) {
  return new File(take.uri);
}
