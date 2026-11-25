#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Leon S. Kennedy (Resident Evil 2 Remake R.P.D.) Polygonal 3D Generator (.bbmodel)
Target Height: 28.5 units (178cm)
Features:
  - 100% True Polygonal Meshes ("type": "mesh") - zero primitive cuboids
  - Sculpted head + ears + expressive eyes + 24+ dirty-blonde parted bangs & layered hair strands
  - R.P.D. navy-blue tactical shirt with rolled cuffs, exposed forearms & R.P.D. shoulder patches
  - Heavy multi-plate R.P.D. kevlar vest with chest pouches, R.P.D. badge, shoulder radio/mic & flashlight
  - Tactical belt with 3D buckle, dual handcuffs, pouches, and thigh holster with Matilda pistol
  - Cargo pants with side cargo pockets, curved knee pads, and laced combat boots
  - 1024x1024 procedural atlas with Ambient Occlusion, edge highlights & specular glints
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    build_sculpted_head_mesh,
    build_lofted_mesh,
    make_ellipse_ring,
    build_multi_strand_hair_layer,
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


class LeonPalette:
    SKIN_BASE = (242, 220, 200, 255)
    SKIN_HL = (252, 236, 220, 255)
    SKIN_SHADOW = (212, 182, 158, 255)
    SKIN_DEEP = (182, 148, 124, 255)
    LIPS = (196, 140, 128, 255)

    HAIR_HL = (216, 186, 134, 255)
    HAIR_LIGHT = (188, 154, 102, 255)
    HAIR_MID = (154, 120, 74, 255)
    HAIR_SHADE = (118, 88, 52, 255)
    HAIR_DEEP = (84, 60, 34, 255)

    EYE_IRIS = (76, 128, 178, 255)
    EYE_PUPIL = (18, 24, 34, 255)
    EYE_WHITE = (246, 248, 252, 255)

    RPD_BLUE = (34, 54, 88, 255)
    RPD_BLUE_HL = (52, 78, 120, 255)
    RPD_BLUE_DARK = (20, 32, 54, 255)

    VEST_NAVY = (24, 30, 44, 255)
    VEST_HL = (44, 52, 72, 255)
    VEST_DARK = (12, 16, 24, 255)

    PANTS_NAVY = (28, 38, 58, 255)
    PANTS_HL = (44, 58, 84, 255)

    LEATHER_DARK = (18, 18, 22, 255)
    LEATHER_MID = (34, 36, 42, 255)
    LEATHER_HL = (56, 58, 66, 255)
    BOOT_SOLE = (10, 10, 12, 255)

    BADGE_GOLD = (224, 172, 42, 255)
    BADGE_HL = (252, 222, 110, 255)
    METAL_SILVER = (176, 186, 200, 255)
    METAL_HL = (232, 238, 248, 255)
    PATCH_WHITE = (228, 232, 240, 255)
    LIGHT_BEAM = (255, 246, 180, 255)


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


def paint_leon_face_64(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)
    # Jaw AO & hairline shadow
    for y in range(int(h * 0.80), h):
        d.line([(0, y), (w - 1, y)], fill=LeonPalette.SKIN_SHADOW)
    hh = int(h * 0.16)
    d.rectangle([0, 0, w - 1, hh], fill=LeonPalette.HAIR_MID)
    for y in range(hh + 1, hh + 5):
        d.line([(0, y), (w - 1, y)], fill=LeonPalette.SKIN_SHADOW)

    # Eyebrows
    by = int(h * 0.36)
    d.line([(int(w * 0.18), by + 1), (int(w * 0.38), by)], fill=LeonPalette.HAIR_DEEP)
    d.line([(int(w * 0.62), by), (int(w * 0.82), by + 1)], fill=LeonPalette.HAIR_DEEP)

    # Crisp stylized blue-grey eyes
    ey0, ey1 = int(h * 0.43), int(h * 0.52)
    for lx0, lx1 in [(int(w * 0.20), int(w * 0.38)), (int(w * 0.62), int(w * 0.80))]:
        d.rectangle([lx0, ey0, lx1, ey1], fill=LeonPalette.EYE_WHITE)
        cx = (lx0 + lx1) // 2
        cy = (ey0 + ey1) // 2
        d.rectangle([cx - 2, ey0, cx + 2, ey1], fill=LeonPalette.EYE_IRIS)
        d.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=LeonPalette.EYE_PUPIL)
        d.point((cx - 1, ey0 + 1), fill=(255, 255, 255, 255))
        d.line([(lx0, ey0), (lx1, ey0)], fill=LeonPalette.HAIR_DEEP)

    # Nose & determined mouth
    mid_x = w // 2
    d.line([(mid_x, int(h * 0.46)), (mid_x, int(h * 0.65))], fill=LeonPalette.SKIN_HL)
    d.rectangle([mid_x - 1, int(h * 0.66), mid_x + 1, int(h * 0.68)], fill=LeonPalette.SKIN_SHADOW)
    my = int(h * 0.80)
    d.line([(mid_x - 5, my), (mid_x + 5, my)], fill=LeonPalette.LIPS)
    d.line([(mid_x - 3, my + 1), (mid_x + 3, my + 1)], fill=LeonPalette.SKIN_DEEP)
    return img


