// Playback sinks (Strategy pattern): where a written note is heard during playback.
// Owns: the two targets, the built-in synth and a MIDI output (the module's own sounds on
// channel 10), behind one `play(note, velocity, run)` call so the run does not care which.
// Browser only (needs the Audio module or a Web MIDI output).
const Sinks = (() => {
  const CHANNEL_10_ON = 0x99;
  const CHANNEL_10_OFF = 0x89;
  const NOTE_LENGTH_MS = 80;

  function synthSink(audio) {
    return { name: null, play: (e, velocity, run) => audio.synth(e.voice, velocity, run.songStartCtx + e.ms / 1000) };
  }

  /** `padMap` supplies the note number per voice (its first entry). Notes with no mapping are skipped. */
  function midiSink(output, padMap) {
    return {
      name: output.name,
      play(e, velocity, run) {
        const note = (padMap[e.voice] || [])[0];
        if (note === undefined) return;
        const at = run.songStartPerf + e.ms;
        output.send([CHANNEL_10_ON, note, velocity], at);
        output.send([CHANNEL_10_OFF, note, 0], at + NOTE_LENGTH_MS);
      },
    };
  }

  return { synthSink, midiSink };
})();
