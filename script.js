const container = document.getElementById("notes");

let audio = null;
let analyser = null;
let activeOscillator = null;
let activeGain = null;
let scopeAnimation = null;

const MAX_TIME = 18;
const MAX_AMPLITUDE = 10;

const defaults = [
  {
    waveform: "sine",
    frequency: 261.63,
    points: [[0, 0], [1, 8], [3, 5], [5, 5], [7, 0]]
  },
  {
    waveform: "triangle",
    frequency: 293.66,
    points: [[0, 0], [0.8, 6], [2.5, 3], [5, 3], [7, 0]]
  },
  {
    waveform: "square",
    frequency: 329.63,
    points: [[0, 0], [2, 10], [3, 4], [6, 4], [8, 0]]
  },
  {
    waveform: "sawtooth",
    frequency: 392,
    points: [[0, 0], [0.5, 5], [2, 4], [4, 4], [9, 0]]
  },
  {
    waveform: "sine",
    frequency: 440,
    points: [[0, 0], [3, 9], [6, 2], [10, 2], [12, 0]]
  },
  {
    waveform: "triangle",
    frequency: 523.25,
    points: [[0, 0], [1.5, 7], [4, 3], [7, 3], [11, 0]]
  }
];

function round1(value) {
  return Math.round(value * 10) / 10;
}

function createNote(index) {
  const card = document.createElement("section");
  card.className = "note";

  card.innerHTML = `
    <h2>Note ${index + 1}</h2>

    <div class="top">
      <label>Oscillator
        <select class="waveform">
          <option value="sine">Sine</option>
          <option value="triangle">Triangle</option>
          <option value="square">Square</option>
          <option value="sawtooth">Sawtooth</option>
        </select>
      </label>

      <label>Frequency (Hz)
        <input class="frequency" type="number"
          min="20" max="20000" step="0.01">
      </label>
    </div>

    <svg class="envelope" viewBox="0 0 420 210"></svg>

    <div class="slopes">
      <label>Attack slope
        <input class="answer attackAnswer" type="number" step="0.1">
      </label>
      <label>Decay slope
        <input class="answer decayAnswer" type="number" step="0.1">
      </label>
      <label>Sustain slope
        <input class="answer sustainAnswer" type="number" step="0.1">
      </label>
      <label>Release slope
        <input class="answer releaseAnswer" type="number" step="0.1">
      </label>
    </div>

    <div class="actions">
      <button class="check">Check slopes</button>
      <button class="play" disabled>Play note</button>
      <span class="status">Locked</span>
    </div>
  `;

  container.appendChild(card);

  const $ = selector => card.querySelector(selector);

  $(".waveform").value = defaults[index].waveform;
  $(".frequency").value = defaults[index].frequency;

  let points = defaults[index].points.map(p => [...p]);
  let unlocked = false;

  const svg = $(".envelope");

  const left = 38;
  const right = 400;
  const top = 32;
  const bottom = 170;

  const x = time => left + (time / MAX_TIME) * (right - left);
  const y = amplitude =>
    bottom - (amplitude / MAX_AMPLITUDE) * (bottom - top);

  function getSlopes() {
    return [
      round1((points[1][1] - points[0][1]) /
             (points[1][0] - points[0][0])),

      round1((points[2][1] - points[1][1]) /
             (points[2][0] - points[1][0])),

      0,

      round1((points[4][1] - points[3][1]) /
             (points[4][0] - points[3][0]))
    ];
  }

  function draw() {
    const path = points.map((p, i) =>
      `${i === 0 ? "M" : "L"} ${x(p[0])} ${y(p[1])}`
    ).join(" ");

    let html = `
      <line x1="${left}" y1="${bottom}"
        x2="${right}" y2="${bottom}" stroke="#777"/>

      <line x1="${left}" y1="${top}"
        x2="${left}" y2="${bottom}" stroke="#777"/>

      <text x="38" y="17" class="axis-label">Amplitude</text>
      <text x="355" y="198" class="axis-label">Time (s)</text>

      <text x="17" y="${y(10) + 3}" class="axis-label">10</text>
      <text x="23" y="${y(5) + 3}" class="axis-label">5</text>
      <text x="23" y="${y(0) + 3}" class="axis-label">0</text>

      <text x="${x(0) - 3}" y="185" class="axis-label">0</text>
      <text x="${x(5) - 5}" y="185" class="axis-label">5</text>
      <text x="${x(10) - 7}" y="185" class="axis-label">10</text>
      <text x="${x(15) - 7}" y="185" class="axis-label">15</text>

      <path d="${path}" fill="none"
        stroke="#2463a6" stroke-width="3"/>
    `;

    const segmentNames = ["ATTACK", "DECAY", "SUSTAIN", "RELEASE"];

    for (let i = 0; i < 4; i++) {
      const midX = (x(points[i][0]) + x(points[i + 1][0])) / 2;
      const midY = (y(points[i][1]) + y(points[i + 1][1])) / 2;

      html += `
        <text x="${midX}" y="${Math.max(27, midY - 12)}"
          class="segment-label">${segmentNames[i]}</text>
      `;
    }

    points.forEach((p, i) => {
      const px = x(p[0]);
      const py = y(p[1]);

      const labelX = px > 325 ? px - 85 : px + 8;
      const labelY = py < 50 ? py + 18 : py - 9;

      html += `
        <circle class="point" data-index="${i}"
          cx="${px}" cy="${py}" r="6" fill="#d34b36"/>

        <text x="${labelX}" y="${labelY}" class="coordinate">
          (${p[0].toFixed(1)}, ${p[1].toFixed(1)})
        </text>
      `;
    });

    svg.innerHTML = html;
  }

  function lock() {
    unlocked = false;
    $(".play").disabled = true;
    $(".status").textContent = "Locked";
  }

  // Drag envelope points.
  let dragging = null;

  svg.addEventListener("pointerdown", event => {
    const target = event.target.closest(".point");
    if (!target) return;

    const index = Number(target.dataset.index);

    if (index === 0) return;

    dragging = index;
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener("pointermove", event => {
    if (dragging === null) return;

    const rect = svg.getBoundingClientRect();

    const svgX = (event.clientX - rect.left) * 420 / rect.width;
    const svgY = (event.clientY - rect.top) * 210 / rect.height;

    let time = round1(
      (svgX - left) / (right - left) * MAX_TIME
    );

    let amplitude = round1(
      (bottom - svgY) / (bottom - top) * MAX_AMPLITUDE
    );

    amplitude = Math.max(0, Math.min(10, amplitude));

    const i = dragging;

    const minTime = points[i - 1][0] + 0.1;
    const maxTime = i === 4
      ? MAX_TIME
      : points[i + 1][0] - 0.1;

    time = Math.max(minTime, Math.min(maxTime, time));
    points[i][0] = round1(time);

    if (i === 1) {
      // The peak cannot fall below the decay endpoint.
      points[1][1] = Math.max(amplitude, points[2][1]);
    }

    if (i === 2) {
      // The decay endpoint cannot rise above the peak.
      points[2][1] = Math.min(amplitude, points[1][1]);

      // Sustain remains level with the decay endpoint.
      points[3][1] = points[2][1];
    }

    if (i === 3) {
      // Sustain point stays at the same height as point 2.
      points[3][1] = points[2][1];
    }

    // Final point always has zero amplitude.
    points[4][1] = 0;

    draw();
    lock();
  });

  function stopDragging() {
    dragging = null;
  }

  svg.addEventListener("pointerup", stopDragging);
  svg.addEventListener("pointercancel", stopDragging);
  svg.addEventListener("lostpointercapture", stopDragging);

  $(".check").addEventListener("click", () => {
    const expected = getSlopes();

    const fields = [
      $(".attackAnswer"),
      $(".decayAnswer"),
      $(".sustainAnswer"),
      $(".releaseAnswer")
    ];

    const filled = fields.every(field => field.value.trim() !== "");
    const answers = fields.map(field => Number(field.value));

    unlocked = filled && answers.every((answer, i) =>
      Number.isFinite(answer) && round1(answer) === expected[i]
    );

    $(".play").disabled = !unlocked;
    $(".status").textContent = unlocked ? "Unlocked" : "Incorrect";
  });

  $(".play").addEventListener("click", () => {
    if (!unlocked) return;

    const frequency = Number($(".frequency").value);

    if (!Number.isFinite(frequency) ||
        frequency < 20 || frequency > 20000) {
      $(".status").textContent = "Invalid frequency";
      return;
    }

    playNote(frequency, $(".waveform").value, points);
  });

  draw();
}

// Audio
function setupAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();

    analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;

    analyser.connect(audio.destination);
  }

  if (audio.state === "suspended") {
    audio.resume();
  }
}

