export const randomPointOnSphere = (radius = 1) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return { x, y, z };
};

export const rotatePositionsAroundX = (positions, angleRad) => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotated = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    rotated[i] = x;
    rotated[i + 1] = y * cos - z * sin;
    rotated[i + 2] = y * sin + z * cos;
  }

  return rotated;
};

export const rotatePositionsAroundY = (positions, angleRad) => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotated = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    rotated[i] = x * cos + z * sin;
    rotated[i + 1] = y;
    rotated[i + 2] = -x * sin + z * cos;
  }

  return rotated;
};

export const rotatePositionsAroundZ = (positions, angleRad) => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotated = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    rotated[i] = x * cos - y * sin;
    rotated[i + 1] = x * sin + y * cos;
    rotated[i + 2] = z;
  }

  return rotated;
};
