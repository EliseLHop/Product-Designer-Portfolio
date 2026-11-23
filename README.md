# Portfolio — Elise L'Hopitault

Portfolio de Product Designer, construit avec [Astro](https://astro.build) et hébergé sur Vercel.

## Comment le projet est rangé

```
src/
  layouts/Layout.astro      Le squelette commun à toutes les pages : <head>, styles, en-tête, pied de page
  components/Header.astro   L'en-tête (logo + menu), écrit une seule fois
  components/Footer.astro   Le pied de page « Let's connect ! », écrit une seule fois
  pages/                    Une page = un fichier. index.astro devient /, gpc.astro devient /gpc
public/                     Fichiers copiés tels quels : images, polices, CV, menu.js
vercel.json                 Réglages Vercel (build Astro, en-têtes de sécurité)
astro.config.mjs            Réglages Astro
```

## Les trois notions à connaître

- **Un fichier `.astro`, c'est du HTML.** La partie entre les deux `---` en haut est du code qui prépare la page (imports, variables). Tout ce qui suit est le HTML de la page.
- **Un composant**, c'est un morceau de page réutilisable, comme un composant Figma. On l'importe en haut du fichier, puis on l'utilise comme une balise : `<Header current="home" />`.
- **Les props**, ce sont les réglages d'un composant, comme les variantes Figma. `current="about"` met « About me » en gras dans le menu ; `caseStudy` active la version compacte de l'en-tête sur les études de cas.

## Travailler en local (optionnel)

```
npm install      # une seule fois
npm run dev      # aperçu sur http://localhost:4321, mis à jour à chaque enregistrement
npm run build    # génère le site final dans dist/
```

## Mise en ligne

- Chaque branche envoyée sur GitHub crée une **URL d'aperçu** Vercel : c'est le prototype qu'on valide.
- La branche `main` est le site en ligne : on n'y fusionne qu'après validation.
