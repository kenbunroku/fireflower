/**
 * Audio Module
 * 花火の効果音（打ち上げ音・開花音）の管理
 */

const whizzlingSoundPath = "/sound/whizzling.mp3";
const bloomSoundPaths = [
  "/sound/bloom.mp3",
  "/sound/bloom2.mp3",
  "/sound/bloom3.mp3",
];

let audioContext;
let whizzlingBuffer;
let bloomBuffers = [];
let audioInitPromise;
let hasPrimedAudio = false;
let isAudioEnabled = true;

// UI要素への参照
let audioToggleButton;
let audioToggleIcon;

const ensureAudioContext = () => {
  if (audioContext) {
    return audioContext;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    console.warn("Web Audio API is not supported in this browser.");
    return undefined;
  }
  audioContext = new AudioCtx();
  return audioContext;
};

const resumeAudioContext = () => {
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== "suspended") {
    return Promise.resolve(ctx);
  }
  return ctx
    .resume()
    .then(() => ctx)
    .catch((error) => {
      console.warn("Failed to resume audio context.", error);
      return ctx;
    });
};

const loadAudioBuffer = async (path) => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return undefined;
  }
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("Failed to load audio buffer:", error);
    return undefined;
  }
};

export const initAudio = () => {
  if (audioInitPromise) {
    return audioInitPromise;
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    return undefined;
  }
  audioInitPromise = Promise.all([
    loadAudioBuffer(whizzlingSoundPath),
    Promise.all(bloomSoundPaths.map((path) => loadAudioBuffer(path))),
  ])
    .then(([whizz, bloomList]) => {
      whizzlingBuffer = whizz;
      bloomBuffers = Array.isArray(bloomList)
        ? bloomList.filter((buffer) => Boolean(buffer))
        : [];
      return { whizz, bloom: bloomBuffers };
    })
    .catch((error) => {
      console.error("Failed to initialize audio.", error);
      audioInitPromise = undefined;
    });
  return audioInitPromise;
};

const playAudioBuffer = (buffer, { volume = 1 } = {}) => {
  if (!isAudioEnabled) {
    return;
  }
  const ctx = ensureAudioContext();
  if (!ctx || !buffer) {
    return;
  }
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gainNode).connect(ctx.destination);
  source.start();
  return source;
};

export const playWhizzlingSound = () => {
  if (!isAudioEnabled) {
    return;
  }
  const initPromise = initAudio();
  if (!initPromise) {
    return;
  }
  initPromise
    .then(() => resumeAudioContext())
    .then(() => {
      if (whizzlingBuffer) {
        playAudioBuffer(whizzlingBuffer, { volume: 0.35 });
      }
    })
    .catch((error) => console.warn("Failed to play whizzling sound.", error));
};

export const playBloomSound = () => {
  if (!isAudioEnabled) {
    return;
  }
  const initPromise = initAudio();
  if (!initPromise) {
    return;
  }
  initPromise
    .then(() => resumeAudioContext())
    .then(() => {
      if (bloomBuffers.length > 0) {
        const index = Math.floor(Math.random() * bloomBuffers.length);
        const buffer = bloomBuffers[index];
        if (buffer) {
          playAudioBuffer(buffer, { volume: 0.45 });
        }
      }
    })
    .catch((error) => console.warn("Failed to play bloom sound.", error));
};

export const primeAudioOnInteraction = () => {
  if (typeof window === "undefined") {
    return;
  }
  const unlock = () => {
    if (hasPrimedAudio) {
      return;
    }
    hasPrimedAudio = true;
    initAudio();
    resumeAudioContext();
  };
  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { once: true });
  });
};

const updateAudioToggleButton = () => {
  if (!audioToggleButton || !audioToggleIcon) {
    return;
  }
  audioToggleIcon.textContent = isAudioEnabled ? "volume_up" : "volume_off";
  audioToggleButton.setAttribute("aria-pressed", String(isAudioEnabled));
  audioToggleButton.setAttribute(
    "aria-label",
    isAudioEnabled ? "音声オン" : "音声オフ"
  );
  audioToggleButton.title = isAudioEnabled ? "音声オン" : "音声オフ";
};

export const setAudioEnabled = (enabled) => {
  isAudioEnabled = Boolean(enabled);
  updateAudioToggleButton();
  if (!isAudioEnabled) {
    if (audioContext?.state === "running" && audioContext?.suspend) {
      audioContext.suspend();
    }
    return;
  }
  initAudio();
  resumeAudioContext();
};

export const getAudioEnabled = () => isAudioEnabled;

export const toggleAudio = () => {
  setAudioEnabled(!isAudioEnabled);
};

/**
 * オーディオトグルボタンを作成してコンテナに追加
 */
export const createAudioToggleButton = (
  container,
  insertBeforeElement = null
) => {
  if (!container) {
    return null;
  }

  audioToggleButton = document.createElement("button");
  audioToggleButton.type = "button";
  audioToggleButton.className = "control-panel__audio-toggle";

  audioToggleIcon = document.createElement("span");
  audioToggleIcon.className = "material-icons-outlined";
  audioToggleButton.appendChild(audioToggleIcon);

  audioToggleButton.addEventListener("click", toggleAudio);

  if (insertBeforeElement) {
    container.insertBefore(audioToggleButton, insertBeforeElement);
  } else {
    container.appendChild(audioToggleButton);
  }

  updateAudioToggleButton();

  return audioToggleButton;
};

/**
 * 花火のオーディオ状態をリセット
 */
export const resetFireworkAudioState = (firework) => {
  if (!firework) {
    return;
  }
  firework.audioState = { launchPlayed: false, bloomPlayed: false };
};

/**
 * 花火のステージに応じてオーディオを再生
 */
export const handleFireworkAudio = ({ firework, stage, hasStarted }) => {
  if (!firework || !hasStarted) {
    return;
  }
  if (!firework.audioState) {
    resetFireworkAudioState(firework);
  }
  const state = firework.audioState;
  if (stage === "launch" && !state.launchPlayed) {
    state.launchPlayed = true;
    playWhizzlingSound();
  } else if (stage === "bloom" && !state.bloomPlayed) {
    state.bloomPlayed = true;
    playBloomSound();
  }
};
