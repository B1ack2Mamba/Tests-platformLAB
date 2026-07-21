import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "indi-3d", "models", "executive-project-folder.glb")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, metallic=0.0, roughness=0.45, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 3.0
    return mat


def rounded_box(name, size, location, mat, bevel=0.04, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Executive edge", "BEVEL")
    modifier.width = min(bevel, min(size) * 0.28)
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def cylinder(name, radius, depth, location, mat, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Executive edge", "BEVEL")
    bevel.width = min(0.025, radius * 0.25)
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    if parent:
        obj.parent = parent
    return obj


def empty(name, location):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def add_stitching(parent, width, depth, z, thread):
    stitches = []
    margin = 0.16
    step = 0.19
    x = -width / 2 + margin
    while x <= width / 2 - margin:
        stitches.append(rounded_box("Stitch", (0.085, 0.018, 0.018), (x, -depth / 2 + margin, z), thread, 0.006, parent))
        stitches.append(rounded_box("Stitch", (0.085, 0.018, 0.018), (x, depth / 2 - margin, z), thread, 0.006, parent))
        x += step
    y = -depth / 2 + margin + step
    while y <= depth / 2 - margin - step:
        stitches.append(rounded_box("Stitch", (0.018, 0.085, 0.018), (-width / 2 + margin, y, z), thread, 0.006, parent))
        stitches.append(rounded_box("Stitch", (0.018, 0.085, 0.018), (width / 2 - margin, y, z), thread, 0.006, parent))
        y += step
    for stitch in stitches:
        stitch.hide_render = False


def keyframe(obj, frame, rotation=None, location=None, scale=None):
    if rotation is not None:
        obj.rotation_euler = rotation
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if location is not None:
        obj.location = location
        obj.keyframe_insert(data_path="location", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert(data_path="scale", frame=frame)


def set_interpolation():
    for action in bpy.data.actions:
        # Blender 5 stores layered action curves differently; keyframes already
        # use Bezier interpolation, so older flat actions are the only ones to tune.
        for curve in getattr(action, "fcurves", []):
            for point in curve.keyframe_points:
                point.interpolation = "BEZIER"
                point.handle_left_type = "AUTO_CLAMPED"
                point.handle_right_type = "AUTO_CLAMPED"


clear_scene()

LEATHER = material("Espresso leather", (0.055, 0.028, 0.018), roughness=0.52)
LEATHER_EDGE = material("Burnished leather edge", (0.018, 0.009, 0.006), roughness=0.64)
WOOD = material("Dark walnut", (0.105, 0.032, 0.012), roughness=0.4)
WOOD_DARK = material("Walnut shadow", (0.026, 0.012, 0.008), roughness=0.55)
BRASS = material("Aged brass", (0.50, 0.23, 0.055), metallic=0.92, roughness=0.24)
PAPER = material("Warm paper", (0.77, 0.67, 0.50), roughness=0.76)
PAPER_LIGHT = material("Working paper", (0.91, 0.82, 0.65), roughness=0.7)
WORKSPACE = material("Project workspace leather", (0.022, 0.014, 0.010), roughness=0.57)
THREAD = material("Tan thread", (0.46, 0.27, 0.10), roughness=0.62)
GREEN = material("Active emerald", (0.01, 0.12, 0.045), roughness=0.3, emission=(0.05, 0.8, 0.22))
AMBER = material("Pause amber", (0.20, 0.055, 0.008), roughness=0.3, emission=(1.0, 0.22, 0.02))

root = empty("ProjectFolder_Root", (0, 0, 0))

# Recessed walnut dock, so the object already belongs to a coherent executive desk.
rounded_box("Walnut_Dock", (5.4, 6.35, 0.32), (0, 0, 0.16), WOOD, 0.14, root)
rounded_box("Dock_Inset", (4.92, 5.86, 0.12), (0, 0, 0.37), WOOD_DARK, 0.11, root)
rounded_box("Bottom_Handle", (1.05, 0.38, 0.18), (0, -3.02, 0.43), BRASS, 0.07, root)

width, depth = 4.35, 5.35
rounded_box("Back_Cover", (width, depth, 0.13), (0, 0, 0.56), LEATHER, 0.10, root)
rounded_box("Page_Block", (4.02, 5.00, 0.42), (0.06, 0, 0.80), PAPER, 0.075, root)
rounded_box("Page_Shadow", (4.07, 5.05, 0.055), (0.04, 0, 1.025), LEATHER_EDGE, 0.03, root)
for index in range(6):
    rounded_box(
        f"Visible_Paper_Layer_{index + 1}",
        (4.04 - index * 0.012, 5.02 - index * 0.014, 0.012),
        (0.04, 0.008 * (index % 2), 0.635 + index * 0.061),
        PAPER_LIGHT if index % 2 == 0 else PAPER,
        0.012,
        root,
    )
rounded_box("Spine", (0.26, 5.28, 0.68), (-2.08, 0, 0.83), LEATHER_EDGE, 0.08, root)

# This fixed right-hand page is revealed by the turning sheets and carries the
# project workspace texture in the browser.
rounded_box("Project_Dashboard_Page", (3.92, 4.86, 0.045), (0.02, 0, 1.06), WORKSPACE, 0.055, root)
rounded_box("Project_Page_Brass_Top", (3.70, 0.035, 0.025), (0.02, 2.28, 1.095), BRASS, 0.01, root)
rounded_box("Project_Page_Brass_Bottom", (3.70, 0.035, 0.025), (0.02, -2.28, 1.095), BRASS, 0.01, root)

cover_pivot = empty("Cover_Pivot", (-2.13, 0, 1.20))
cover_pivot.parent = root
front = rounded_box("Front_Cover", (width, depth, 0.13), (width / 2, 0, 0.0), LEATHER, 0.10, cover_pivot)
rounded_box("Cover_Inner", (4.05, 5.03, 0.035), (width / 2, 0, -0.085), LEATHER_EDGE, 0.04, cover_pivot)
add_stitching(cover_pivot, width, depth, 0.082, THREAD)

for x, y in ((0.16, -2.47), (4.19, -2.47), (0.16, 2.47), (4.19, 2.47)):
    rounded_box("Brass_Corner", (0.30, 0.30, 0.075), (x, y, 0.105), BRASS, 0.055, cover_pivot)

# Minimal icon plate. UI text is rendered as crisp HTML in the browser.
rounded_box("Folder_Icon_Base", (0.72, 0.44, 0.055), (2.17, 0.66, 0.105), BRASS, 0.07, cover_pivot)
rounded_box("Folder_Icon_Tab", (0.28, 0.18, 0.055), (1.98, 0.92, 0.105), BRASS, 0.04, cover_pivot)
cylinder("Active_Light", 0.065, 0.035, (1.78, -0.56, 0.125), GREEN, cover_pivot)
cylinder("Paused_Light", 0.065, 0.035, (1.78, -0.87, 0.125), AMBER, cover_pivot)

# Strap opens independently before the cover starts moving.
strap_pivot = empty("Strap_Pivot", (2.12, 0, 1.28))
strap_pivot.parent = root
rounded_box("Leather_Strap", (0.82, 1.02, 0.13), (0.28, 0, 0), LEATHER, 0.09, strap_pivot)
snap_button = cylinder("Snap_Button", 0.16, 0.065, (0.39, 0, 0.09), BRASS, strap_pivot)

# Three independent pages communicate real depth and give the animation a clear rhythm.
page_pivots = []
for index, (z, mat) in enumerate(((1.07, PAPER_LIGHT), (1.09, PAPER), (1.11, PAPER_LIGHT)), start=1):
    pivot = empty(f"Page_{index}_Pivot", (-1.94, 0, z))
    pivot.parent = root
    rounded_box(f"Page_{index}", (3.86, 4.82, 0.035), (1.93, 0, 0), mat, 0.035, pivot)
    rounded_box(f"Page_{index}_Header", (1.85, 0.11, 0.025), (1.70, 1.60, 0.034), BRASS, 0.015, pivot)
    rounded_box(f"Page_{index}_Line_A", (2.75, 0.045, 0.018), (1.75, 0.92, 0.034), LEATHER_EDGE, 0.008, pivot)
    rounded_box(f"Page_{index}_Line_B", (2.35, 0.045, 0.018), (1.55, 0.55, 0.034), LEATHER_EDGE, 0.008, pivot)
    page_pivots.append(pivot)

# Presentation lift adds weight before the mechanical opening sequence.
keyframe(root, 1, location=(0, 0, 0), scale=(0.965, 0.965, 0.965))
keyframe(root, 22, location=(0, 0, 0.08), scale=(1.0, 1.0, 1.0))
keyframe(root, 190, location=(0, 0, 0.08), scale=(1.0, 1.0, 1.0))

keyframe(snap_button, 1, location=(0.39, 0, 0.09))
keyframe(snap_button, 18, location=(0.39, 0, 0.09))
keyframe(snap_button, 25, location=(0.39, 0, 0.035))
keyframe(snap_button, 33, location=(0.39, 0, 0.09))
keyframe(snap_button, 190, location=(0.39, 0, 0.09))

keyframe(strap_pivot, 1, rotation=(0, 0, 0))
keyframe(strap_pivot, 32, rotation=(0, 0, 0))
keyframe(strap_pivot, 55, rotation=(0, math.radians(-16), math.radians(-82)))
keyframe(strap_pivot, 190, rotation=(0, math.radians(-18), math.radians(-78)))

keyframe(cover_pivot, 1, rotation=(0, 0, 0))
keyframe(cover_pivot, 55, rotation=(0, 0, 0))
keyframe(cover_pivot, 66, rotation=(0, math.radians(-7), 0))
keyframe(cover_pivot, 105, rotation=(0, math.radians(-156), 0))
keyframe(cover_pivot, 116, rotation=(0, math.radians(-181), 0))
keyframe(cover_pivot, 126, rotation=(0, math.radians(-178), 0))
keyframe(cover_pivot, 190, rotation=(0, math.radians(-178), 0))

page_frames = ((112, 138, -174), (132, 158, -170), (151, 178, -166))
for pivot, (start, end, angle) in zip(page_pivots, page_frames):
    keyframe(pivot, 1, rotation=(0, 0, 0))
    keyframe(pivot, start, rotation=(0, 0, 0))
    keyframe(pivot, end, rotation=(0, math.radians(angle), 0))
    keyframe(pivot, 190, rotation=(0, math.radians(angle), 0))

set_interpolation()
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 190
bpy.context.scene.render.fps = 30

# Export only scene geometry and animation. Lighting and camera stay responsive in Three.js.
bpy.ops.object.select_all(action="SELECT")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
)
print(OUT)
