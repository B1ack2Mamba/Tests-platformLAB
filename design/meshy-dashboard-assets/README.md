# Meshy dashboard assets

These images are clean references for generating the dashboard's 3D objects in Meshy.

## Assets

- `01-ai-analyst-tpose-front.png`: primary front reference for Meshy rigging and animation.
- `01-ai-analyst-tpose-left-profile.png`: 90-degree left profile.
- `01-ai-analyst-tpose-back.png`: direct rear view.
- `01-ai-analyst-tpose-front-3q.png`: front three-quarter view.
- `01-ai-analyst-tpose-rear-3q.png`: rear three-quarter view.
- `01-ai-analyst-figure.png`: secondary identity and consulting-pose reference without a base.
- `02-archive-binder-open.png`: use as the visual reference for the archive binder.
- `03-folder-organizer.png`: desktop folder organizer with removable folders.
- `04-command-button.png`: one reusable mechanical key; add labels and icons in HTML.
- `05-balance-wallet.png`: wallet shell; add balance and button text in HTML.
- `06-project-display-frame.png`: main display frame; render project data as live HTML.
- `07-ai-smart-glass-frame.png`: AI panel shell; render chat UI as live HTML.
- `08-archive-binder-closed.png`: closed archive state for the open/close transition.
- `09-project-folder.png`: one reusable project folder; clone it for each project.

## Mesh separation for future manual revisions

The generated web models are optimized as single meshes. If a model is rebuilt manually for detailed mechanical animation, use this separation:

- Archive binder: separate front cover, back cover, spine, ring mechanism, page block, page-turn sheet, strap and snap.
- Folder organizer: separate box, each folder and each tab.
- Command button: separate keycap, housing and indicator lens.
- Balance wallet: separate wallet, strap, display inset, button and dock.
- Display frames: keep the screen area as a flat replaceable plane.
- Page turning: use a lightweight procedural plane in Three.js instead of another generated mesh.

Do not bake Russian labels, balances, project names, counters or icons into the 3D textures. They should remain live web-interface layers.
