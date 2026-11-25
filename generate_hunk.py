#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail HUNK "Mr. Death" (Resident Evil 2 / Umbrella Security Service) Polygonal 3D Generator (.bbmodel)
Target Height: 29.2 units (182cm)
Features:
  - 100% True Polygonal Meshes ("type": "mesh") - zero primitive cuboids
  - M88 PASGT tactical helmet (16-segment dome + flared rim) with chin straps & front NVG mount
  - S10 gas mask with sculpted snout, dual glowing red ocular lenses & large side filter canister
  - Heavy Umbrella tactical rig: chest plate, back plate, layered shoulder pauldrons, 8 ammo pouches
  - Back oxygen/gear pack with dual tanks, gauges & connecting hoses
  - Umbrella red-and-white octagonal arm insignia
  - Combat gloves with armored knuckles & articulated fingers, heavy cargo pants, reinforced boots
  - 1024x1024 procedural atlas with Ambient Occlusion, edge highlights & specular glints
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    build_lofted_mesh,
    make_ellipse_ring,
    build_beveled_box_mesh,
    build_tapered_cylinder,
    build_cylinder_mesh,
    build_armor_plate,
    build_buckle_assembly,
    build_pouch_mesh,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    build_muscular_limb_mesh,
    scale_elements_to_height,
    bake_elements_atlas,
    export_bbmodel,
)


class HunkPalette:
    HELMET_DARK = (26, 28, 32, 255)
    HELMET_MID = (42, 46, 52, 255)
    HELMET_HL = (68, 74, 84, 255)

    MASK_RUBBER = (16, 17, 20, 255)
    MASK_HL = (36, 38, 44, 255)
    FILTER_DARK = (28, 30, 36, 255)

    EYE_RED_CORE = (255, 60, 48, 255)
    EYE_RED_GLOW = (220, 18, 22, 255)
    EYE_RED_DARK = (110, 8, 12, 255)
    EYE_GLINT = (255, 220, 220, 255)

    BDU_CHARCOAL = (30, 33, 38, 255)
    BDU_HL = (48, 52, 60, 255)
    BDU_DARK = (16, 18, 22, 255)

    ARMOR_DARK = (20, 22, 26, 255)
    ARMOR_MID = (38, 42, 48, 255)
    ARMOR_HL = (64, 70, 80, 255)

    POUCH_OLIVE = (44, 48, 42, 255)
    POUCH_HL = (64, 70, 60, 255)

    METAL_GUN = (130, 138, 148, 255)
    METAL_HL = (200, 210, 222, 255)
    OXYGEN_TANK = (86, 94, 102, 255)
    UMBRELLA_RED = (204, 22, 32, 255)
    UMBRELLA_WHITE = (238, 240, 244, 255)
    BOOT_SOLE = (8, 8, 10, 255)


def paint_solid_shaded(w, h, color):
    img = Image.new("RGBA", (w, h), color)
    d = ImageDraw.Draw(img)
    hl = (min(255, color[0] + 24), min(255, color[1] + 24), min(255, color[2] + 24), color[3])
    sh = (max(0, color[0] - 24), max(0, color[1] - 24), max(0, color[2] - 24), color[3])
    d.line([(0, 0), (w - 1, 0)], fill=hl)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=sh)
    if w >= 6 and h >= 6:
        d.line([(0, 0), (0, h - 1)], fill=hl)
        d.line([(w - 1, 0), (w - 1, h - 1)], fill=sh)
    return img


def paint_glowing_red_lens(w, h):
    img = Image.new("RGBA", (w, h), HunkPalette.EYE_RED_DARK)
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    for y in range(h):
        for x in range(w):
            dx = (x - cx) / max(1.0, w * 0.5)
            dy = (y - cy) / max(1.0, h * 0.5)
            dist = (dx * dx + dy * dy) ** 0.5
            if dist < 0.45:
                c = HunkPalette.EYE_RED_CORE
            elif dist < 0.80:
                c = HunkPalette.EYE_RED_GLOW
            else:
                c = HunkPalette.EYE_RED_DARK
            d.point((x, y), fill=c)
    if w >= 4 and h >= 4:
        d.point((max(1, cx - 1), max(1, cy - 1)), fill=HunkPalette.EYE_GLINT)
    return img


