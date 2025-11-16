uniform vec4 u_color;
uniform float u_time;
uniform float u_bloomDuration;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float distanceToCenter = length(uv);
  if(distanceToCenter > 0.5)
    discard;

  float bloomAlpha = 1. * (1. - smoothstep(0.0, 1.0, u_time / u_bloomDuration));
  float pointAlpha = 0.05 / distanceToCenter - 0.1;
  float alpha = bloomAlpha * pointAlpha;
  float colorMix = clamp(distanceToCenter / 0.15, 0.0, 1.0);
  vec3 color = mix(vec3(1.0), u_color.xyz, colorMix);

  out_FragColor = vec4(color.rgb, alpha);
}