function playNote(frequency, waveform, points) {
  setupAudio();

  // Stop previous note: the synthesizer is monophonic.
  if (activeOscillator) {
    try {
      activeOscillator.stop();
    } catch (error) {}

    activeOscillator.disconnect();
    activeGain.disconnect();
  }

  const now = audio.currentTime;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0, now);

  points.forEach((point, index) => {
    const time = now + point[0];
    const amplitude = point[1] / MAX_AMPLITUDE;

    if (index === 0) {
      gain.gain.setValueAtTime(amplitude, time);
    } else {
      gain.gain.linearRampToValueAtTime(amplitude, time);
    }
  });

  oscillator.connect(gain);
  gain.connect(analyser);

  oscillator.start(now);
  oscillator.stop(now + points[4][0] + 0.05);

  activeOscillator = oscillator;
  activeGain = gain;

  oscillator.onended = () => {
    if (activeOscillator === oscillator) {
      activeOscillator = null;
      activeGain = null;
    }

    oscillator.disconnect();
    gain.disconnect();
  };
}

// Oscilloscope
const scopeToggle = document.getElementById("scopeToggle");
const scopeCanvas = document.getElementById("oscilloscope");
const scopeContext = scopeCanvas.getContext("2d");

function drawOscilloscope() {
  if (!scopeToggle.checked) {
    cancelAnimationFrame(scopeAnimation);
    scopeAnimation = null;
    return;
  }

  const width = scopeCanvas.width;
  const height = scopeCanvas.height;

  scopeContext.fillStyle = "#17191d";
  scopeContext.fillRect(0, 0, width, height);

  scopeContext.strokeStyle = "#343941";
  scopeContext.lineWidth = 1;
  scopeContext.beginPath();
  scopeContext.moveTo(0, height / 2);
  scopeContext.lineTo(width, height / 2);
  scopeContext.stroke();

  if (analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    scopeContext.strokeStyle = "#65d6a0";
    scopeContext.lineWidth = 2;
    scopeContext.beginPath();

    const step = width / data.length;

    data.forEach((value, i) => {
      const px = i * step;
      const py = (value / 255) * height;

      if (i === 0) {
        scopeContext.moveTo(px, py);
      } else {
        scopeContext.lineTo(px, py);
      }
    });

    scopeContext.stroke();
  }

  scopeAnimation = requestAnimationFrame(drawOscilloscope);
}

scopeToggle.addEventListener("change", () => {
  scopeCanvas.hidden = !scopeToggle.checked;

  if (scopeToggle.checked) {
    drawOscilloscope();
  } else {
    cancelAnimationFrame(scopeAnimation);
    scopeAnimation = null;
  }
});

// Create six independent notes.
for (let i = 0; i < 6; i++) {
  createNote(i);
}