def paint_umbrella_insignia(w, h):
    img = Image.new("RGBA", (w, h), HunkPalette.ARMOR_DARK)
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            dx, dy = abs(x - cx), abs(y - cy)
            # Alternating red/white octagonal sectors
            is_diag = abs(dx - dy) < max(1, w // 8)
            is_axis = (dx < max(1, w // 8)) or (dy < max(1, h // 8))
            if is_axis:
                d.point((x, y), fill=HunkPalette.UMBRELLA_RED)
            elif is_diag:
                d.point((x, y), fill=HunkPalette.UMBRELLA_WHITE)
            else:
                d.point((x, y), fill=HunkPalette.UMBRELLA_RED if (x + y) % 2 == 0 else HunkPalette.UMBRELLA_WHITE)
    return img


def paint_tactical_armor(w, h):
    img = Image.new("RGBA", (w, h), HunkPalette.ARMOR_MID)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        d.line([(0, y), (w - 1, y)], fill=HunkPalette.ARMOR_DARK)
    d.line([(0, 0), (w - 1, 0)], fill=HunkPalette.ARMOR_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=HunkPalette.ARMOR_DARK)
    return img


def paint_filter_ribbed(w, h):
    img = Image.new("RGBA", (w, h), HunkPalette.FILTER_DARK)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 3):
        d.line([(0, y), (w - 1, y)], fill=HunkPalette.MASK_HL)
    d.line([(0, 0), (w - 1, 0)], fill=HunkPalette.METAL_GUN)
    return img


def paint_metallic(w, h):
    img = Image.new("RGBA", (w, h), HunkPalette.METAL_GUN)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=HunkPalette.METAL_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=(64, 68, 76, 255))
    return img


def build_hunk_elements():
    els = []

    # =======================================================================
    # 1. M88 PASGT HELMET, NVG MOUNT, S10 GAS MASK & GLOWING RED OCULARS
    # =======================================================================
    # Inner Balaclava / Head Core (14-segment)
    head_rings = [
        make_ellipse_ring(0, 24.4, 0.0, 1.55, 1.65, n_pts=14),
        make_ellipse_ring(0, 26.2, 0.0, 1.92, 2.00, n_pts=14),
        make_ellipse_ring(0, 28.2, 0.0, 1.95, 2.02, n_pts=14),
        make_ellipse_ring(0, 29.0, 0.05, 1.45, 1.55, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "balaclava_head", ("head", "face"), head_rings,
        origin=[0, 24.4, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_RUBBER),
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_RUBBER),
        tex_scale=5,
    ))

    # M88 PASGT Tactical Helmet (16-segment flared dome)
    helmet_rings = [
        make_ellipse_ring(0, 26.6, 0.12, 2.38, 2.48, n_pts=16),
        make_ellipse_ring(0, 27.6, 0.08, 2.34, 2.45, n_pts=16),
        make_ellipse_ring(0, 28.6, 0.06, 2.18, 2.28, n_pts=16),
        make_ellipse_ring(0, 29.3, 0.05, 1.72, 1.82, n_pts=16),
        make_ellipse_ring(0, 29.65, 0.05, 0.95, 1.05, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "pasgt_helmet_shell", ("head", "helmet"), helmet_rings,
        origin=[0, 26.6, 0.08],
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.HELMET_MID),
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.HELMET_HL),
        tex_scale=5,
    ))

    # Helmet NVG Front Shroud & Bracket Arm
    els.append(build_beveled_box_mesh(
        "helmet_nvg_shroud", ("head", "helmet"),
        -0.55, 27.65, -2.52, 0.55, 28.55, -2.22, bevel=0.07,
        origin=[0, 28.1, -2.37],
        painter=paint_metallic,
    ))
    els.append(build_beveled_box_mesh(
        "helmet_nvg_arm", ("head", "helmet"),
        -0.25, 28.05, -2.85, 0.25, 28.45, -2.42, bevel=0.05,
        origin=[0, 28.25, -2.63],
        painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
    ))
    # Helmet Chin & Side Straps + Buckle
    for side, sign in [("l", 1), ("r", -1)]:
        els.append(build_beveled_box_mesh(
            f"helmet_strap_{side}", ("head", "helmet"),
            sign * 1.92 - 0.14, 24.8, -0.55, sign * 1.92 + 0.14, 27.0, 0.05, bevel=0.04,
            origin=[sign * 1.92, 25.9, -0.25], rotation=[0, 0, sign * 10],
            painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_MID),
        ))
    els.append(build_beveled_box_mesh(
        "helmet_chin_strap", ("head", "helmet"),
        -1.35, 24.35, -1.65, 1.35, 24.72, -1.25, bevel=0.06,
        origin=[0, 24.53, -1.45],
        painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
    ))

    # S10 Gas Mask Faceplate + Sculpted Snout + Exhale Valve + Dual Glowing Red Ocular Lenses + Side Filter
    els.append(build_armor_plate(
        "s10_mask_faceplate", ("head", "gasmask"),
        origin=[0, 26.0, -1.98], width=3.45, height=2.65, thickness=0.35,
        curve_z=0.52, bevel=0.10,
        painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_RUBBER),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_HL),
    ))
    # Dual Glowing Red Ocular Lenses (Beveled rim + Glowing Red Core)
    for side, sign in [("l", 1), ("r", -1)]:
        ox = sign * 0.86
        els.append(build_cylinder_mesh(
            f"s10_ocular_rim_{side}", ("head", "gasmask"),
            origin=[ox, 26.62, -2.18], radius=0.58, height=0.38, n_sides=14, axis="z",
            rotation=[0, -sign * 10, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_HL),
        ))
        els.append(build_cylinder_mesh(
            f"s10_ocular_lens_{side}", ("head", "gasmask"),
            origin=[ox, 26.62, -2.28], radius=0.46, height=0.26, n_sides=14, axis="z",
            rotation=[0, -sign * 10, 0],
            side_painter=paint_glowing_red_lens,
            cap_top_painter=paint_glowing_red_lens,
            cap_bot_painter=paint_glowing_red_lens,
        ))
    # Sculpted S10 Snout + Nose Bridge + Exhale Valve
    els.append(build_tapered_cylinder(
        "s10_snout_cone", ("head", "gasmask"),
        origin=[0, 25.45, -2.38], r_bottom=0.82, r_top=0.56, height=1.10,
        n_sides=12, n_rings=4, axis="z",
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_RUBBER),
        cap_top_painter=paint_metallic,
    ))
    els.append(build_cylinder_mesh(
        "s10_exhale_valve", ("head", "gasmask"),
        origin=[0, 25.35, -2.96], radius=0.38, height=0.24, n_sides=12, axis="z",
        side_painter=paint_filter_ribbed,
    ))
    # Large Side Filter Canister (Left Cheek +X) + Cheek Voicemitter (-X)
    els.append(build_tapered_cylinder(
        "s10_side_filter", ("head", "gasmask"),
        origin=[1.42, 25.45, -2.28], r_bottom=0.58, r_top=0.64, height=1.25,
        n_sides=14, n_rings=4, axis="z", rotation=[8, -32, 0],
        side_painter=paint_filter_ribbed,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_MID),
    ))
    els.append(build_cylinder_mesh(
        "s10_voicemitter_r", ("head", "gasmask"),
        origin=[-1.15, 25.45, -2.18], radius=0.36, height=0.30, n_sides=12, axis="z",
        rotation=[0, 25, 0],
        side_painter=paint_metallic,
    ))

    # =======================================================================
    # 2. NECK, HEAVY UMBRELLA TACTICAL RIG, CHEST PLATE, PAULDRONS & O2 PACK
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 23.2, 0.0, 1.25, 1.25, n_pts=14),
        make_ellipse_ring(0, 24.8, -0.05, 1.12, 1.15, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "neck_collar_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 23.6, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_DARK),
        tex_scale=5,
    ))

    # 16-segment BDU Tactical Torso
    torso_rings = [
        make_ellipse_ring(0, 13.2, 0.0, 2.68, 1.68, n_pts=16),
        make_ellipse_ring(0, 16.8, 0.0, 3.00, 1.88, n_pts=16),
        make_ellipse_ring(0, 20.8, 0.0, 3.65, 2.08, n_pts=16),
        make_ellipse_ring(0, 23.8, 0.0, 4.30, 1.98, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "torso_bdu_mesh", ("torso", "chest"), torso_rings,
        origin=[0, 13.2, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_CHARCOAL),
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_HL),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_DARK),
        tex_scale=5,
    ))

    # Heavy Umbrella Chest Plate & Back Armor Plate
    els.append(build_armor_plate(
        "umbrella_chest_plate", ("torso", "armor"),
        origin=[0, 19.6, -2.12], width=5.8, height=7.4, thickness=0.50,
        curve_z=0.58, bevel=0.14,
        painter=paint_tactical_armor,
        trim_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        n_cols=6, n_rows=5,
    ))
    els.append(build_armor_plate(
        "umbrella_back_plate", ("torso", "armor"),
        origin=[0, 19.6, 2.12], width=5.6, height=7.4, thickness=0.48,
        curve_z=0.55, bevel=0.14, rotation=[0, 180, 0],
        painter=paint_tactical_armor,
        trim_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        n_cols=6, n_rows=5,
    ))
    # Chest Collarbone Guard + 4 Chest Ammo Pouches
    els.append(build_armor_plate(
        "chest_collar_guard", ("torso", "armor"),
        origin=[0, 22.3, -2.26], width=4.4, height=1.8, thickness=0.30,
        curve_z=0.28, bevel=0.08,
        painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_HL),
    ))
    for p_idx, px in enumerate([-1.95, -0.65, 0.65, 1.95]):
        els.append(build_pouch_mesh(
            f"chest_ammo_pouch_{p_idx}", ("torso", "armor"),
            origin=[px, 17.5, -2.48], width=1.08, height=1.65, depth=0.70,
            body_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.POUCH_OLIVE),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_MID),
            buckle_painter=paint_metallic,
        ))

    # Back Oxygen / Gear Pack (Frame + Dual Oxygen Tanks + Pressure Gauges + Connecting Hoses)
    els.append(build_beveled_box_mesh(
        "back_gear_pack", ("torso", "backpack"),
        -2.25, 15.2, 2.25, 2.25, 22.4, 3.65, bevel=0.18,
        origin=[0, 18.8, 2.95],
        painter=paint_tactical_armor,
    ))
    for side, tx in [("l", 1.15), ("r", -1.15)]:
        els.append(build_tapered_cylinder(
            f"oxygen_tank_{side}", ("torso", "backpack"),
            origin=[tx, 18.8, 3.85], r_bottom=0.68, r_top=0.64, height=5.4,
            n_sides=14, n_rings=4, axis="y",
            side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.OXYGEN_TANK),
            cap_top_painter=paint_metallic,
        ))
        els.append(build_cylinder_mesh(
            f"oxygen_valve_{side}", ("torso", "backpack"),
            origin=[tx, 21.85, 3.85], radius=0.28, height=0.65, n_sides=10, axis="y",
            side_painter=paint_metallic,
        ))
        els.append(build_cylinder_mesh(
            f"oxygen_hose_{side}", ("torso", "backpack"),
            origin=[tx, 22.6, 2.65], radius=0.16, height=2.2, n_sides=10, axis="z",
            rotation=[-18, 0, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.MASK_RUBBER),
        ))

    # Tactical Belt + 3D Buckle + 4 Belt Ammo/Grenade Pouches (flush)
    belt_rings = [
        make_ellipse_ring(0, 12.4, 0.0, 2.76, 1.76, n_pts=16),
        make_ellipse_ring(0, 13.6, 0.0, 2.76, 1.76, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "tactical_belt", ("torso", "belt"), belt_rings,
        origin=[0, 13.0, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        tex_scale=5,
    ))
    els.extend(build_buckle_assembly(
        "belt_buckle", ("torso", "belt"),
        origin=[0, 13.0, -1.84], width=1.40, height=1.08, depth=0.30,
        frame_painter=paint_metallic,
    ))
    for pname, porig, prot in [
        ("front_l", [2.22, 12.95, -1.08], [0, -32, 0]),
        ("front_r", [-2.22, 12.95, -1.08], [0, 32, 0]),
        ("hip_l", [2.72, 12.95, 0.45], [0, -82, 0]),
        ("hip_r", [-2.72, 12.95, 0.45], [0, 82, 0]),
    ]:
        els.append(build_pouch_mesh(
            f"belt_pouch_{pname}", ("torso", "belt"),
            origin=porig, width=0.95, height=1.35, depth=0.68, rotation=prot,
            body_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.POUCH_OLIVE),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_MID),
            buckle_painter=paint_metallic,
        ))

    # =======================================================================
    # 3. SHOULDER PAULDRONS, UMBRELLA INSIGNIA, ANATOMICAL ARMS & COMBAT GLOVES
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        shoulder_pos = [sign * 4.10, 23.0, 0.0]
        elbow_pos = [sign * 4.34, 17.6, 0.04]
        wrist_pos = [sign * 4.44, 13.5, -0.08]
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=shoulder_pos,
            elbow_pos=elbow_pos,
            wrist_pos=wrist_pos,
            radii={"shoulder": 1.26, "bicep": 1.10, "elbow": 0.88, "forearm": 0.94, "wrist": 0.72},
            sleeve_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_CHARCOAL),
            skin_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_HL),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        ))
        sx = shoulder_pos[0]
        # Layered Shoulder Pauldron Armor (seated flush on ShoulderCap)
        els.append(build_armor_plate(
            f"shoulder_pauldron_{side}", (arm_grp, "shoulder"),
            origin=[sx + sign * 0.74, 22.4, 0.0], width=2.25, height=2.50, thickness=0.35,
            curve_z=0.45, bevel=0.12, rotation=[0, -sign * 90, 0],
            painter=paint_tactical_armor,
            trim_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_HL),
        ))
        # Umbrella Corporation Red/White Octagonal Arm Insignia (flush on upper arm)
        els.append(build_beveled_box_mesh(
            f"umbrella_insignia_{side}", (arm_grp, "shoulder"),
            sx + sign * 0.96, 20.3, -0.58, sx + sign * 1.18, 21.55, 0.58, bevel=0.06,
            origin=[sx + sign * 1.07, 20.92, 0],
            painter=paint_umbrella_insignia,
        ))
        # Tactical Forearm Guard (flush on forearm)
        els.append(build_armor_plate(
            f"forearm_guard_{side}", (arm_grp, "forearm"),
            origin=[sx * 1.04 + sign * 0.72, 15.5, -0.04], width=1.25, height=2.6, thickness=0.24,
            curve_z=0.26, bevel=0.08, rotation=[0, -sign * 90, 0],
            painter=paint_tactical_armor,
        ))
        # Combat Glove Knuckle Armor (flush on HandPalm)
        hx, hy, hz = wrist_pos
        els.append(build_beveled_box_mesh(
            f"glove_knuckle_{side}", (arm_grp, "hand"),
            hx - 0.54, hy - 1.14, hz - 0.86, hx + 0.54, hy - 0.70, hz + 0.80, bevel=0.08,
            origin=[hx, hy - 0.92, hz - 0.03],
            painter=paint_tactical_armor,
        ))

    # =======================================================================
    # 4. HEAVY CARGO PANTS, KNEE ARMOR, THIGH RIG & REINFORCED BOOTS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.38
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 13.2, 0.0],
            knee_pos=[lx, 7.1, 0.0],
            ankle_pos=[lx, 1.6, 0.0],
            radii={"hip": 1.30, "thigh": 1.24, "knee": 1.00, "calf": 1.12, "ankle": 0.90},
            pants_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_CHARCOAL),
            boot_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
            knee_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_CHARCOAL),
        ))
        els.append(build_pouch_mesh(
            f"cargo_pocket_{side}", (leg_grp, "thigh"),
            origin=[lx + sign * 1.08, 9.8, -0.04], width=0.60, height=2.25, depth=1.42,
            rotation=[0, -sign * 90, 0],
            body_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_HL),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BDU_DARK),
        ))
        # Armored Knee Pad + Flush Elliptical Strap
        els.append(build_armor_plate(
            f"knee_armor_{side}", (leg_grp, "knee"),
            origin=[lx, 7.15, -1.20], width=1.70, height=1.60, thickness=0.32,
            curve_z=0.38, bevel=0.12,
            painter=paint_tactical_armor,
            trim_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_HL),
        ))
        els.append(build_muscular_limb_mesh(
            f"knee_strap_{side}", (leg_grp, "knee"),
            origin=[lx, 7.15, -0.12],
            ring_specs=[
                (lx, 6.93, -0.12, 1.08, 1.18),
                (lx, 7.37, -0.12, 1.08, 1.18),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        ))
        # Reinforced Combat Boots + Shin Guards + Buckles
        els.append(build_armor_plate(
            f"shin_guard_{side}", (leg_grp, "boot"),
            origin=[lx, 4.4, -1.02], width=1.45, height=3.4, thickness=0.26,
            curve_z=0.32, bevel=0.10,
            painter=paint_tactical_armor,
        ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", (leg_grp, "boot"),
            origin=[lx + sign * 1.04, 5.8, 0.06], width=0.38, height=0.50, depth=0.18,
            rotation=[0, -sign * 90, 0],
            frame_painter=paint_metallic,
        ))
        els.append(build_beveled_box_mesh(
            f"boot_foot_{side}", (leg_grp, "foot"),
            lx - 0.94, 0.45, -2.35, lx + 0.94, 1.85, 1.06, bevel=0.18,
            origin=[lx, 1.2, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.ARMOR_DARK),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", (leg_grp, "foot"),
            lx - 1.00, 0.0, -2.45, lx + 1.00, 0.54, 1.12, bevel=0.08,
            origin=[lx, 0.25, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, HunkPalette.BOOT_SOLE),
        ))

    return els


def main():
    print("[1/3] Building Ultra-High-Detail HUNK 'Mr. Death' (target_height=29.2u)...")
    els = build_hunk_elements()

    group_origins = {
        "head": [0, 24.4, 0],
        "torso": [0, 13.2, 0],
        "left_arm": [4.0, 23.0, 0],
        "left_arm/forearm": [4.35, 17.3, 0],
        "right_arm": [-4.0, 23.0, 0],
        "right_arm/forearm": [-4.35, 17.3, 0],
        "left_leg": [1.38, 13.1, 0],
        "right_leg": [-1.38, 13.1, 0],
    }

    scale = scale_elements_to_height(els, group_origins, target_height=29.2)
    print(f"      Elements: {len(els)} | Uniform scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas with AO & specular highlights...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=HunkPalette.ARMOR_DARK, max_face_size=128)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    atlas.save(os.path.join(base_dir, "output", "hunk_texture.png"), format="PNG")

    targets = [os.path.join(base_dir, "output", "hunk.bbmodel")]
    print("[3/3] Exporting output/hunk.bbmodel...")
    export_bbmodel(els, atlas, "hunk", targets, group_origins=group_origins)
    print("[DONE] HUNK generated successfully!")


if __name__ == "__main__":
    main()
