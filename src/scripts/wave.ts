// Fond du portfolio : une grille de points bordeaux déformée par une houle lente.
//
// Cette formule est la SEULE source de vérité du fond :
// - src/components/ParticleBackground.astro la dessine sur toute la page (canvas 2D) ;
// - src/scripts/glass.ts la recalcule sous les cartes pour que le verre la réfracte.
// Changer un paramètre ici change les deux, et ils restent parfaitement alignés.
// Toutes les valeurs sont en pixels CSS.

export const WAVE = {
  gap: 16,          // un point tous les 16px
  mobileGap: 20,    // écart utilisé sur mobile si MOBILE_GAP est activé
  k: 0.0135,        // « longueur d'onde » de la houle
  amplitude: 39,    // décalage vertical maximal d'un point, en px
  speed: 0.144,     // t augmente de 0.144 par seconde
  color: [100, 24, 34] as const, // #641822
  opacity: 0.3,     // opacité globale de la texture
};

// Passer à true pour utiliser 20px d'écart sur mobile (moins de points à dessiner).
export const MOBILE_GAP = false;

/** Écart entre les points pour la largeur d'écran actuelle. */
export function gridGap(): number {
  return MOBILE_GAP && window.innerWidth <= 768 ? WAVE.mobileGap : WAVE.gap;
}

/** La grille commence hors de l'écran (amplitude + écart), pour qu'aucun bord vide n'apparaisse. */
export function gridOrigin(gap: number): number {
  return -(WAVE.amplitude + gap);
}

/** Hauteur de la vague au point (x, y), entre -1 et 1. */
export function waveHeight(x: number, y: number, t: number): number {
  const k = WAVE.k;
  return (
    Math.sin(x * k + t) * Math.cos(y * k * 0.8 - t * 0.6) * 0.65 +
    Math.sin((0.6 * x + y) * k * 0.7 + t * 0.4) * 0.35
  );
}

/** Rayon d'un point selon la hauteur de la vague (px). */
export const dotRadius = (h: number) => 0.6 + (h + 1) * 0.75;

/** Opacité d'un point selon la hauteur de la vague. */
export const dotOpacity = (h: number) => WAVE.opacity * (0.25 + (h + 1) * 0.35);

/** Les personnes qui demandent moins d'animations voient une image figée. */
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Le temps de la vague, calculé sur l'horloge de la page (et non sur le nombre d'images) :
 * même vitesse sur tous les écrans, et le canvas du fond et le verre sont toujours synchronisés.
 */
export function waveTime(): number {
  return reducedMotion() ? 0 : (performance.now() / 1000) * WAVE.speed;
}

/** La même formule, écrite en GLSL pour le shader du verre (générée à partir des valeurs ci-dessus). */
export const WAVE_GLSL = `
const float WAVE_K = ${WAVE.k.toFixed(6)};
const float WAVE_AMP = ${WAVE.amplitude.toFixed(1)};
const float WAVE_OPACITY = ${WAVE.opacity.toFixed(3)};
const vec3 WAVE_COLOR = vec3(${WAVE.color.map((c) => (c / 255).toFixed(4)).join(", ")});
float waveHeight(vec2 p, float t) {
  return sin(p.x * WAVE_K + t) * cos(p.y * WAVE_K * 0.8 - t * 0.6) * 0.65
       + sin((0.6 * p.x + p.y) * WAVE_K * 0.7 + t * 0.4) * 0.35;
}
`;
