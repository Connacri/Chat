## 2025-05-22 - Amélioration de l'accessibilité des interactions et boutons
**Learning:** Les icônes et emojis (❤️, ✖, ◀, ▶) utilisés comme boutons sans texte d'accompagnement sont invisibles pour les lecteurs d'écran. De plus, les actions de type "Copier" bénéficient grandement d'un attribut `title` pour confirmer l'action attendue au survol, complétant le feedback du toast.
**Action:** Toujours s'assurer que les boutons icon-only ont un `aria-label` descriptif et que les composants de boutons génériques supportent nativement les attributs d'accessibilité (disabled, aria-label).
