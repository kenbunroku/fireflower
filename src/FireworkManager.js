import * as Cesium from "cesium";
import vs from "./shader/vertex.glsl";
import fs from "./shader/fragment.glsl";

const randomPointOnSphere = (radius = 1) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return { x, y, z };
};

export default class FireworkManager {
  constructor({
    scene,
    params,
    fireWorkCategory,
    modelMatrix,
    modelPositions = new Float32Array(),
  }) {
    this.scene = scene;
    this.params = params;
    this.fireWorkCategory = fireWorkCategory;
    this.modelMatrix = modelMatrix;
    this.modelPositions = modelPositions;
    this.vertexShaderSource = vs;
    this.fragmentShaderSource = fs;
    this.fireworks = [];
    this.launchSequences = new Set();
    this.launchOffsetScratch = new Cesium.Cartesian3();
    this.launchTranslationScratch = new Cesium.Matrix4();
  }

  setModelPositions(positions) {
    this.modelPositions = positions || new Float32Array();
  }

  getFireworks() {
    return this.fireworks;
  }

  getPrimaryAppearance() {
    return this.fireworks[0]?.appearance;
  }

  _createFireworkMaterial() {
    return new Cesium.MaterialAppearance({
      translucent: true,
      closed: false,
      vertexShaderSource: this.vertexShaderSource,
      fragmentShaderSource: this.fragmentShaderSource,
      materialCacheKey: "simple-points",
      renderState: {
        depthMask: true,
        blending: Cesium.BlendingState.ADDITIVE_BLEND,
      },
    });
  }

  createFirework(options = {}) {
    const {
      numberOfParticles = this.params.numberOfParticles,
      times = this.params.times,
      pointSize = this.params.pointSize,
      radius = this.params.radius,
      fireworkColor = this.params.fireworkColor,
      launchDuration = this.params.launchDuration,
      bloomDuration = this.params.bloomDuration,
      launchHeight = this.params.height,
      delayStep = this.params.delay,
      gravityStrentgh = this.params.gravityStrength,
      matrix = this.modelMatrix,
    } = options;

    const positions = new Float32Array(numberOfParticles * 3 * times);
    const delays = new Float32Array(numberOfParticles * times);
    const unitDirs = new Float32Array(numberOfParticles * 3 * times);

    for (let i = 0; i < numberOfParticles; i++) {
      const point = randomPointOnSphere(0.1);
      const len = Math.hypot(point.x, point.y, point.z) || 1.0;
      const ux = point.x / len;
      const uy = point.y / len;
      const uz = point.z / len;

      for (let j = 0; j < times; j++) {
        const idx3 = (i * times + j) * 3;
        const delayIndex = i * times + j;

        positions[idx3 + 0] = point.x;
        positions[idx3 + 1] = point.y;
        positions[idx3 + 2] = point.z;

        unitDirs[idx3 + 0] = ux;
        unitDirs[idx3 + 1] = uy;
        unitDirs[idx3 + 2] = uz;

        delays[delayIndex] = j * delayStep;
      }
    }

    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: positions,
        }),
        delay: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: delays,
        }),
        unitDir: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 3,
          values: unitDirs,
        }),
      },
      primitiveType: Cesium.PrimitiveType.POINTS,
      boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    });

    const appearance = this._createFireworkMaterial();
    appearance.uniforms = {
      u_color: Cesium.Color.fromCssColorString(
        fireworkColor,
        new Cesium.Color()
      ),
      u_pointSize: pointSize,
      u_time: 0.0,
      u_radius: radius,
      u_duration: launchDuration,
      u_launchHeight: launchHeight,
      u_bloomDuration: bloomDuration,
      u_launchProgress: 0.0,
      u_gravityStrength: gravityStrentgh,
    };

    const instance = new Cesium.GeometryInstance({ geometry });
    const primitive = new Cesium.Primitive({
      geometryInstances: instance,
      appearance,
      asynchronous: false,
      modelMatrix: matrix,
    });
    primitive.cull = false;
    this.scene.primitives.add(primitive);

    const firework = {
      primitive,
      appearance,
      startTime: undefined,
    };
    this.fireworks.push(firework);
    return firework;
  }

  createRandomizedLaunchMatrix(
    baseMatrix = this.modelMatrix,
    spreadMeters = this.params.launchOffsetRangeMeters
  ) {
    const offsetX = (Math.random() - 0.5) * 2.0 * spreadMeters;
    const offsetY = (Math.random() - 0.5) * 2.0 * spreadMeters;
    Cesium.Cartesian3.fromElements(
      offsetX,
      offsetY,
      0.0,
      this.launchOffsetScratch
    );
    Cesium.Matrix4.fromTranslation(
      this.launchOffsetScratch,
      this.launchTranslationScratch
    );
    return Cesium.Matrix4.multiply(
      baseMatrix,
      this.launchTranslationScratch,
      new Cesium.Matrix4()
    );
  }

  stopLaunchSequence(sequence) {
    if (!sequence) {
      return;
    }
    sequence.active = false;
    if (sequence.timeoutId) {
      window.clearTimeout(sequence.timeoutId);
    }
    this.launchSequences.delete(sequence);
  }

  stopAllLaunchSequences() {
    Array.from(this.launchSequences).forEach((sequence) => {
      this.stopLaunchSequence(sequence);
    });
  }

  animate(fireworkArray, timestamp) {
    fireworkArray.forEach((firework) => {
      if (!firework.startTime) {
        firework.startTime = timestamp;
      }
      const uniforms = firework.appearance?.uniforms;
      if (!uniforms) {
        return;
      }
      const elapsedSeconds = (timestamp - firework.startTime) * 0.001;
      const launchDuration = Math.max(
        uniforms.u_duration || params.launchDuration,
        1e-6
      );
      const launchProgress = Math.min(elapsedSeconds / launchDuration, 1.0);
      uniforms.u_launchProgress = launchProgress;
      const explosionTime = Math.max(elapsedSeconds - launchDuration, 0.0);
      uniforms.u_time = explosionTime;
    });
    requestAnimationFrame((ts) => this.animate(fireworkArray, ts));
  }

  launchFireworkSequence(options = {}, fireworkFactory) {
    const durationSeconds = options.duration ?? this.params.fireworkDuration;
    const intervalSeconds = options.interval ?? this.params.interval;
    const baseMatrix = options.matrix || this.modelMatrix;
    const spread = options.spread ?? this.params.launchOffsetRangeMeters;
    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const startTime = now();
    const sequence = {
      active: true,
      timeoutId: undefined,
    };

    const spawnFirework = (matrix) => {
      if (typeof fireworkFactory === "function") {
        fireworkFactory(matrix);
      } else {
        this.createFirework({
          ...options,
          fireworkColor: options.fireworkColor ?? this.params.fireworkColor,
          matrix,
        });
      }
    };

    const launchOnce = () => {
      if (!sequence.active) {
        return;
      }
      const elapsedSeconds = (now() - startTime) * 0.001;
      if (elapsedSeconds > durationSeconds) {
        this.stopLaunchSequence(sequence);
        return;
      }

      const fireworkMatrix = this.createRandomizedLaunchMatrix(
        baseMatrix,
        spread
      );
      spawnFirework(fireworkMatrix);

      sequence.timeoutId = window.setTimeout(
        launchOnce,
        intervalSeconds * 1000
      );
    };

    // this.launchSequences.add(sequence);
    launchOnce();
    return () => this.stopLaunchSequence(sequence);
  }
}
