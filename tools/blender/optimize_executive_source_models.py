import bpy
import json
import os
import sys


ASSETS = {
    "desk-organizer": {
        "source": "Meshy_AI_Wooden_desk_organizer_0727050115_texture.glb",
        "target_triangles": 65000,
    },
    "document-tray": {
        "source": "Meshy_AI_Copper_Leather_Desk_T_0727050229_texture.glb",
        "target_triangles": 70000,
    },
    "trash-tray": {
        "source": "Meshy_AI_Golden_Rimmed_Wooden__0727050132_texture.glb",
        "target_triangles": 60000,
    },
    "desk-lamp": {
        "source": "Meshy_AI_Golden_Brass_Desk_Lam_0727050355_texture.glb",
        "target_triangles": 75000,
    },
    "projects-book": {
        "source": "Meshy_AI_Leather_Projects_Note_0727050428_texture.glb",
        "target_triangles": 110000,
    },
    "ai-droid": {
        "source": "Meshy_AI_Dapper_Droid_on_a_Ped_0727050439_texture.glb",
        "target_triangles": 85000,
    },
    "ai-console": {
        "source": "Meshy_AI_AI_аналитик__0727050740_texture.glb",
        "target_triangles": 85000,
    },
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)


def mesh_triangles(obj):
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def optimize_asset(source_dir, output_dir, asset_name, settings):
    clear_scene()
    source_path = os.path.join(source_dir, settings["source"])
    destination = os.path.join(output_dir, f"{asset_name}.glb")
    bpy.ops.import_scene.gltf(filepath=source_path)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    source_triangles = sum(mesh_triangles(obj) for obj in meshes)
    target_triangles = settings["target_triangles"]
    ratio = min(1.0, target_triangles / max(source_triangles, 1))

    if ratio < 0.98:
        for obj in meshes:
            modifier = obj.modifiers.new(name="Executive Web Decimate", type="DECIMATE")
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    for image in bpy.data.images:
        width, height = image.size
        maximum = max(width, height)
        if maximum > 1024:
            image_scale = 1024 / maximum
            image.scale(
                max(1, round(width * image_scale)),
                max(1, round(height * image_scale)),
            )

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=destination,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=76,
        export_image_quality=76,
    )

    optimized_triangles = sum(mesh_triangles(obj) for obj in meshes)
    return {
        "asset": asset_name,
        "source": settings["source"],
        "source_triangles": source_triangles,
        "optimized_triangles": optimized_triangles,
        "bytes": os.path.getsize(destination),
    }


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit(
            "Usage: blender --background --python optimize_executive_source_models.py "
            "-- SOURCE_DIR OUTPUT_DIR"
        )

    source_dir = os.path.abspath(args[0])
    output_dir = os.path.abspath(args[1])
    os.makedirs(output_dir, exist_ok=True)

    report = [
        optimize_asset(source_dir, output_dir, asset_name, settings)
        for asset_name, settings in ASSETS.items()
    ]
    with open(
        os.path.join(output_dir, "manifest.json"),
        "w",
        encoding="utf-8",
    ) as report_file:
        json.dump(report, report_file, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False))


main()