def paint_dirty_blonde_hair(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.HAIR_MID)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.22:
            c = LeonPalette.HAIR_HL
        elif t < 0.55:
            c = LeonPalette.HAIR_LIGHT
        elif t > 0.84:
            c = LeonPalette.HAIR_DEEP
        else:
            c = LeonPalette.HAIR_MID
        d.line([(0, y), (w - 1, y)], fill=c)
    for x in range(0, w, 2):
        d.line([(x, 0), (x, h - 1)], fill=LeonPalette.HAIR_SHADE)
    return img


def paint_rpd_shirt_wrap(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.RPD_BLUE)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 5):
        d.line([(x, 0), (x, h - 1)], fill=LeonPalette.RPD_BLUE_HL)
    d.line([(0, 0), (w - 1, 0)], fill=LeonPalette.RPD_BLUE_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=LeonPalette.RPD_BLUE_DARK)
    return img


def paint_kevlar_vest(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.VEST_NAVY)
    d = ImageDraw.Draw(img)
    # MOLLE / kevlar grid stitching
    for y in range(0, h, 4):
        d.line([(0, y), (w - 1, y)], fill=LeonPalette.VEST_DARK)
    for x in range(0, w, 5):
        d.line([(x, 0), (x, h - 1)], fill=LeonPalette.VEST_HL)
    d.line([(0, 0), (w - 1, 0)], fill=LeonPalette.VEST_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=LeonPalette.VEST_DARK)
    return img


