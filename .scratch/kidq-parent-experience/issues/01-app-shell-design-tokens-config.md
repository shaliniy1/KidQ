# 01: App shell, design tokens & config source-of-truth

**What to build:** A themed PWA shell for the parent web app, and a backend config
service that serves the canonical content-category list and age-band defaults
(Development Goals, default content mix). Every later screen reads categories and
age-band defaults from this service rather than hardcoding them.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `web/` app shell wires `kidq-design-tokens.css` tokens (palette, Baloo 2/Fredoka +
      Nunito fonts, primary/secondary button, pill, card, avatar-circle primitives) into
      a base layout usable by every subsequent screen.
- [ ] A config endpoint (e.g. `GET /api/config/categories`, `GET /api/config/age-band-defaults`)
      serves the category list and the age-band → Development Goals / default content mix
      mapping from backend config, not from client code.
- [ ] No category list or age-band default is hardcoded in `web/` — every place that needs
      one fetches it from this config service.
- [ ] Config values can be changed without a client app release (verified by editing the
      backend config and confirming the web app reflects it on next load, no rebuild).
- [ ] Terracotta (`--kq-terracotta`) is documented/reserved for "soft exit / gentle warning"
      use; mango (`--kq-mango`) is reserved for "positive/celebratory" use — noted in a
      shared style guide comment so later tickets don't mix them up.
