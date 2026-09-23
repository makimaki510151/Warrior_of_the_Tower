(function (root) {
  const W = root.Wot || (root.Wot = {});

  let ctx = null;
  let unlocked = false;
  let lastHoverAt = 0;

  function audio() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    unlocked = true;
    return ctx;
  }

  function tone(opts) {
    const ac = audio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(opts.freq || 440, now);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + (opts.dur || 0.08));
    }
    const vol = (opts.vol == null ? 0.04 : opts.vol) * (W.sfxMuted ? 0 : 1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (opts.dur || 0.08));
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + (opts.dur || 0.08) + 0.02);
  }

  function noiseBurst(opts) {
    const ac = audio();
    if (!ac) return;
    const dur = opts.dur || 0.06;
    const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts.freq || 1200;
    const gain = ac.createGain();
    const vol = (opts.vol == null ? 0.05 : opts.vol) * (W.sfxMuted ? 0 : 1);
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start();
  }

  const sfx = {
    unlock() {
      audio();
    },
    ui() {
      tone({ freq: 720, freqEnd: 540, dur: 0.05, type: "triangle", vol: 0.035 });
    },
    hover() {
      const now = Date.now();
      if (now - lastHoverAt < 80) return;
      lastHoverAt = now;
      tone({ freq: 880, dur: 0.025, type: "sine", vol: 0.012 });
    },
    expand() {
      tone({ freq: 420, freqEnd: 760, dur: 0.09, type: "triangle", vol: 0.04 });
    },
    collapse() {
      tone({ freq: 760, freqEnd: 400, dur: 0.07, type: "triangle", vol: 0.03 });
    },
    pick() {
      tone({ freq: 520, freqEnd: 880, dur: 0.12, type: "square", vol: 0.045 });
      setTimeout(() => tone({ freq: 990, dur: 0.06, type: "triangle", vol: 0.03 }), 70);
    },
    start() {
      tone({ freq: 300, freqEnd: 600, dur: 0.14, type: "sawtooth", vol: 0.035 });
    },
    attack() {
      noiseBurst({ freq: 900, dur: 0.05, vol: 0.045 });
      tone({ freq: 220, freqEnd: 140, dur: 0.07, type: "square", vol: 0.03 });
    },
    hit() {
      noiseBurst({ freq: 400, dur: 0.07, vol: 0.05 });
      tone({ freq: 160, freqEnd: 90, dur: 0.09, type: "sawtooth", vol: 0.035 });
    },
    heal() {
      tone({ freq: 520, freqEnd: 780, dur: 0.1, type: "sine", vol: 0.035 });
    },
    buff() {
      tone({ freq: 440, freqEnd: 660, dur: 0.1, type: "triangle", vol: 0.03 });
    },
    tip() {
      tone({ freq: 640, dur: 0.04, type: "sine", vol: 0.02 });
    },
    win() {
      tone({ freq: 523, dur: 0.08, type: "triangle", vol: 0.04 });
      setTimeout(() => tone({ freq: 659, dur: 0.08, type: "triangle", vol: 0.04 }), 90);
      setTimeout(() => tone({ freq: 784, dur: 0.14, type: "triangle", vol: 0.045 }), 180);
    },
    lose() {
      tone({ freq: 300, freqEnd: 120, dur: 0.22, type: "sawtooth", vol: 0.04 });
    },
    forEvent(kind) {
      if (kind === "attack") sfx.attack();
      else if (kind === "hit" || kind === "down") sfx.hit();
      else if (kind === "heal") sfx.heal();
      else if (kind === "buff") sfx.buff();
      else if (kind === "dot") sfx.hit();
    },
  };

  W.sfx = sfx;
  W.sfxMuted = false;
})(typeof window !== "undefined" ? window : globalThis);