def paint_rpd_patch(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.RPD_BLUE_DARK)
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, w - 2, h - 2], outline=LeonPalette.PATCH_WHITE)
    if w >= 6 and h >= 6:
        d.rectangle([2, 2, w - 3, h - 3], fill=LeonPalette.RPD_BLUE)
        d.line([(w // 2, 2), (w // 2, h - 3)], fill=LeonPalette.BADGE_GOLD)
        d.line([(2, h // 2), (w - 3, h // 2)], fill=LeonPalette.PATCH_WHITE)
    return img


def paint_gold_badge(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.BADGE_GOLD)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=LeonPalette.BADGE_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=(136, 92, 16, 255))
    if w >= 5 and h >= 5:
        d.rectangle([1, 1, w - 2, h - 2], outline=LeonPalette.BADGE_HL)
    return img


def paint_metallic(w, h):
    img = Image.new("RGBA", (w, h), LeonPalette.METAL_SILVER)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=LeonPalette.METAL_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=(90, 96, 108, 255))
    return img


def build_leon_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED HEAD, EARS & 24+ DIRTY-BLONDE PARTED BANGS HAIR STRANDS
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_sculpted_mesh", ("head", "face"),
        origin=[0, 23.8, 0], y_bot=23.9, y_top=28.3, width=3.9, depth=3.9,
        face_painter=paint_leon_face_64,
        hair_painter=paint_dirty_blonde_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.SKIN_BASE),
    ))

    for side, sx in [("l", 1.96), ("r", -1.96)]:
        x0, x1 = (sx - 0.14, sx + 0.28) if side == "l" else (sx - 0.28, sx + 0.14)
        els.append(build_beveled_box_mesh(
            f"ear_{side}", ("head", "face"),
            x0, 25.3, -0.32, x1, 26.5, 0.42, bevel=0.09,
            origin=[sx, 25.9, 0.05],
            painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.SKIN_BASE),
        ))

    # 16-segment Hair Crown
    crown_rings = [
        make_ellipse_ring(0, 27.1, 0.08, 2.08, 2.18, n_pts=16),
        make_ellipse_ring(0, 28.1, 0.14, 2.14, 2.24, n_pts=16),
        make_ellipse_ring(0, 28.65, 0.22, 1.75, 1.92, n_pts=16),
        make_ellipse_ring(0, 28.95, 0.28, 1.05, 1.25, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "hair_crown_mesh", ("head", "hair"), crown_rings,
        origin=[0, 27.1, 0.1],
        side_painter=paint_dirty_blonde_hair,
        cap_top_painter=paint_dirty_blonde_hair,
        tex_scale=6,
    ))

    # 24+ Dirty-Blonde Parted Bangs & Layered Strands (Signature 90s/RE2R Curtained Bangs)
    leon_strands = [
        # Left-swept bangs (covering left forehead & brow, parted slightly off-center)
        ("bang_l1", (0.28, 0.35, -1.95), (-18, -12, 16), 0.72, 0.42, 2.35, (0.35, -0.15), 1.15, -0.14),
        ("bang_l2", (0.72, 0.32, -1.85), (-16, -20, 22), 0.68, 0.40, 2.45, (0.42, -0.12), 1.15, -0.12),
        ("bang_l3", (1.18, 0.22, -1.62), (-12, -30, 26), 0.65, 0.38, 2.50, (0.38, -0.05), 1.12, -0.10),
        ("bang_l4", (1.58, 0.08, -1.25), (-8, -40, 24), 0.60, 0.36, 2.40, (0.28, 0.05), 1.10, -0.08),
        ("bang_l5", (0.10, 0.48, -2.02), (-22, -6, 12), 0.56, 0.34, 2.05, (0.25, -0.18), 1.12, -0.12),
        # Right-swept longer curtain bangs (sweeping across right eye/temple)
        ("bang_r1", (-0.22, 0.38, -1.96), (-20, 10, -18), 0.76, 0.44, 2.55, (-0.40, -0.18), 1.18, -0.16),
        ("bang_r2", (-0.68, 0.32, -1.86), (-18, 22, -24), 0.72, 0.42, 2.65, (-0.45, -0.14), 1.16, -0.14),
        ("bang_r3", (-1.15, 0.20, -1.64), (-14, 32, -26), 0.66, 0.38, 2.60, (-0.38, -0.06), 1.12, -0.10),
        ("bang_r4", (-1.56, 0.06, -1.26), (-10, 42, -24), 0.60, 0.36, 2.45, (-0.28, 0.04), 1.10, -0.08),
        ("bang_r5", (-0.06, 0.52, -2.04), (-24, 4, -14), 0.54, 0.34, 2.15, (-0.25, -0.18), 1.12, -0.12),
        # Top Crown Parted Layers (4 strands)
        ("top_l1", (0.65, 0.72, -0.45), (-48, -18, 12), 0.85, 0.42, 2.4, (0.2, 0.1), 1.10, 0.08),
        ("top_r1", (-0.65, 0.72, -0.45), (-48, 18, -12), 0.85, 0.42, 2.4, (-0.2, 0.1), 1.10, 0.08),
        ("top_l2", (1.25, 0.55, -0.15), (-35, -28, 16), 0.75, 0.38, 2.3, (0.2, 0.15), 1.08, 0.06),
        ("top_r2", (-1.25, 0.55, -0.15), (-35, 28, -16), 0.75, 0.38, 2.3, (-0.2, 0.15), 1.08, 0.06),
        # Side & Temple Locks (4 strands)
        ("side_l1", (1.96, -0.15, -0.55), (12, 10, -8), 0.62, 0.85, 2.4, (0.08, 0.22), 1.08, 0.04),
        ("side_r1", (-1.96, -0.15, -0.55), (12, -10, 8), 0.62, 0.85, 2.4, (-0.08, 0.22), 1.08, 0.04),
        ("side_l2", (1.98, -0.32, 0.28), (18, 16, -6), 0.60, 0.82, 2.5, (0.06, 0.25), 1.08, 0.04),
        ("side_r2", (-1.98, -0.32, 0.28), (18, -16, 6), 0.60, 0.82, 2.5, (-0.06, 0.25), 1.08, 0.04),
        # Back & Nape Hair Layers (6 strands)
        ("back_c", (0.0, -0.10, 1.98), (38, 0, 0), 1.15, 0.58, 3.0, (0.0, 0.25), 1.12, 0.08),
        ("back_l1", (0.92, -0.18, 1.82), (34, 16, -6), 0.98, 0.54, 2.9, (0.14, 0.22), 1.10, 0.06),
        ("back_r1", (-0.92, -0.18, 1.82), (34, -16, 6), 0.98, 0.54, 2.9, (-0.14, 0.22), 1.10, 0.06),
        ("back_l2", (1.58, -0.32, 1.32), (28, 28, -8), 0.84, 0.50, 2.7, (0.16, 0.18), 1.08, 0.05),
        ("back_r2", (-1.58, -0.32, 1.32), (28, -28, 8), 0.84, 0.50, 2.7, (-0.16, 0.18), 1.08, 0.05),
        ("nape_c", (0.0, -1.45, 1.90), (22, 0, 0), 1.25, 0.48, 2.1, (0.0, 0.18), 1.05, 0.04),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair"),
        base_origin=[0, 28.1, 0.0],
        strand_specs=leon_strands,
        painter=paint_dirty_blonde_hair,
        n_sides=6, n_rings=4,
    ))

    # =======================================================================
    # 2. NECK, R.P.D. TACTICAL SHIRT & MULTI-PLATE KEVLAR VEST
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 22.6, 0.0, 1.12, 1.12, n_pts=14),
        make_ellipse_ring(0, 24.2, -0.05, 0.98, 1.02, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 23.0, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.SKIN_SHADOW),
        tex_scale=6,
    ))

    # R.P.D. Shirt Collar
    collar_rings = [
        make_ellipse_ring(0, 22.8, 0.0, 1.55, 1.45, n_pts=14),
        make_ellipse_ring(0, 23.6, 0.0, 1.48, 1.38, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "rpd_shirt_collar", ("torso", "collar"), collar_rings,
        origin=[0, 23.2, 0],
        side_painter=paint_rpd_shirt_wrap,
        tex_scale=5,
    ))

    # V-Tapered R.P.D. Blue Tactical Shirt Torso (16-segment)
    torso_rings = [
        make_ellipse_ring(0, 13.0, 0.0, 2.55, 1.55, n_pts=16),
        make_ellipse_ring(0, 16.5, 0.0, 2.85, 1.75, n_pts=16),
        make_ellipse_ring(0, 20.5, 0.0, 3.45, 1.95, n_pts=16),
        make_ellipse_ring(0, 23.2, 0.0, 4.10, 1.85, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "torso_rpd_shirt", ("torso", "chest"), torso_rings,
        origin=[0, 13.0, 0],
        side_painter=paint_rpd_shirt_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.RPD_BLUE),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.RPD_BLUE_DARK),
        tex_scale=5,
    ))

    # Heavy Multi-Plate R.P.D. Kevlar Vest (Front & Back Armor Plates + Shoulder Straps + Cummerbunds)
    els.append(build_armor_plate(
        "kevlar_vest_front", ("torso", "vest"),
        origin=[0, 19.2, -2.02], width=5.6, height=7.2, thickness=0.45,
        curve_z=0.55, bevel=0.14,
        painter=paint_kevlar_vest,
        trim_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.VEST_DARK),
        n_cols=6, n_rows=5,
    ))
    els.append(build_armor_plate(
        "kevlar_vest_back", ("torso", "vest"),
        origin=[0, 19.2, 2.02], width=5.5, height=7.2, thickness=0.45,
        curve_z=0.55, bevel=0.14, rotation=[0, 180, 0],
        painter=paint_kevlar_vest,
        trim_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.VEST_DARK),
        n_cols=6, n_rows=5,
    ))
    # Upper Chest Pectoral Plate + R.P.D. Gold Badge + R.P.D. Back Patch
    els.append(build_armor_plate(
        "kevlar_upper_plate", ("torso", "vest"),
        origin=[0, 21.6, -2.18], width=4.6, height=2.2, thickness=0.25,
        curve_z=0.32, bevel=0.08,
        painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.VEST_HL),
    ))
    els.append(build_beveled_box_mesh(
        "rpd_chest_badge", ("torso", "vest"),
        1.05, 21.1, -2.42, 1.85, 22.1, -2.18, bevel=0.06,
        origin=[1.45, 21.6, -2.30],
        painter=paint_gold_badge,
    ))
    els.append(build_beveled_box_mesh(
        "rpd_back_plate_patch", ("torso", "vest"),
        -1.95, 20.4, 2.18, 1.95, 22.0, 2.40, bevel=0.06,
        origin=[0, 21.2, 2.29],
        painter=paint_rpd_patch,
    ))
    for side, sign in [("l", 1), ("r", -1)]:
        # Vest Shoulder Straps + Buckles
        els.append(build_beveled_box_mesh(
            f"vest_shoulder_strap_{side}", ("torso", "vest"),
            sign * 2.1 - 0.65, 22.6, -1.85, sign * 2.1 + 0.65, 23.45, 1.85, bevel=0.08,
            origin=[sign * 2.1, 23.0, 0],
            painter=paint_kevlar_vest,
        ))
        els.extend(build_buckle_assembly(
            f"vest_strap_buckle_{side}", ("torso", "vest"),
            origin=[sign * 2.1, 22.8, -1.92], width=0.85, height=0.55, depth=0.20,
            frame_painter=paint_metallic,
        ))
        # Side Cummerbund Straps
        els.append(build_beveled_box_mesh(
            f"vest_side_cummerbund_{side}", ("torso", "vest"),
            sign * 2.85 - 0.35, 15.2, -1.45, sign * 2.85 + 0.35, 18.8, 1.45, bevel=0.10,
            origin=[sign * 2.85, 17.0, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.VEST_DARK),
        ))

    # 3 Chest Ammo/Utility Pouches on Kevlar Vest
    for p_idx, px in enumerate([-1.55, 0.0, 1.55]):
        els.append(build_pouch_mesh(
            f"vest_chest_pouch_{p_idx}", ("torso", "vest"),
            origin=[px, 17.3, -2.35], width=1.18, height=1.55, depth=0.68,
            body_painter=paint_kevlar_vest,
            flap_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.VEST_HL),
            buckle_painter=paint_metallic,
        ))

    # Shoulder Radio / Walkie-Talkie on Left Shoulder (+X) + Antenna + Shoulder Mic
    els.append(build_beveled_box_mesh(
        "shoulder_radio_body", ("torso", "vest"),
        1.65, 21.8, -2.55, 2.38, 23.1, -1.95, bevel=0.08,
        origin=[2.02, 22.45, -2.25],
        painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
    ))
    els.append(build_tapered_cylinder(
        "shoulder_radio_antenna", ("torso", "vest"),
        origin=[2.18, 23.85, -2.25], r_bottom=0.08, r_top=0.04, height=1.55,
        n_sides=8, n_rings=3, axis="y",
        side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_MID),
    ))
    els.append(build_beveled_box_mesh(
        "shoulder_radio_mic", ("torso", "vest"),
        1.68, 22.1, -2.65, 2.32, 22.8, -2.48, bevel=0.04,
        origin=[2.0, 22.45, -2.56],
        painter=paint_metallic,
    ))

    # Tactical Flashlight on Right Chest (-X)
    els.append(build_cylinder_mesh(
        "chest_flashlight_body", ("torso", "vest"),
        origin=[-2.05, 19.6, -2.32], radius=0.22, height=1.45, n_sides=12, axis="y",
        side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_MID),
    ))
    els.append(build_tapered_cylinder(
        "chest_flashlight_head", ("torso", "vest"),
        origin=[-2.05, 20.42, -2.32], r_bottom=0.22, r_top=0.30, height=0.38,
        n_sides=12, n_rings=2, axis="y",
        side_painter=paint_metallic,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LIGHT_BEAM),
    ))

    # Tactical Belt + 3D Buckle + Dual Handcuffs + 4 Belt Pouches (flush on waist)
    belt_rings = [
        make_ellipse_ring(0, 12.2, 0.0, 2.66, 1.66, n_pts=16),
        make_ellipse_ring(0, 13.4, 0.0, 2.66, 1.66, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "tactical_belt", ("torso", "belt"), belt_rings,
        origin=[0, 12.8, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        tex_scale=5,
    ))
    els.extend(build_buckle_assembly(
        "belt_buckle_silver", ("torso", "belt"),
        origin=[0, 12.8, -1.74], width=1.35, height=1.05, depth=0.28,
        frame_painter=paint_metallic,
    ))
    # Dual Handcuffs on Back-Left Belt (flush)
    for hc_idx, hx in enumerate([1.25, 1.80]):
        els.append(build_cylinder_mesh(
            f"belt_handcuff_ring_{hc_idx}", ("torso", "belt"),
            origin=[hx, 12.3, 1.72], radius=0.38, height=0.16, n_sides=12, axis="z",
            side_painter=paint_metallic,
        ))
    # 4 Belt Pouches (flush)
    for pname, porig, prot in [
        ("front_l", [2.18, 12.75, -1.06], [0, -32, 0]),
        ("front_r", [-2.18, 12.75, -1.06], [0, 32, 0]),
        ("back_r", [-1.32, 12.75, 1.72], [0, 165, 0]),
        ("hip_l", [2.62, 12.75, 0.45], [0, -82, 0]),
    ]:
        els.append(build_pouch_mesh(
            f"belt_pouch_{pname}", ("torso", "belt"),
            origin=porig, width=0.90, height=1.25, depth=0.60, rotation=prot,
            body_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_MID),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
            buckle_painter=paint_metallic,
        ))

    # =======================================================================
    # 3. R.P.D. ROLLED-SLEEVE ANATOMICAL ARMS, PATCHES, FOREARMS & GLOVES
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        shoulder_pos = [sign * 3.92, 22.4, 0.0]
        elbow_pos = [sign * 4.14, 17.5, 0.04]
        wrist_pos = [sign * 4.22, 13.3, -0.08]
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=shoulder_pos,
            elbow_pos=elbow_pos,
            wrist_pos=wrist_pos,
            radii={"shoulder": 1.18, "bicep": 1.02, "elbow": 0.82, "forearm": 0.88, "wrist": 0.68},
            sleeve_painter=paint_rpd_shirt_wrap,
            skin_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.SKIN_BASE),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        ))
        sx = shoulder_pos[0]
        # R.P.D. Shoulder Patch (seated flush on upper arm)
        els.append(build_beveled_box_mesh(
            f"rpd_arm_patch_{side}", (arm_grp, "shoulder"),
            sx + sign * 0.92, 20.6, -0.52, sx + sign * 1.14, 21.9, 0.52, bevel=0.05,
            origin=[sx + sign * 1.03, 21.25, 0],
            painter=paint_rpd_patch,
        ))
        # Elliptical Rolled Cuff Ring at Elbow
        ex, ey, ez = elbow_pos
        els.append(build_muscular_limb_mesh(
            f"rolled_cuff_{side}", (arm_grp, "arm"),
            origin=[ex, ey, ez],
            ring_specs=[
                (ex, ey - 0.26, ez, 0.88, 0.92),
                (ex, ey + 0.26, ez, 0.88, 0.92),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.RPD_BLUE_HL),
        ))
        if side == "left":
            wx, wy, wz = wrist_pos
            els.append(build_muscular_limb_mesh(
                "tactical_watch_l", (arm_grp, "forearm"),
                origin=[wx, wy + 0.45, wz],
                ring_specs=[
                    (wx, wy + 0.26, wz, 0.72, 0.76),
                    (wx, wy + 0.64, wz, 0.72, 0.76),
                ],
                n_sides=14,
                side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
            ))

    # =======================================================================
    # 4. CARGO PANTS, SIDE POCKETS, KNEE PADS, MATILDA HOLSTER & LACED BOOTS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.34
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 13.0, 0.0],
            knee_pos=[lx, 6.9, 0.0],
            ankle_pos=[lx, 1.5, 0.0],
            radii={"hip": 1.24, "thigh": 1.18, "knee": 0.96, "calf": 1.06, "ankle": 0.86},
            pants_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.PANTS_NAVY),
            boot_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
            knee_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.PANTS_NAVY),
        ))
        # Cargo Side Pockets (flush against thigh)
        els.append(build_pouch_mesh(
            f"cargo_pocket_{side}", (leg_grp, "thigh"),
            origin=[lx + sign * 1.02, 9.6, -0.04], width=0.55, height=2.15, depth=1.35,
            rotation=[0, -sign * 90, 0],
            body_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.PANTS_NAVY),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.PANTS_HL),
        ))
        # Curved Knee Pad + Flush Elliptical Strap
        els.append(build_armor_plate(
            f"knee_pad_{side}", (leg_grp, "knee"),
            origin=[lx, 6.95, -1.16], width=1.60, height=1.45, thickness=0.28,
            curve_z=0.35, bevel=0.12,
            painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_MID),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        ))
        els.append(build_muscular_limb_mesh(
            f"knee_strap_{side}", (leg_grp, "knee"),
            origin=[lx, 6.95, -0.12],
            ring_specs=[
                (lx, 6.74, -0.12, 1.04, 1.13),
                (lx, 7.16, -0.12, 1.04, 1.13),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        ))
        for l_idx, (ly, lz) in enumerate([(2.1, -0.82), (2.85, -0.86), (3.6, -0.90), (4.35, -0.94), (5.1, -0.94)]):
            els.append(build_cylinder_mesh(
                f"boot_lace_{side}_{l_idx}", (leg_grp, "boot"),
                origin=[lx, ly, lz], radius=0.065, height=0.88, n_sides=8, axis="x",
                side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_HL),
            ))
        els.append(build_beveled_box_mesh(
            f"boot_foot_{side}", (leg_grp, "foot"),
            lx - 0.90, 0.45, -2.28, lx + 0.90, 1.80, 1.02, bevel=0.16,
            origin=[lx, 1.15, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", (leg_grp, "foot"),
            lx - 0.96, 0.0, -2.38, lx + 0.96, 0.50, 1.08, bevel=0.08,
            origin=[lx, 0.25, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.BOOT_SOLE),
        ))

    # Thigh Holster with Matilda Pistol on Right Leg (-X) + Flush Elliptical Strap
    els.append(build_muscular_limb_mesh(
        "holster_strap_top", ("right_leg", "thigh"),
        origin=[-1.34, 11.2, -0.06],
        ring_specs=[
            (-1.34, 11.02, -0.06, 1.21, 1.26),
            (-1.34, 11.38, -0.06, 1.21, 1.26),
        ],
        n_sides=14,
        side_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
    ))
    els.append(build_pouch_mesh(
        "thigh_holster_r", ("right_leg", "thigh"),
        origin=[-2.44, 10.4, 0.05], width=0.65, height=2.55, depth=1.48,
        body_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_MID),
        flap_painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
        buckle_painter=paint_metallic,
    ))
    els.append(build_beveled_box_mesh(
        "matilda_pistol_grip", ("right_leg", "thigh"),
        -2.64, 11.6, -0.15, -2.24, 12.75, 0.68, bevel=0.07,
        origin=[-2.44, 12.15, 0.25], rotation=[22, 0, 0],
        painter=lambda w, h: paint_solid_shaded(w, h, LeonPalette.LEATHER_DARK),
    ))
    els.append(build_beveled_box_mesh(
        "matilda_pistol_slide", ("right_leg", "thigh"),
        -2.62, 11.4, -0.92, -2.26, 12.05, 0.52, bevel=0.06,
        origin=[-2.44, 11.72, -0.20], rotation=[85, 0, 0],
        painter=paint_metallic,
    ))

    return els


def main():
    print("[1/3] Building Ultra-High-Detail Leon S. Kennedy (target_height=28.5u)...")
    els = build_leon_elements()

    group_origins = {
        "head": [0, 23.8, 0],
        "torso": [0, 13.0, 0],
        "left_arm": [3.8, 22.4, 0],
        "left_arm/forearm": [4.15, 17.1, 0],
        "right_arm": [-3.8, 22.4, 0],
        "right_arm/forearm": [-4.15, 17.1, 0],
        "left_leg": [1.34, 12.9, 0],
        "right_leg": [-1.34, 12.9, 0],
    }

    scale = scale_elements_to_height(els, group_origins, target_height=28.5)
    print(f"      Elements: {len(els)} | Uniform scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas with AO & specular highlights...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=LeonPalette.VEST_NAVY, max_face_size=128)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    atlas.save(os.path.join(base_dir, "output", "leon_texture.png"), format="PNG")

    targets = [os.path.join(base_dir, "output", "leon.bbmodel")]
    print("[3/3] Exporting output/leon.bbmodel...")
    export_bbmodel(els, atlas, "leon_kennedy", targets, group_origins=group_origins)
    print("[DONE] Leon S. Kennedy generated successfully!")


if __name__ == "__main__":
    main()
