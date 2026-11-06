const STRETCH_LIBRARY = "/vendor/signalsmith-stretch-1.3.2.mjs";

// Plays buffers slower without changing their pitch, which AudioBufferSourceNode can't do.
// Used only off full speed: 100% stays on plain source nodes.
// tracks = [{ buffer, output }]. All of them go through one stretcher as one multi-channel
// signal, so they stay locked together; separate stretchers each drift to their own timing grid.
export async function createStretchVoice(ctx, tracks) {
  // Large, so it isn't loaded until someone slows a song down. Served as is: see the note in the file.
  const { default: SignalsmithStretch } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ STRETCH_LIBRARY);

  const length = Math.max(...tracks.map((t) => t.buffer.length));
  const channels = tracks.flatMap((t) =>
    [...Array(t.buffer.numberOfChannels)].map((_, c) => {
      const data = t.buffer.getChannelData(c);
      if (data.length === length) return data;
      // Every channel has to be the same length, so shorter stems get silence at the end.
      const padded = new Float32Array(length);
      padded.set(data);
      return padded;
    })
  );

  // One input even though nothing connects to it: the library's processor reads it.
  const node = await SignalsmithStretch(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [channels.length] });
  await node.addBuffers(channels);
  const latency = await node.latency();

  // Back out to each track's own output.
  const splitter = ctx.createChannelSplitter(channels.length);
  node.connect(splitter);
  let channel = 0;
  for (const { buffer, output } of tracks) {
    const merger = ctx.createChannelMerger(buffer.numberOfChannels);
    for (let c = 0; c < buffer.numberOfChannels; c++) splitter.connect(merger, channel++, c);
    merger.connect(output);
  }

  return {
    buffer: tracks[0].buffer,
    latency, // how far ahead to schedule for the first sound to be clean, in seconds
    play: (when, input, rate) => node.schedule({ active: true, output: when, input, rate }),
    stop: (when) => node.schedule(when === undefined ? { active: false } : { active: false, output: when }),
    dispose: () => {
      node.schedule({ active: false });
      node.disconnect();
    },
  };
}
