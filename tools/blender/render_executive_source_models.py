import bpy
import json
import math
import os
import sys
from mathutils import Vector


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for block in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def model_bounds():
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("ExecutiveStudio"):
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)

    if not points:
        raise RuntimeError("The imported GLB does not contain mesh geometry")

    min_v = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    max_v = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    return min_v, max_v


def create_studio_material(name, color, roughness=0.72, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def add_studio(center, min_v, extent):
    floor_material = create_studio_material(
        "ExecutiveStudio walnut",
        (0.052, 0.025, 0.014),
        roughness=0.5,
    )
    backdrop_material = create_studio_material(
        "ExecutiveStudio backdrop",
        (0.009, 0.008, 0.007),
        roughness=0.82,
    )

    bpy.ops.mesh.primitive_plane_add(
        size=max(extent * 8.0, 12.0),
        location=(center.x, center.y, min_v.z - extent * 0.012),
    )
    floor = bpy.context.object
    floor.name = "ExecutiveStudio floor"
    floor.data.materials.append(floor_material)

    bpy.ops.mesh.primitive_plane_add(
        size=max(extent * 8.0, 12.0),
        location=(center.x, center.y + extent * 2.3, center.z + extent * 0.55),
        rotation=(math.pi / 2, 0, 0),
    )
    backdrop = bpy.context.object
    backdrop.name = "ExecutiveStudio backdrop"
    backdrop.data.materials.append(backdrop_material)

    camera_location = (
        center.x + extent * 1.45,
        center.y - extent * 1.9,
        center.z + extent * 1.15,
    )
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = "ExecutiveStudio camera"
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.58
    bpy.context.scene.camera = camera

    lights = [
        (
            "ExecutiveStudio key",
            (center.x - extent * 1.4, center.y - extent, center.z + extent * 2.2),
            950,
            (1.0, 0.58, 0.27),
            extent * 1.25,
        ),
        (
            "ExecutiveStudio fill",
            (center.x + extent * 1.8, center.y - extent * 0.1, center.z + extent * 1.25),
            520,
            (0.3, 0.5, 0.66),
            extent,
        ),
        (
            "ExecutiveStudio rim",
            (center.x, center.y + extent * 1.4, center.z + extent * 1.7),
            760,
            (1.0, 0.7, 0.38),
            extent * 0.8,
        ),
    ]
    for name, location, energy, color, size in lights:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()


def render_model(source_path, output_dir):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=source_path)

    min_v, max_v = model_bounds()
    center = (min_v + max_v) / 2
    dimensions = max_v - min_v
    extent = max(dimensions.x, dimensions.y, dimensions.z, 0.001)
    add_studio(center, min_v, extent)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(
        output_dir,
        f"{os.path.splitext(os.path.basename(source_path))[0]}.png",
    )
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.004, 0.004, 1.0)
    background.inputs["Strength"].default_value = 0.16

    bpy.ops.render.render(write_still=True)
    return {
        "source": source_path,
        "preview": scene.render.filepath,
        "dimensions": [
            round(dimensions.x, 5),
            round(dimensions.y, 5),
            round(dimensions.z, 5),
        ],
        "extent": round(extent, 5),
    }


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) < 2:
        raise SystemExit(
            "Usage: blender --background --python render_executive_source_models.py "
            "-- OUTPUT_DIR SOURCE.glb [SOURCE.glb ...]"
        )

    output_dir = os.path.abspath(args[0])
    os.makedirs(output_dir, exist_ok=True)
    report = [render_model(os.path.abspath(path), output_dir) for path in args[1:]]

    report_path = os.path.join(output_dir, "source-models.json")
    with open(report_path, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False))


main()
