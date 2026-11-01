// Web MIDI adapter.
// Owns: requesting access, listing inputs and outputs, attaching one input, and decoding the
// two messages the app cares about: note-on with velocity, and the hi-hat pedal controller.
// Knows nothing about voices, runs or the DOM; the app maps notes to voices.
// Browser only.
const Midi = (() => {
  const PEDAL_CC = 4;           // MIDI "foot controller": 127 = pedal fully down (closed), 0 = open
  const PEDAL_OPEN_BELOW = 64;
  let access = null;
  let current = null;

  const supported = () => typeof navigator !== "undefined" && !!navigator.requestMIDIAccess;

  /** Request access once. Resolves to the access object or throws with the browser's reason. */
  async function connect({ onChange }) {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => onChange();
    return access;
  }
  const inputs = () => (access ? [...access.inputs.values()] : []);
  const outputs = () => (access ? [...access.outputs.values()] : []);
  const input = (id) => (access && access.inputs.get(id)) || null;
  const output = (id) => (access && access.outputs.get(id)) || null;

  /** Decode one MIDI message into { note, velocity } | { pedal } | null. */
  function decode(data) {
    const [status, d1, d2] = data;
    const type = status & 0xf0;
    if (type === 0xb0 && d1 === PEDAL_CC) return { pedal: d2 };
    if (type === 0x90 && d2 > 0) return { note: d1, velocity: d2 };
    return null;
  }

  /** Listen to one input (or none). `handler(decoded, timeStamp)` gets only the messages decode() accepts. */
  function attach(inp, handler) {
    if (current) current.onmidimessage = null;
    current = inp;
    if (!inp) return;
    inp.onmidimessage = (ev) => {
      const d = decode(ev.data);
      if (d) handler(d, ev.timeStamp || performance.now());
    };
  }

  /** Pick the input to use: the one previously selected, else anything that looks like the kit, else the first. */
  function pick(list, previousId) {
    return list.find((i) => i.id === previousId) || list.find((i) => /alesis|nitro/i.test(i.name)) || list[0] || null;
  }

  const pedalIsOpen = (cc) => cc < PEDAL_OPEN_BELOW;

  return { PEDAL_CC, PEDAL_OPEN_BELOW, supported, connect, inputs, outputs, input, output, decode, attach, pick, pedalIsOpen };
})();
