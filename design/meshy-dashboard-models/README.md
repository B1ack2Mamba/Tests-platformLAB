# Dashboard 3D models

Production-ready models are in `web/`. The complete set is 4,342,728 bytes (about 4.14 MiB).

## Runtime models

- `ai-analyst-rigged.glb`: AI analyst figurine, 61,118 triangles, 24 joints, one idle animation.
- `ai-smart-glass-frame-web.glb`: frame for the live AI chat panel.
- `archive-binder-closed-web.glb`: closed archive state.
- `archive-binder-open-web.glb`: open archive state.
- `balance-wallet-web.glb`: balance shell; render amount and actions as live HTML.
- `command-button-web.glb`: one reusable bottom command key; clone four times.
- `folder-organizer-web.glb`: upper-right folder organizer.
- `project-display-frame-web.glb`: central project display shell.
- `project-folder-web.glb`: one reusable folder; clone it for project entries.

## Interaction plan

- Cross-fade or scale-swap the closed and open archive models.
- Animate page turns with a subdivided Three.js plane; do not load another GLB.
- Clone `command-button-web.glb` for create project, new folder, trash and test catalog.
- Clone `project-folder-web.glb` for each visible folder and overlay labels in HTML.
- Keep names, balances, counters, icons and project data outside textures.
- Lazy-load the AI analyst and start its idle animation after the main desk is interactive.

## Compatibility

The optimized files use `EXT_texture_webp` and `KHR_mesh_quantization`. Current Three.js `GLTFLoader` supports both without a Draco or Meshopt decoder.

`meshy-tasks.json` records the Meshy task identifiers and credit usage. The API key is not stored in this repository.

## Indi experiment

- Route: `/indi-lab/desktop-3d`.
- The route is enabled automatically when `NEXT_PUBLIC_SUPABASE_URL` points to the Indi project.
- For isolated local preview, set `INDI_3D_LAB_ENABLED=1` before starting Next.js.
- Other environments receive a server-side 404, and the existing `/dashboard` is unchanged.
