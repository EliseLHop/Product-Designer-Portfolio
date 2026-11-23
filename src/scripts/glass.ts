// Verre WebGL — réfraction façon « Glass » de Figma.
//
// Principe : un <canvas> placé derrière les cartes dessine le fond ET les vitres.
// Pour chaque pixel situé dans une carte, le shader va chercher la couleur du fond
// un peu plus loin (c'est la réfraction), plus fort près des bords, comme une lentille.
// Le contenu des cartes (image, texte, CTA) reste en HTML par-dessus.

export type GlassSettings = {
  refraction: number; // 0–100, Figma : 86
  depth: number;      // 0–100, Figma : 70
  dispersion: number; // 0–100, Figma : 9
  frost: number;      // 0–100, Figma : 5
  splay: number;      // 0–100, Figma : 35
  light: number;      // angle en degrés, Figma : -45
  animate: boolean;   // le fond bouge doucement
};

// Réglages choisis par Elise après test de la démo (23/11/2026)
export const GLASS_SETTINGS: GlassSettings = {
  refraction: 86, depth: 51, dispersion: 9, frost: 69, splay: 18, light: -134, animate: true,
};

const MAX_CARDS = 12;

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Le shader : tout le calcul se fait ici, pixel par pixel, sur la carte graphique.
const FRAGMENT = `
precision highp float;
uniform vec2 u_res;          // taille du canvas en pixels
uniform float u_time;
uniform float u_dpr;         // densité de l'écran (2 sur un écran Retina)
uniform vec4 u_cards[${MAX_CARDS}]; // x, y, largeur, hauteur de chaque carte (pixels, origine en bas à gauche)
uniform int u_count;
uniform float u_radius;      // arrondi des cartes
uniform float u_refraction, u_depth, u_dispersion, u_frost, u_splay, u_light;

// ---------- Le fond provisoire : des formes douces aux couleurs de la charte
vec3 blob(vec3 col, vec2 p, vec2 c, float r, vec3 tint, float a) {
  float d = length(p - c);
  float m = 1.0 - smoothstep(r * 0.55, r, d); // bord net-mais-doux : on voit bien la réfraction
  return mix(col, tint, m * a);
}
vec3 background(vec2 p) {
  vec2 uv = p / u_res;
  float t = u_time * 0.04;
  float s = max(u_res.x, u_res.y);
  vec3 col = vec3(0.961, 0.953, 0.933);                                // #F5F3EE
  col = blob(col, uv * u_res, u_res * vec2(0.18 + 0.05 * sin(t * 1.3), 0.78 + 0.04 * cos(t)), s * 0.22, vec3(0.725, 0.522, 0.553), 0.55); // #B9858D
  col = blob(col, uv * u_res, u_res * vec2(0.82 + 0.04 * cos(t * 0.9), 0.62 + 0.05 * sin(t * 1.1)), s * 0.20, vec3(0.392, 0.094, 0.133), 0.32); // #641822
  col = blob(col, uv * u_res, u_res * vec2(0.50 + 0.06 * sin(t * 0.7), 0.30 + 0.04 * cos(t * 1.4)), s * 0.26, vec3(0.545, 0.353, 0.380), 0.40); // #8B5A61
  col = blob(col, uv * u_res, u_res * vec2(0.30 + 0.05 * cos(t * 1.2), 0.12 + 0.03 * sin(t)), s * 0.16, vec3(0.392, 0.094, 0.133), 0.22);
  // fines lignes diagonales très légères, pour qu'on voie la déformation même sur les zones unies
  float lines = smoothstep(0.92, 1.0, sin((p.x + p.y) / (14.0 * u_dpr)) * 0.5 + 0.5);
  col = mix(col, col * 0.86, lines * 0.25);
  return col;
}

// ---------- Forme de la carte : distance signée à un rectangle arrondi
float sdRoundRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Fond « givré » : moyenne de quelques échantillons autour du point (Frost)
vec3 frosted(vec2 p) {
  float r = u_frost * 0.12 * u_dpr;
  if (r < 0.5) return background(p);
  vec3 c = background(p) * 0.4;
  c += background(p + vec2( r,  r)) * 0.15;
  c += background(p + vec2(-r,  r)) * 0.15;
  c += background(p + vec2( r, -r)) * 0.15;
  c += background(p + vec2(-r, -r)) * 0.15;
  return c;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec3 col = background(p);

  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (i >= u_count) break;
    vec4 card = u_cards[i];
    vec2 halfSize = card.zw * 0.5;
    vec2 center = card.xy + halfSize;
    vec2 local = p - center;
    float d = sdRoundRect(local, halfSize, u_radius);
    if (d > 0.0) continue; // pixel hors de cette carte

    // Splay : largeur de la zone de bord qui courbe la lumière
    float bevel = mix(8.0, 90.0, u_splay / 100.0) * u_dpr;
    float edge = clamp(-d / bevel, 0.0, 1.0);   // 0 au bord, 1 à l'intérieur
    float curve = pow(1.0 - edge, 2.0);         // la courbure se concentre près du bord

    // Normale : direction « vers l'extérieur » de la carte en ce point
    float e = 1.0;
    vec2 n = normalize(vec2(
      sdRoundRect(local + vec2(e, 0.0), halfSize, u_radius) - sdRoundRect(local - vec2(e, 0.0), halfSize, u_radius),
      sdRoundRect(local + vec2(0.0, e), halfSize, u_radius) - sdRoundRect(local - vec2(0.0, e), halfSize, u_radius)
    ) + 1e-5);

    // Refraction + Depth : on va chercher le fond plus vers l'intérieur près du bord (effet loupe)
    float strength = (u_refraction / 100.0) * (0.35 + 0.65 * u_depth / 100.0) * 70.0 * u_dpr;
    vec2 offset = -n * curve * strength;
    offset += -local * 0.04 * (u_depth / 100.0); // légère loupe sur toute la surface

    // Dispersion : rouge, vert et bleu ne sont pas déviés exactement pareil
    float disp = u_dispersion / 100.0 * 0.6;
    vec3 glass;
    glass.r = frosted(p + offset * (1.0 + disp)).r;
    glass.g = frosted(p + offset).g;
    glass.b = frosted(p + offset * (1.0 - disp)).b;

    // Light : reflet sur le bord du côté de la lumière, ombre légère du côté opposé
    // direction vers la lumière : -45° = en haut à gauche, comme dans Figma
    float a = radians(180.0 + u_light);
    vec2 toLight = vec2(cos(a), sin(a));
    float facing = dot(n, toLight);
    float rim = pow(1.0 - edge, 4.0);
    glass += vec3(1.0) * rim * max(facing, 0.0) * 0.55;
    glass -= vec3(0.25, 0.22, 0.22) * rim * max(-facing, 0.0) * 0.35;

    glass = mix(glass, vec3(1.0), 0.07); // voile blanc très léger sur la vitre
    col = glass;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader error");
  }
  return shader;
}

/**
 * Met en place le verre WebGL dans une section.
 * Renvoie une fonction pour changer les réglages, ou null si WebGL n'est pas disponible
 * (dans ce cas, les cartes gardent leur version CSS).
 */
export function mountGlass(section: HTMLElement, canvas: HTMLCanvasElement, settings: GlassSettings) {
  const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(program);

  // Un grand triangle qui couvre tout le canvas
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const cards = Array.from(section.querySelectorAll<HTMLElement>(".card")).slice(0, MAX_CARDS);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dpr = 1;
  let visible = true;
  let frame = 0;
  const start = performance.now();

  // Position des cartes, relative au canvas (recalculée seulement quand la taille change)
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = section.getBoundingClientRect();
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    const data = new Float32Array(MAX_CARDS * 4);
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      data[i * 4] = (r.left - box.left) * dpr;
      data[i * 4 + 1] = (box.bottom - r.bottom) * dpr; // WebGL compte depuis le bas
      data[i * 4 + 2] = r.width * dpr;
      data[i * 4 + 3] = r.height * dpr;
    });
    gl!.uniform4fv(u("u_cards"), data);
    gl!.uniform1i(u("u_count"), cards.length);
    gl!.uniform1f(u("u_radius"), 24 * dpr);
    gl!.uniform1f(u("u_dpr"), dpr);
    gl!.uniform2f(u("u_res"), canvas.width, canvas.height);
    draw();
  }

  function applySettings() {
    gl!.uniform1f(u("u_refraction"), settings.refraction);
    gl!.uniform1f(u("u_depth"), settings.depth);
    gl!.uniform1f(u("u_dispersion"), settings.dispersion);
    gl!.uniform1f(u("u_frost"), settings.frost);
    gl!.uniform1f(u("u_splay"), settings.splay);
    gl!.uniform1f(u("u_light"), settings.light);
  }

  function draw() {
    const t = settings.animate && !reducedMotion ? (performance.now() - start) / 1000 : 0;
    gl!.uniform1f(u("u_time"), t);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  // Boucle d'animation, seulement quand la section est à l'écran
  function loop() {
    draw();
    frame = settings.animate && !reducedMotion && visible ? requestAnimationFrame(loop) : 0;
  }
  function restart() {
    if (!frame) frame = requestAnimationFrame(loop);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) restart();
  }).observe(section);
  new ResizeObserver(layout).observe(section);
  // les images qui finissent de charger peuvent changer la taille des cartes
  section.querySelectorAll("img").forEach((img) => img.addEventListener("load", layout));

  applySettings();
  layout();
  section.classList.add("glass-on");
  restart();

  return (next: Partial<GlassSettings>) => {
    Object.assign(settings, next);
    applySettings();
    draw();
    restart();
  };
}
