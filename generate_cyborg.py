#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
High-Detail Cyber-Merc 2077 Polygonal 3D Generator (.bbmodel)
Target Height: 29.5 units (184 cm)
Features:
  - Sculpted cyber-face with glowing cyan neon cyber-visor & exposed bionic cyber-eye
  - Silver shaggy cyber-hair (24+ sharp 3D strands)
  - High-collar neon-lit cyberpunk jacket with glowing cyan piping & circuit seams
  - Chrome bionic left cyber-arm with hydraulic pistons & 5 segmented fingers
  - Back cyber-deck / oxygen rig with dual canisters & glowing cyan coolant tubes
  - Tactical cargo pants with thigh pouches, cyber-knee pads & neon-soled combat boots
  - 1024x1024 texture atlas with AO & specular highlights
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    PolyMesh,
    build_lofted_mesh,
    make_ellipse_ring,
    build_sculpted_head_mesh,
    build_multi_strand_hair_layer,
    build_open_coat_arc_mesh,
    build_beveled_box_mesh,
    build_armor_plate,
    build_buckle_assembly,
    build_pouch_mesh,
    build_cylinder_mesh,
    build_tapered_cylinder,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    bake_elements_atlas,
    scale_elements_to_height,
    export_bbmodel,
)


class CyberPalette:
    SKIN_BASE = (228, 206, 194, 255)
    SKIN_HL = (244, 226, 216, 255)
    SKIN_SHADOW = (192, 168, 156, 255)
    SKIN_DEEP = (156, 132, 122, 255)
    LIPS = (168, 122, 118, 255)

    HAIR_HL = (232, 240, 252, 255)
    HAIR_MID = (182, 196, 218, 255)
    HAIR_SHADE = (132, 146, 172, 255)
    HAIR_DEEP = (86, 98, 124, 255)

    JACKET_DARK = (22, 24, 34, 255)
    JACKET_MID = (36, 40, 56, 255)
    JACKET_HL = (62, 68, 92, 255)

    CYAN_GLOW = (0, 248, 255, 255)
    CYAN_MID = (0, 178, 212, 255)
    CYAN_DARK = (8, 72, 96, 255)

    CHROME_HL = (238, 244, 252, 255)
    CHROME_MID = (164, 174, 190, 255)
    CHROME_DARK = (88, 96, 112, 255)

    PANTS_DARK = (24, 26, 32, 255)
    PANTS_MID = (40, 44, 54, 255)
    BOOT_DARK = (16, 18, 24, 255)


# ---------------------------------------------------------------------------
# Procedural Texture Painters
# ---------------------------------------------------------------------------
def paint_cyber_face(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    for y in range(0, int(h * 0.24)):
        d.line([(0, y), (w - 1, y)], fill=CyberPalette.SKIN_SHADOW)
    for y in range(int(h * 0.58), h):
        d.line([(0, y), (3, y)], fill=CyberPalette.SKIN_SHADOW)
        d.line([(w - 4, y), (w - 1, y)], fill=CyberPalette.SKIN_SHADOW)
    d.line([(0, h - 2), (w - 1, h - 1)], fill=CyberPalette.SKIN_DEEP)

    # Cybernetic cheek seam lines
    d.line([(int(w * 0.18), int(h * 0.55)), (int(w * 0.30), int(h * 0.72))], fill=CyberPalette.CHROME_DARK, width=1)
    d.line([(int(w * 0.82), int(h * 0.55)), (int(w * 0.70), int(h * 0.72))], fill=CyberPalette.CHROME_DARK, width=1)

    # Eyes (left biological, right glowing cyan bionic)
    ey = int(h * 0.42)
    lx, rx = int(w * 0.28), int(w * 0.72)
    d.rectangle([lx - 4, ey, lx + 4, ey + 4], fill=(240, 244, 250, 255))
    d.rectangle([lx - 2, ey, lx + 2, ey + 4], fill=(54, 88, 128, 255))
    d.rectangle([rx - 4, ey - 1, rx + 4, ey + 5], fill=CyberPalette.CHROME_DARK)
    d.rectangle([rx - 2, ey + 1, rx + 2, ey + 3], fill=CyberPalette.CYAN_GLOW)

    # Nose & stern mouth
    nx = w // 2
    d.line([(nx, int(h * 0.48)), (nx, int(h * 0.62))], fill=CyberPalette.SKIN_HL)
    my = int(h * 0.78)
    d.line([(nx - 5, my), (nx + 5, my)], fill=CyberPalette.LIPS, width=2)
    return img


def paint_skin(w, h):
    # Smooth uniform skin tone without horizontal banding across mesh rings
    return Image.new("RGBA", (w, h), CyberPalette.SKIN_BASE)


def paint_silver_hair(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.HAIR_MID)
    d = ImageDraw.Draw(img)
    for x in range(w):
        c = CyberPalette.HAIR_HL if x % 4 == 0 else (CyberPalette.HAIR_SHADE if x % 3 == 0 else CyberPalette.HAIR_MID)
        d.line([(x, 0), (x, h - 1)], fill=c)
    d.line([(0, 0), (w - 1, 0)], fill=CyberPalette.HAIR_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=CyberPalette.HAIR_DEEP)
    return img


def paint_cyber_visor(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.CYAN_DARK)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=CyberPalette.CHROME_DARK)
    for y in range(2, h - 2):
        c = CyberPalette.CYAN_GLOW if (y % 3 == 0) else CyberPalette.CYAN_MID
        d.line([(2, y), (w - 3, y)], fill=c)
    # Specular diagonal glint
    for i in range(min(w, h)):
        if i + 2 < w and i + 1 < h:
            d.point((i + 2, i + 1), fill=(255, 255, 255, 255))
    return img


