export const isDebugMode = false;

export const fireWorkCategory = {
  kiku: "菊",
  botan: "牡丹",
  meshibe: "めしべ",
  poka: "ポカ物",
  kanmukiku: "冠菊",
  heart: "ハート",
  love: "告白",
};

export const params = {
  category: fireWorkCategory.kiku,
  numberOfParticles: 250,
  pointSize: 5.0,
  radius: 800,
  fireworkColor: "#ffd256",
  launchDuration: 2.0,
  bloomDuration: 2.0,
  fireworkDuration: 2.0,
  times: 20,
  gravityStrength: 1,
  buildingColor: "#38a4cfff",
  buildingOpacity: 1,
  buildingHoverColor: "#ffffff",
  launchOffsetRangeMeters: 100.0,
  height: 200,
  delay: 0.005,
  interval: 1.0,
};

export const category = {
  kiku: {
    numberOfParticles: 300,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 2,
    times: 20,
    gravityStrength: 1,
  },
  botan: {
    numberOfParticles: 300,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 2,
    times: 10,
    gravityStrength: 1,
  },
  meshibe: {
    numberOfParticles: 250,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 3,
    times: 60,
    gravityStrength: 1,
  },
  kanmukiku: {
    numberOfParticles: 250,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 3,
    times: 60,
    gravityStrength: 1,
  },
  poka: {
    numberOfParticles: 150,
    pointSize: 4.0,
    radius: 200,
    bloomDuration: 4, // ポカ物は開きが遅いので長めにする
    times: 80,
    gravityStrength: 4,
  },
  heart: {
    numberOfParticles: 0,
    pointSize: 4.0,
    radius: 50,
    bloomDuration: 2,
    times: 1,
    gravityStrength: 1,
  },
  love: {
    numberOfParticles: 0,
    pointSize: 4.0,
    radius: 50,
    bloomDuration: 2,
    times: 1,
    gravityStrength: 1,
  },
};

export const fireworkColorPresets = {
  hotPink: { hex: "#ff4181", secondary: "#fdc322" },
  yellow: { hex: "#fdc322", secondary: "#4483f9" },
  pink: { hex: "#ffa6ea", secondary: "#ecf1ff" },
  purple: { hex: "#8775ff", secondary: "#4effc1" },
  orange: { hex: "#ff8c4e", secondary: "#9788ff" },
  red: { hex: "#e00100", secondary: "#ffe0af" },
  green: { hex: "#00de0b", secondary: "#ff7bdf" },
  cream: { hex: "#ffe0af", secondary: "#ff6c1d" },
  white: { hex: "#ecf1ff", secondary: "#5bcf21" },
};

export const defaultFireworkColorKey = "hotPink";

export const location = {
  lat: 35.716833,
  lng: 139.805278,
  height: 250,
};

export const maxTimelineSelections = 9;

export const timelineModeIcons = {
  solo: "bolt",
  burst: "auto_awesome",
};

export const timelineModeLabels = {
  solo: "単発",
  burst: "連発",
};

export const timelinePlaybackDurationMs = 10000;

export const roofViewOffsetMeters = 20.0;