def paint_cyber_jacket(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.JACKET_MID)
    d = ImageDraw.Draw(img)
    for y in range(h):
        if y % 6 == 0:
            d.line([(0, y), (w - 1, y)], fill=CyberPalette.JACKET_DARK)
    d.line([(0, 0), (w - 1, 0)], fill=CyberPalette.JACKET_HL)
    # Circuit seams & glowing cyan piping
    d.line([(0, 2), (w - 1, 2)], fill=CyberPalette.CYAN_GLOW)
    if w >= 12:
        d.line([(w // 3, 2), (w // 3, h // 2), (w // 2, h // 2 + 4)], fill=CyberPalette.CYAN_MID)
        d.line([(2 * w // 3, 2), (2 * w // 3, h - 3)], fill=CyberPalette.CYAN_MID)
    return img


def paint_chrome(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.CHROME_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=CyberPalette.CHROME_HL)
    d.line([(0, 1), (w - 1, 1)], fill=CyberPalette.CHROME_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=CyberPalette.CHROME_DARK)
    if w >= 8:
        d.line([(w // 2, 0), (w // 2, h - 1)], fill=CyberPalette.CHROME_DARK)
    return img


def paint_cyan_glow(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.CYAN_GLOW)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=(220, 255, 255, 255))
    d.line([(0, h - 1), (w - 1, h - 1)], fill=CyberPalette.CYAN_MID)
    return img


def paint_cargo_pants(w, h):
    # Subtle vertical tactical weave without horizontal striping
    img = Image.new("RGBA", (w, h), CyberPalette.PANTS_MID)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 5 == 0:
            d.line([(x, 0), (x, h - 1)], fill=(34, 38, 48, 255))
    return img


def paint_boot(w, h):
    img = Image.new("RGBA", (w, h), CyberPalette.BOOT_DARK)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=CyberPalette.CHROME_DARK)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=CyberPalette.CYAN_GLOW)
    return img


# ---------------------------------------------------------------------------
# Model Builder
# ---------------------------------------------------------------------------
def build_cyborg():
    els = []
    group_origins = {
        "root": [0, 0, 0],
        "root/torso": [0, 14.5, 0],
        "root/torso/neck": [0, 23.6, 0],
        "root/torso/neck/head": [0, 24.7, 0],
        "root/torso/arm_left": [4.10, 22.3, 0],
        "root/torso/arm_right": [-4.10, 22.3, 0],
        "root/torso/leg_left": [1.9, 13.8, 0],
        "root/torso/leg_right": [-1.9, 13.8, 0],
    }

    # --- 1. HEAD, CYBER-VISOR, BIONIC EYE, 24-STRAND SILVER HAIR ---
    head_gp = ["root", "torso", "neck", "head"]
    neck_gp = ["root", "torso", "neck"]

    els.append(build_tapered_cylinder(
        "neck_mesh", neck_gp, origin=[0, 23.2, 0], r_bottom=1.35, r_top=1.18, height=1.8,
        n_sides=12, n_rings=3, side_painter=paint_skin, cap_top_painter=paint_skin, cap_bot_painter=paint_skin
    ))

    els.append(build_sculpted_head_mesh(
        "head_sculpted", head_gp, origin=[0, 24.7, 0],
        y_bot=24.5, y_top=29.0, width=4.0, depth=4.2,
        face_painter=paint_cyber_face, hair_painter=paint_silver_hair, skin_painter=paint_skin,
    ))

    # Glowing Cyan Cyber-Visor + Bionic Eye Module
    els.append(build_armor_plate(
        "cyber_visor", head_gp, origin=[0, 26.85, -2.18], width=3.5, height=0.85,
        thickness=0.22, curve_z=0.45, painter=paint_cyber_visor, trim_painter=paint_chrome
    ))
    els.append(build_cylinder_mesh(
        "bionic_eye_housing", head_gp, origin=[-0.92, 26.85, -2.25], radius=0.34, height=0.32,
        n_sides=12, axis="z", side_painter=paint_chrome, cap_top_painter=paint_cyan_glow, cap_bot_painter=paint_chrome
    ))
    els.append(build_beveled_box_mesh(
        "visor_temple_l", head_gp, 1.55, 26.55, -1.8, 2.15, 27.15, 0.2,
        bevel=0.06, origin=[1.85, 26.85, -0.8], painter=paint_chrome
    ))
    els.append(build_beveled_box_mesh(
        "visor_temple_r", head_gp, -2.15, 26.55, -1.8, -1.55, 27.15, 0.2,
        bevel=0.06, origin=[-1.85, 26.85, -0.8], painter=paint_chrome
    ))

    # 24-strand silver shaggy cyber-hair
    hair_specs = [
        ("bang_c1", (0.2, 4.15, -2.0), (16, -10, -8), 0.9, 0.42, 2.2, (-0.15, -0.2), 1.15, 0.14),
        ("bang_c2", (-0.55, 4.15, -1.95), (18, 12, 12), 0.95, 0.45, 2.4, (0.2, -0.25), 1.15, 0.16),
        ("bang_c3", (0.95, 4.0, -1.85), (14, -18, -14), 0.85, 0.42, 2.1, (-0.1, -0.2), 1.1, 0.12),
        ("bang_l1", (1.5, 3.8, -1.4), (10, -28, -20), 0.85, 0.48, 2.5, (0.15, -0.15), 1.15, 0.10),
        ("bang_r1", (-1.4, 3.8, -1.4), (10, 28, 20), 0.85, 0.48, 2.6, (-0.15, -0.15), 1.15, 0.10),
        ("side_l1", (1.95, 3.4, -0.5), (6, -16, -14), 0.85, 0.65, 2.8, (0.2, 0.0), 1.15, 0.0),
        ("side_l2", (2.0, 3.2, 0.55), (-4, -12, -12), 0.9, 0.68, 3.0, (0.2, 0.1), 1.15, 0.0),
        ("side_r1", (-1.95, 3.4, -0.5), (6, 16, 14), 0.85, 0.65, 2.8, (-0.2, 0.0), 1.15, 0.0),
        ("side_r2", (-2.0, 3.2, 0.55), (-4, 12, 12), 0.9, 0.68, 3.0, (-0.2, 0.1), 1.15, 0.0),
        ("top_1", (0.0, 4.45, -0.5), (-66, 0, 0), 1.25, 0.68, 2.3, (0.0, 0.2), 1.2, 0.08),
        ("top_2", (-0.85, 4.35, -0.35), (-62, 14, 12), 1.1, 0.65, 2.4, (-0.1, 0.2), 1.15, 0.08),
        ("top_3", (0.85, 4.35, -0.35), (-62, -14, -12), 1.1, 0.65, 2.4, (0.1, 0.2), 1.15, 0.08),
        ("spike_1", (0.0, 4.4, 0.1), (-42, 0, 0), 0.8, 0.55, 1.8, (0.0, 0.1), 1.1, 0.05),
        ("spike_2", (0.7, 4.3, 0.3), (-48, -16, -8), 0.75, 0.5, 1.8, (0.1, 0.15), 1.1, 0.05),
        ("spike_3", (-0.7, 4.3, 0.3), (-48, 16, 8), 0.75, 0.5, 1.8, (-0.1, 0.15), 1.1, 0.05),
        ("crown_c", (0.0, 4.35, 0.8), (-82, 0, 0), 1.35, 0.72, 2.3, (0.0, 0.2), 1.2, 0.1),
        ("crown_l", (1.0, 4.2, 0.85), (-76, -18, -10), 1.1, 0.68, 2.4, (0.15, 0.15), 1.15, 0.1),
        ("crown_r", (-1.0, 4.2, 0.85), (-76, 18, 10), 1.1, 0.68, 2.4, (-0.15, 0.15), 1.15, 0.1),
        ("back_1", (0.0, 3.6, 1.95), (-14, 0, 0), 1.3, 0.72, 3.6, (0.0, 0.25), 1.2, 0.0),
        ("back_2", (0.95, 3.5, 1.8), (-12, -14, -8), 1.1, 0.68, 3.5, (0.1, 0.2), 1.15, 0.0),
        ("back_3", (-0.95, 3.5, 1.8), (-12, 14, 8), 1.1, 0.68, 3.5, (-0.1, 0.2), 1.15, 0.0),
        ("back_4", (1.65, 3.2, 1.3), (-10, -24, -10), 0.95, 0.65, 3.2, (0.15, 0.15), 1.1, 0.0),
        ("back_5", (-1.65, 3.2, 1.3), (-10, 24, 10), 0.95, 0.65, 3.2, (-0.15, 0.15), 1.1, 0.0),
        ("nape_c", (0.0, 1.8, 1.95), (-20, 0, 0), 1.0, 0.5, 2.2, (0.0, 0.25), 1.1, 0.0),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", head_gp, [0, 24.7, 0], hair_specs, painter=paint_silver_hair, n_sides=6, n_rings=4
    ))

    # --- 2. HIGH-COLLAR CYBERPUNK JACKET & BACK CYBER-DECK / OXYGEN RIG ---
    torso_gp = ["root", "torso"]
    inner_rings = [
        make_ellipse_ring(0, 13.8, 0, 2.8, 1.8, n_pts=14),
        make_ellipse_ring(0, 15.8, 0, 2.6, 1.65, n_pts=14),
        make_ellipse_ring(0, 19.0, 0, 3.1, 1.9, n_pts=14),
        make_ellipse_ring(0, 22.0, 0, 3.7, 2.1, n_pts=14),
        make_ellipse_ring(0, 23.6, 0, 2.3, 1.55, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "inner_suit", torso_gp, inner_rings, origin=[0, 14.5, 0],
        side_painter=paint_cargo_pants, cap_top_painter=paint_cyber_jacket, cap_bot_painter=paint_cargo_pants
    ))

    # Open-front cyberpunk jacket shell + tall popped collar
    jacket_levels = [
        (14.0, 3.05, 2.02, 0.0, 1.0),
        (16.0, 2.85, 1.88, 0.0, 1.0),
        (19.2, 3.35, 2.12, 0.0, 1.0),
        (22.2, 3.92, 2.32, 0.0, 1.0),
    ]
    els.append(build_open_coat_arc_mesh(
        "cyber_jacket", torso_gp, origin=[0, 18.0, 0], levels=jacket_levels,
        outer_painter=paint_cyber_jacket, inner_painter=paint_chrome, trim_painter=paint_cyan_glow,
        thickness=0.18, open_half_deg=24.0, n_arc=13
    ))
    collar_levels = [
        (22.2, 2.55, 1.85, 0.0, 1.0),
        (23.8, 2.75, 2.05, 0.0, 1.0),
        (25.2, 2.95, 2.20, 0.0, 1.0),
    ]
    els.append(build_open_coat_arc_mesh(
        "cyber_high_collar", torso_gp, origin=[0, 23.6, 0], levels=collar_levels,
        outer_painter=paint_cyber_jacket, inner_painter=paint_cyan_glow, trim_painter=paint_cyan_glow,
        thickness=0.16, open_half_deg=34.0, n_arc=13
    ))

    # Glowing Cyan Chest Circuit Seams & Nodes + Belt (contour-following, zero floating gap)
    def _jacket_front_z(x, y):
        if y <= 16.0:
            t = max(0.0, (y - 14.0) / 2.0)
            rx_y, rz_y = 3.05 + (2.85 - 3.05) * t, 2.02 + (1.88 - 2.02) * t
        elif y <= 19.2:
            t = (y - 16.0) / 3.2
            rx_y, rz_y = 2.85 + (3.35 - 2.85) * t, 1.88 + (2.12 - 1.88) * t
        else:
            t = min(1.0, (y - 19.2) / 3.0)
            rx_y, rz_y = 3.35 + (3.92 - 3.35) * t, 2.12 + (2.32 - 2.12) * t
        ratio = min(0.92, abs(x) / max(0.1, rx_y))
        return -rz_y * ((1.0 - ratio * ratio) ** 0.5)

    for side, sx in [("l", 1.35), ("r", -1.35)]:
        seam_rings = [
            make_ellipse_ring(sx, 15.8, _jacket_front_z(sx, 15.8), 0.14, 0.14, n_pts=8),
            make_ellipse_ring(sx, 18.0, _jacket_front_z(sx, 18.0), 0.14, 0.14, n_pts=8),
            make_ellipse_ring(sx, 20.2, _jacket_front_z(sx, 20.2), 0.14, 0.14, n_pts=8),
            make_ellipse_ring(sx, 21.8, _jacket_front_z(sx, 21.8), 0.14, 0.14, n_pts=8),
        ]
        els.append(build_lofted_mesh(
            f"jacket_seam_{side}", torso_gp, seam_rings, origin=[sx, 18.8, -1.9],
            side_painter=paint_cyan_glow, cap_top_painter=paint_cyan_glow, cap_bot_painter=paint_cyan_glow
        ))
        for n_idx, ny in enumerate([16.8, 19.0, 21.2]):
            nz = _jacket_front_z(sx * 1.15, ny) - 0.04
            els.append(build_cylinder_mesh(
                f"circuit_node_{side}_{n_idx}", torso_gp, origin=[sx * 1.15, ny, nz], radius=0.14, height=0.22,
                n_sides=8, axis="z", side_painter=paint_chrome, cap_top_painter=paint_cyan_glow
            ))
    for fin_idx in range(4):
        fy = 17.8 + fin_idx * 1.05
        els.append(build_beveled_box_mesh(
            f"cyber_deck_fin_{fin_idx}", torso_gp, -1.35, fy, 2.95, 1.35, fy + 0.18, 3.35,
            bevel=0.03, origin=[0, fy + 0.09, 3.15], painter=paint_chrome
        ))
    els.append(build_lofted_mesh(
        "cyber_belt", torso_gp,
        [make_ellipse_ring(0, 14.8, 0, 2.95, 1.92, n_pts=14), make_ellipse_ring(0, 15.8, 0, 2.92, 1.90, n_pts=14)],
        origin=[0, 15.3, 0], side_painter=paint_boot, cap_top_painter=paint_boot, cap_bot_painter=paint_boot
    ))
    els.extend(build_buckle_assembly(
        "cyber_buckle", torso_gp, origin=[0, 15.3, -1.96], width=1.2, height=0.9, depth=0.28,
        frame_painter=paint_chrome, pin_painter=paint_cyan_glow
    ))

    # Back Cyber-Deck / Oxygen Rig with Glowing Cyan Tubes
    els.append(build_beveled_box_mesh(
        "cyber_deck_core", torso_gp, -1.65, 17.2, 1.95, 1.65, 21.8, 3.15,
        bevel=0.22, origin=[0, 19.5, 2.55], painter=paint_chrome
    ))
    els.append(build_beveled_box_mesh(
        "cyber_deck_glow_strip", torso_gp, -0.35, 17.6, 3.05, 0.35, 21.4, 3.28,
        bevel=0.05, origin=[0, 19.5, 3.16], painter=paint_cyan_glow
    ))
    for side, cx in [("l", 1.15), ("r", -1.15)]:
        els.append(build_cylinder_mesh(
            f"oxy_canister_{side}", torso_gp, origin=[cx, 17.5, 2.65], radius=0.48, height=3.8,
            n_sides=12, side_painter=paint_cyber_jacket, cap_top_painter=paint_chrome, cap_bot_painter=paint_chrome
        ))
        els.append(build_tapered_cylinder(
            f"glow_tube_upper_{side}", torso_gp, origin=[cx, 21.3, 2.5], r_bottom=0.16, r_top=0.14, height=2.2,
            n_sides=10, n_rings=3, rotation=[28, 0, -cx * 14], side_painter=paint_cyan_glow
        ))
        els.append(build_tapered_cylinder(
            f"glow_tube_lower_{side}", torso_gp, origin=[cx * 0.75, 17.2, 2.45], r_bottom=0.14, r_top=0.14, height=1.8,
            n_sides=10, n_rings=3, rotation=[-24, 0, cx * 10], side_painter=paint_cyan_glow
        ))

    # --- 3. ANATOMICAL CHROME BIONIC LEFT ARM (PISTONS) & RIGHT ARM ---
    bionic_radii = {"shoulder": 1.28, "bicep": 1.10, "elbow": 0.88, "forearm": 0.96, "wrist": 0.74}
    lgp = ["root", "torso", "arm_left"]
    l_sh, l_el, l_wr = [4.10, 22.3, 0.0], [4.35, 19.0, 0.10], [4.45, 15.8, -0.10]
    els.extend(build_anatomical_arm_parts(
        "left", 1.0, lgp, l_sh, l_el, l_wr, bionic_radii,
        sleeve_painter=paint_chrome, skin_painter=paint_chrome, glove_painter=paint_chrome
    ))
    els.append(build_armor_plate(
        "bionic_pauldron_l", lgp, origin=[4.82, 22.4, 0], width=1.9, height=2.0,
        thickness=0.35, curve_z=0.38, rotation=[0, -90, 0], painter=paint_chrome, trim_painter=paint_cyan_glow
    ))
    # Hydraulic pistons seated flush against bionic arm
    for p_idx, pz in enumerate([-0.68, 0.68]):
        els.append(build_cylinder_mesh(
            f"bionic_piston_outer_{p_idx}", lgp, origin=[4.78, 19.5, pz], radius=0.18, height=1.8,
            n_sides=10, side_painter=paint_cyber_jacket, cap_top_painter=paint_chrome
        ))
        els.append(build_tapered_cylinder(
            f"bionic_piston_rod_{p_idx}", lgp, origin=[4.82, 17.8, pz], r_bottom=0.11, r_top=0.11, height=1.8,
            n_sides=10, n_rings=2, side_painter=paint_chrome
        ))
    els.append(build_beveled_box_mesh(
        "bionic_glow_strip", lgp, 5.18, 16.3, -0.22, 5.38, 18.7, 0.22,
        bevel=0.04, origin=[5.28, 17.5, 0], painter=paint_cyan_glow
    ))
    for b_idx, (by, bz) in enumerate([(16.6, -0.78), (16.6, 0.78), (18.3, -0.82), (18.3, 0.82)]):
        els.append(build_cylinder_mesh(
            f"bionic_bolt_{b_idx}", lgp, origin=[4.92, by, bz], radius=0.12, height=0.22,
            n_sides=8, axis="z", side_painter=paint_chrome, cap_top_painter=paint_cyan_glow
        ))

    # Right Arm (anatomical jacket sleeve + cyber glove)
    jacket_radii = {"shoulder": 1.32, "bicep": 1.15, "elbow": 0.92, "forearm": 1.00, "wrist": 0.76}
    rgp = ["root", "torso", "arm_right"]
    r_sh, r_el, r_wr = [-4.10, 22.3, 0.0], [-4.35, 19.0, 0.10], [-4.45, 15.8, -0.10]
    els.extend(build_anatomical_arm_parts(
        "right", -1.0, rgp, r_sh, r_el, r_wr, jacket_radii,
        sleeve_painter=paint_cyber_jacket, skin_painter=paint_cyber_jacket, glove_painter=paint_boot
    ))
    els.append(build_armor_plate(
        "pauldron_r", rgp, origin=[-4.85, 22.4, 0], width=1.9, height=2.0,
        thickness=0.35, curve_z=0.38, rotation=[0, 90, 0], painter=paint_cyber_jacket, trim_painter=paint_cyan_glow
    ))
    els.append(build_cylinder_mesh(
        "cuff_glow_r", rgp, origin=[-4.45, 15.7, -0.10], radius=0.92, height=0.45, n_sides=14, side_painter=paint_cyan_glow
    ))

    # --- 4. ANATOMICAL LEGS, TACTICAL CARGO PANTS & NEON-SOLED COMBAT BOOTS ---
    leg_radii = {"hip": 1.68, "thigh": 1.56, "knee": 1.24, "calf": 1.32, "ankle": 1.02}
    for side, sx in [("left", 1.0), ("right", -1.0)]:
        leg_gp = ["root", "torso", f"leg_{side}"]
        leg_x = sx * 1.9

        els.extend(build_anatomical_leg_parts(
            side, sx, leg_gp,
            hip_pos=[leg_x, 13.8, 0.0],
            knee_pos=[leg_x, 8.6, -0.05],
            ankle_pos=[leg_x, 5.4, 0.05],
            radii=leg_radii,
            pants_painter=paint_cargo_pants,
            boot_painter=paint_cargo_pants,
            knee_painter=paint_cargo_pants,
        ))

        # Thigh cargo pouch & cyber knee armor (seated flush)
        els.append(build_pouch_mesh(
            f"thigh_pouch_{side}", leg_gp, origin=[leg_x + sx * 1.38, 11.2, 0.05],
            width=0.95, height=1.45, depth=0.65, rotation=[0, -sx * 90, 0],
            body_painter=paint_cyber_jacket, flap_painter=paint_chrome, buckle_painter=paint_cyan_glow
        ))
        els.append(build_armor_plate(
            f"knee_armor_{side}", leg_gp, origin=[leg_x, 8.6, -1.32], width=1.75, height=1.95,
            thickness=0.34, curve_z=0.40, painter=paint_chrome, trim_painter=paint_cyan_glow
        ))

        # Combat boot + neon-rimmed sole
        els.append(build_lofted_mesh(
            f"boot_shaft_{side}", leg_gp,
            [
                make_ellipse_ring(leg_x, 0.85, -0.1, 1.28, 1.52, n_pts=14),
                make_ellipse_ring(leg_x, 3.0, 0.0, 1.22, 1.32, n_pts=14),
                make_ellipse_ring(leg_x, 5.8, 0.0, 1.26, 1.32, n_pts=14),
            ],
            origin=[leg_x, 3.0, 0], side_painter=paint_boot, cap_top_painter=paint_chrome, cap_bot_painter=paint_boot
        ))
        els.append(build_beveled_box_mesh(
            f"boot_toe_{side}", leg_gp, leg_x - 1.2, 0.45, -2.45, leg_x + 1.2, 1.7, -0.9,
            bevel=0.22, origin=[leg_x, 1.0, -1.65], painter=paint_chrome
        ))
        els.append(build_beveled_box_mesh(
            f"boot_neon_sole_{side}", leg_gp, leg_x - 1.3, 0.0, -2.55, leg_x + 1.3, 0.55, 1.6,
            bevel=0.10, origin=[leg_x, 0.25, -0.45], painter=paint_cyan_glow
        ))
        for s_idx, sy in enumerate([2.0, 2.9, 3.8, 4.7]):
            els.append(build_beveled_box_mesh(
                f"boot_strap_{side}_{s_idx}", leg_gp, leg_x - 0.65, sy, -1.46, leg_x + 0.65, sy + 0.16, -1.22,
                bevel=0.03, origin=[leg_x, sy, -1.34], painter=paint_chrome
            ))
        for k_idx, ky in enumerate([7.6, 9.6]):
            els.append(build_beveled_box_mesh(
                f"knee_strap_{side}_{k_idx}", leg_gp, leg_x - 1.35, ky, -0.85, leg_x + 1.35, ky + 0.26, 1.38,
                bevel=0.04, origin=[leg_x, ky + 0.13, 0.26], painter=paint_boot
            ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", leg_gp, origin=[leg_x + sx * 1.26, 4.9, -0.2], width=0.58, height=0.46, depth=0.18,
            rotation=[0, -sx * 90, 0], frame_painter=paint_chrome, pin_painter=paint_cyan_glow
        ))

    scale_elements_to_height(els, group_origins, 29.5)
    atlas = bake_elements_atlas(els, atlas_size=1024, max_face_size=128)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", "cyborg.bbmodel")
    bb = export_bbmodel(els, atlas, "cyborg", [out_path], group_origins=group_origins)
    n_faces = sum(len(e.faces) if isinstance(e, PolyMesh) else 6 for e in els)
    print(f"cyborg.bbmodel exported: {len(els)} elements, {n_faces} faces, atlas={atlas.width}x{atlas.height}")
    return bb


if __name__ == "__main__":
    build_cyborg()
