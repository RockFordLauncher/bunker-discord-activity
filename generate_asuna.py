#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Asuna Yuuki (Sword Art Online - Knights of the Blood Oath) Polygonal 3D Generator
1024x1024 atlas, 12-16 segment smooth meshes, 140+ elements, 4000+ faces,
long chestnut hair (22+ strands + signature braided side crown + waist-length back hair),
KoB white-and-red tunic, red cross emblem, high collar, shoulder capelet, pleated hollow skirt,
Lambent Light rapier scabbard on left hip, white thigh-high boots with gold trim,
white fingerless gauntlets with individual fingers, and exact target_height = 26.8.
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    Cuboid,
    build_lofted_mesh,
    make_ellipse_ring,
    build_sculpted_head_mesh,
    build_open_coat_arc_mesh,
    build_hair_strand_mesh,
    build_multi_strand_hair_layer,
    build_beveled_box_mesh,
    build_tapered_cylinder,
    build_cylinder_mesh,
    build_armor_plate,
    build_buckle_assembly,
    build_sculpted_bust_mesh,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    scale_elements_to_height,
    bake_elements_atlas,
    export_bbmodel,
)


class AsunaPalette:
    SKIN_BASE = (255, 237, 226, 255)
    SKIN_SHADOW = (236, 196, 178, 255)
    SKIN_DEEP = (212, 168, 150, 255)
    BLUSH = (252, 190, 198, 255)
    LIPS = (224, 118, 122, 255)

    EYE_WHITE = (252, 252, 255, 255)
    EYE_LASH = (28, 18, 16, 255)
    EYE_IRIS_TOP = (120, 62, 28, 255)
    EYE_IRIS_MID = (182, 102, 46, 255)
    EYE_IRIS_BOT = (226, 154, 84, 255)
    EYE_HL = (255, 255, 255, 255)

    HAIR_DARK = (118, 56, 28, 255)
    HAIR_BASE = (168, 86, 44, 255)
    HAIR_MID = (196, 110, 58, 255)
    HAIR_HL = (228, 146, 86, 255)

    TUNIC_WHITE = (248, 248, 252, 255)
    TUNIC_SHADOW = (214, 218, 230, 255)
    KOB_RED = (186, 28, 38, 255)
    KOB_RED_DARK = (128, 16, 24, 255)
    KOB_RED_HL = (224, 58, 68, 255)

    GOLD_BRIGHT = (248, 206, 86, 255)
    GOLD_BASE = (218, 168, 48, 255)
    GOLD_DARK = (156, 114, 24, 255)

    LEATHER_BROWN = (92, 44, 30, 255)
    RAPIER_SILVER = (230, 238, 246, 255)
    RAPIER_TEAL = (112, 214, 206, 255)
    BOOT_SOLE = (42, 34, 34, 255)


def paint_asuna_face_64(w, h):
    """Dedicated 64x64 front face texture: warm hazel-amber anime eyes, delicate lashes, gentle smile."""
    img = Image.new("RGBA", (w, h), AsunaPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    for y in range(int(h * 0.85), h):
        d.line([(0, y), (w - 1, y)], fill=AsunaPalette.SKIN_SHADOW)

    hair_h = int(h * 0.18)
    d.rectangle([0, 0, w - 1, hair_h], fill=AsunaPalette.HAIR_BASE)
    for y in range(hair_h + 1, hair_h + 5):
        f = (y - hair_h) / 5.0
        c = tuple(int(AsunaPalette.SKIN_DEEP[i] * (1 - f) + AsunaPalette.SKIN_BASE[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)

    eye_y0 = int(h * 0.43)
    eye_y1 = int(h * 0.59)
    eye_h = eye_y1 - eye_y0
    eye_w = int(w * 0.20)

    for cx in [int(w * 0.28), int(w * 0.72)]:
        ex0 = cx - eye_w // 2
        ex1 = cx + eye_w // 2
        d.rectangle([ex0 + 1, eye_y0 + 1, ex1 - 1, eye_y1 - 1], fill=AsunaPalette.EYE_WHITE)
        d.line([(ex0 + 1, eye_y0), (ex1 - 1, eye_y0)], fill=AsunaPalette.EYE_LASH)
        d.line([(ex0, eye_y0 + 1), (ex1, eye_y0 + 1)], fill=AsunaPalette.EYE_LASH)
        d.line([(ex0 + 2, eye_y1), (ex1 - 2, eye_y1)], fill=(128, 92, 86, 255))

        ix0, ix1 = ex0 + 2, ex1 - 2
        for gy in range(eye_y0 + 2, eye_y1):
            t = (gy - (eye_y0 + 2)) / max(1, eye_h - 3)
            ic = AsunaPalette.EYE_IRIS_TOP if t < 0.35 else (
                AsunaPalette.EYE_IRIS_MID if t < 0.72 else AsunaPalette.EYE_IRIS_BOT
            )
            d.line([(ix0, gy), (ix1, gy)], fill=ic)
        d.rectangle([cx - 2, eye_y0 + 3, cx + 2, eye_y0 + 6], fill=AsunaPalette.EYE_LASH)
        d.rectangle([ix0, eye_y0 + 2, ix0 + 1, eye_y0 + 3], fill=AsunaPalette.EYE_HL)
        d.point((ix1 - 1, eye_y1 - 2), fill=AsunaPalette.EYE_HL)

    brow_y = eye_y0 - 4
    for cx in [int(w * 0.28), int(w * 0.72)]:
        d.line([(cx - 4, brow_y + 1), (cx + 4, brow_y)], fill=AsunaPalette.HAIR_DARK)

    blush_y = eye_y1 + 2
    for cx in [int(w * 0.25), int(w * 0.75)]:
        d.rectangle([cx - 3, blush_y, cx + 3, blush_y + 1], fill=AsunaPalette.BLUSH)

    mid_x = w // 2
    d.point((mid_x, int(h * 0.68)), fill=AsunaPalette.SKIN_SHADOW)
    mouth_y = int(h * 0.80)
    d.line([(mid_x - 2, mouth_y), (mid_x + 2, mouth_y)], fill=AsunaPalette.LIPS)
    return img


def paint_chestnut_hair(w, h):
    """Smooth chestnut-orange anime hair gradient with specular shine."""
    img = Image.new("RGBA", (w, h), AsunaPalette.HAIR_BASE)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.28:
            f = t / 0.28
            c0, c1 = AsunaPalette.HAIR_BASE, AsunaPalette.HAIR_HL
        else:
            f = (t - 0.28) / 0.72
            c0, c1 = AsunaPalette.HAIR_HL, AsunaPalette.HAIR_DARK
        c = tuple(int(c0[i] * (1 - f) + c1[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)
    return img


def paint_kob_tunic_wrap(w, h):
    """Knights of the Blood Oath white-and-red tunic with crimson side panels, gold trim & front cross."""
    img = Image.new("RGBA", (w, h), AsunaPalette.TUNIC_WHITE)
    d = ImageDraw.Draw(img)
    # Red side panels
    for x in range(w):
        u = x / max(1, w - 1)
        if 0.0 <= u < 0.08 or 0.42 < u < 0.58 or 0.92 < u <= 1.0:
            d.line([(x, 0), (x, h - 1)], fill=AsunaPalette.KOB_RED)

    # Front center red cross emblem
    mid_x = int(w * 0.25)
    cy = int(h * 0.42)
    d.rectangle([mid_x - 1, cy - 5, mid_x + 1, cy + 5], fill=AsunaPalette.KOB_RED)
    d.rectangle([mid_x - 4, cy - 2, mid_x + 4, cy + 1], fill=AsunaPalette.KOB_RED)
    # Gold hem & AO
    d.line([(0, 0), (w - 1, 0)], fill=AsunaPalette.TUNIC_SHADOW)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=AsunaPalette.GOLD_BASE)
    return img


def paint_kob_skirt_wrap(w, h):
    """Pleated red-and-white Knights of the Blood Oath skirt with gold bottom trim."""
    img = Image.new("RGBA", (w, h), AsunaPalette.TUNIC_WHITE)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if (x // 4) % 2 == 0:
            d.line([(x, 0), (x, h - 1)], fill=AsunaPalette.KOB_RED)
        else:
            d.line([(x, 0), (x, h - 1)], fill=AsunaPalette.TUNIC_WHITE)
        if x % 4 == 0:
            d.line([(x, 0), (x, h - 1)], fill=AsunaPalette.KOB_RED_DARK)
    d.line([(0, 0), (w - 1, 0)], fill=AsunaPalette.KOB_RED_DARK)
    d.line([(0, h - 2), (w - 1, h - 2)], fill=AsunaPalette.GOLD_BASE)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=AsunaPalette.GOLD_BRIGHT)
    return img


def paint_solid_shaded(w, h, color, metallic=False):
    img = Image.new("RGBA", (w, h), color)
    d = ImageDraw.Draw(img)
    hl_amt = 32 if metallic else 18
    sh_amt = 26 if metallic else 20
    hl = (min(255, color[0] + hl_amt), min(255, color[1] + hl_amt), min(255, color[2] + hl_amt), color[3])
    sh = (max(0, color[0] - sh_amt), max(0, color[1] - sh_amt), max(0, color[2] - sh_amt), color[3])
    d.line([(0, 0), (w - 1, 0)], fill=hl)
    if metallic and h >= 4:
        d.line([(0, h // 3), (w - 1, h // 3)], fill=hl)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=sh)
    return img


def build_asuna_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED ANIME HEAD + 22+ LONG CHESTNUT HAIR + BRAIDED SIDE CROWN
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_anime_mesh", ("head", "face"),
        origin=[0, 20.6, 0], y_bot=20.6, y_top=24.9, width=4.0, depth=3.9,
        face_painter=paint_asuna_face_64,
        hair_painter=paint_chestnut_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.SKIN_BASE),
    ))

    # 12-Segment Hair Crown Cap (zero bald spots)
    crown_rings = [
        make_ellipse_ring(0, 23.5, 0.04, 2.18, 2.12, n_pts=12),
        make_ellipse_ring(0, 24.3, 0.05, 2.20, 2.14, n_pts=12),
        make_ellipse_ring(0, 24.9, 0.07, 2.04, 2.02, n_pts=12),
        make_ellipse_ring(0, 25.3, 0.08, 1.58, 1.62, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "hair_crown_cap", ("head", "hair"), crown_rings,
        origin=[0, 24.2, 0.05],
        side_painter=paint_chestnut_hair,
        cap_top_painter=paint_chestnut_hair,
        tex_scale=6,
    ))

    # 12-Segment Long Flowing Back Hair Mantle (down to waist Y=12.5)
    back_hair_rings = [
        make_ellipse_ring(0, 12.6, 1.85, 2.55, 0.72, n_pts=12),
        make_ellipse_ring(0, 16.2, 1.65, 2.48, 0.85, n_pts=12),
        make_ellipse_ring(0, 19.8, 1.35, 2.35, 1.05, n_pts=12),
        make_ellipse_ring(0, 23.2, 0.75, 2.18, 1.45, n_pts=12),
    ]
    back_hair_rings = [[(x, y, max(0.0, z)) for (x, y, z) in r] for r in back_hair_rings]
    els.append(build_lofted_mesh(
        "hair_long_back_mantle", ("head", "hair"), back_hair_rings,
        origin=[0, 20.6, 1.2],
        side_painter=paint_chestnut_hair,
        cap_top_painter=paint_chestnut_hair,
        tex_scale=5,
    ))

    # 22+ 3D Hair Strands (parted bangs, cheek locks, waist-length flowing back strands)
    hair_strands = [
        # Parted Forehead Bangs
        ("bang_c_l", (-0.38, 24.92, -2.10), [-4, 4, -12], 0.88, 0.34, 2.05, (-0.18, -0.05), 1.1),
        ("bang_c_r", (0.38, 24.92, -2.10), [-4, -4, 12], 0.88, 0.34, 2.05, (0.18, -0.05), 1.1),
        ("bang_m_l", (-1.05, 24.78, -1.94), [-3, 12, -10], 0.82, 0.36, 2.35, (-0.14, 0.0), 1.1),
        ("bang_m_r", (1.05, 24.78, -1.94), [-3, -12, 10], 0.82, 0.36, 2.35, (0.14, 0.0), 1.1),
        ("bang_o_l", (-1.65, 24.45, -1.55), [-2, 22, -8], 0.75, 0.44, 2.85, (-0.10, 0.0), 1.1),
        ("bang_o_r", (1.65, 24.45, -1.55), [-2, -22, 8], 0.75, 0.44, 2.85, (0.10, 0.0), 1.1),
        # Long Front-Shoulder Framing Locks
        ("sidelock_l", (1.92, 23.9, -0.75), [2, 0, 5], 0.68, 0.65, 6.2, (-0.15, 0.05), 1.1),
        ("sidelock_r", (-1.92, 23.9, -0.75), [2, 0, -5], 0.68, 0.65, 6.2, (0.15, 0.05), 1.1),
        ("cheek_l", (1.80, 23.8, -1.15), [2, -10, 4], 0.52, 0.45, 4.4, (-0.12, 0.0), 1.1),
        ("cheek_r", (-1.80, 23.8, -1.15), [2, 10, -4], 0.52, 0.45, 4.4, (0.12, 0.0), 1.1),
        # Long Flowing Back Strands (reaching waist & hips!)
        ("long_back_c", (0.0, 23.8, 2.15), [8, 0, 0], 1.35, 0.55, 11.8, (0.0, 0.45), 1.1),
        ("long_back_l1", (0.95, 23.7, 2.02), [8, -8, 4], 1.15, 0.52, 11.4, (0.15, 0.40), 1.1),
        ("long_back_r1", (-0.95, 23.7, 2.02), [8, 8, -4], 1.15, 0.52, 11.4, (-0.15, 0.40), 1.1),
        ("long_back_l2", (1.75, 23.4, 1.55), [7, -16, 7], 1.05, 0.50, 10.6, (0.28, 0.35), 1.1),
        ("long_back_r2", (-1.75, 23.4, 1.55), [7, 16, -7], 1.05, 0.50, 10.6, (-0.28, 0.35), 1.1),
        ("long_tip_l", (0.55, 16.8, 2.25), [10, -4, 3], 0.85, 0.40, 5.2, (0.12, 0.30), 1.05),
        ("long_tip_r", (-0.55, 16.8, 2.25), [10, 4, -3], 0.85, 0.40, 5.2, (-0.12, 0.30), 1.05),
        ("long_tip_c", (0.0, 16.5, 2.32), [11, 0, 0], 0.92, 0.42, 5.6, (0.0, 0.35), 1.05),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair"), [0.0, 0.0, 0.0], hair_strands,
        painter=paint_chestnut_hair, n_sides=6, n_rings=4,
    ))

    # Signature Asuna Braided Side Crown (6 sculpted braid links + 2 red hair ties)
    braid_pts = [
        (-2.05, 23.35, 0.35, 12), (-1.45, 23.65, 1.45, 10), (-0.50, 23.85, 2.10, 4),
        (0.50, 23.85, 2.10, -4), (1.45, 23.65, 1.45, -10), (2.05, 23.35, 0.35, -12),
    ]
    for b_idx, (bx, by, bz, rz) in enumerate(braid_pts):
        els.append(build_beveled_box_mesh(
            f"braid_link_{b_idx}", ("head", "hair"),
            bx - 0.38, by - 0.24, bz - 0.24, bx + 0.38, by + 0.24, bz + 0.24, bevel=0.10,
            origin=[bx, by, bz], rotation=[0, b_idx * 12, rz],
            painter=paint_chestnut_hair,
        ))
    for side, sx in [("l", 2.08), ("r", -2.08)]:
        els.append(build_cylinder_mesh(
            f"braid_tie_{side}", ("head", "hair"),
            origin=[sx, 23.15, 0.25], radius=0.26, height=0.22, n_sides=12, axis="y",
            side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
        ))

    # =======================================================================
    # 2. NECK, HIGH COLLAR, SHOULDER CAPELET & KOB WHITE/RED TUNIC
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 19.6, 0.0, 0.82, 0.82, n_pts=12),
        make_ellipse_ring(0, 20.8, 0.0, 0.74, 0.76, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 19.8, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.SKIN_BASE),
        tex_scale=6,
    ))

    # High KoB White & Red Collar
    collar_levels = [
        (19.5, 1.80, 1.45, 0.12, 1.0),
        (20.9, 2.02, 1.60, 0.18, 1.1),
    ]
    els.append(build_open_coat_arc_mesh(
        "kob_high_collar", ("torso", "collar"),
        origin=[0, 19.8, 0.15],
        levels=collar_levels,
        outer_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        inner_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
        thickness=0.12,
        open_half_deg=42.0,
        n_arc=13,
    ))

    # KoB Shoulder Capelet (open-front flared capelet over upper shoulders & collarbone)
    capelet_levels = [
        (18.2, 3.55, 2.05, 0.08, 1.02),
        (19.7, 3.15, 1.75, 0.05, 0.95),
    ]
    els.append(build_open_coat_arc_mesh(
        "kob_shoulder_capelet", ("torso", "chest"),
        origin=[0, 19.4, 0.0],
        levels=capelet_levels,
        outer_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        inner_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
        thickness=0.12,
        open_half_deg=42.0,
        n_arc=15,
    ))
    # Gold Front Clasp on Capelet + 4 Gold Tunic Clasps
    els.append(build_beveled_box_mesh(
        "capelet_gold_clasp", ("torso", "chest"),
        -0.55, 18.85, -1.88, 0.55, 19.45, -1.50, bevel=0.08,
        origin=[0, 19.15, -1.70],
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
    ))
    for c_idx, (cx, cy) in enumerate([(-0.42, 15.0), (0.42, 15.0), (-0.42, 13.6), (0.42, 13.6)]):
        els.append(build_cylinder_mesh(
            f"tunic_gold_clasp_{c_idx}", ("torso", "chest"),
            origin=[cx, cy, -1.52], radius=0.14, height=0.16, n_sides=12, axis="z",
            side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
        ))

    # 12-Segment KoB Tunic Torso
    tunic_rings = [
        make_ellipse_ring(0, 12.2, 0.0, 1.92, 1.32, n_pts=12),
        make_ellipse_ring(0, 14.2, 0.0, 2.15, 1.46, n_pts=12),
        make_ellipse_ring(0, 16.2, -0.08, 2.45, 1.68, n_pts=12),
        make_ellipse_ring(0, 18.2, -0.08, 2.88, 1.62, n_pts=12),
        make_ellipse_ring(0, 19.7, 0.0, 3.25, 1.48, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "kob_tunic_torso", ("torso", "chest"), tunic_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_kob_tunic_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED_DARK),
        tex_scale=6,
    ))

    # Smooth Sculpted Bust positioned at proper upper-chest height (right below collarbone/yoke)
    els.append(build_sculpted_bust_mesh(
        "asuna_sculpted_bust", ("torso", "chest"),
        origin=[0.0, 17.65, -1.30],
        chest_y_bot=16.55,
        chest_y_top=18.85,
        bust_z_front=-2.38,
        width=3.92,
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        cleavage_depth=0.18,
    ))
    # 3D Red Cross Chest Emblem flush on upper-chest front
    els.append(build_beveled_box_mesh(
        "kob_cross_v", ("torso", "chest"),
        -0.16, 16.95, -2.30, 0.16, 18.55, -2.02, bevel=0.04,
        origin=[0, 17.75, -2.16],
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
    ))
    els.append(build_beveled_box_mesh(
        "kob_cross_h", ("torso", "chest"),
        -0.68, 17.65, -2.32, 0.68, 17.98, -2.02, bevel=0.04,
        origin=[0, 17.81, -2.17],
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
    ))

    # Waist Belt + Gold Buckle + KoB Front Waist Tabard
    belt_rings = [
        make_ellipse_ring(0, 11.7, 0.0, 2.02, 1.42, n_pts=12),
        make_ellipse_ring(0, 12.5, 0.0, 2.02, 1.42, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "waist_belt", ("torso", "belt"), belt_rings,
        origin=[0, 12.1, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.LEATHER_BROWN),
        tex_scale=5,
    ))
    els.extend(build_buckle_assembly(
        "belt_gold_buckle", ("torso", "belt"),
        origin=[0, 12.1, -1.50], width=0.92, height=0.72, depth=0.22,
        frame_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
    ))

    # =======================================================================
    # 3. 16-SEGMENT PLEATED RED/WHITE SKIRT (HOLLOW BOTTOM) + LAMBENT LIGHT
    # =======================================================================
    skirt_rings = [
        make_ellipse_ring(0, 7.6, 0.0, 4.10, 3.35, n_pts=16),
        make_ellipse_ring(0, 9.2, 0.0, 3.45, 2.75, n_pts=16),
        make_ellipse_ring(0, 10.8, 0.0, 2.65, 2.05, n_pts=16),
        make_ellipse_ring(0, 12.3, 0.0, 2.00, 1.40, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "kob_pleated_skirt", ("torso", "skirt"), skirt_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_kob_skirt_wrap,
        cap_bot_painter=None,
        tex_scale=5,
    ))
    # White Inner Petticoat
    petticoat_rings = [
        make_ellipse_ring(0, 7.1, 0.0, 3.85, 3.15, n_pts=16),
        make_ellipse_ring(0, 8.0, 0.0, 3.70, 3.00, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "skirt_petticoat", ("torso", "skirt"), petticoat_rings,
        origin=[0, 12.2, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        cap_bot_painter=None,
        tex_scale=5,
    ))

    # --- LAMBENT LIGHT RAPIER SCABBARD ON LEFT HIP (+X), 100% OUTSIDE SKIRT ---
    # Guard/mount at [3.05, 11.75, -0.20]; rot [-18, 0, 25] flares outward (+X) & back (+Z)
    # faster than the skirt (rx=4.10 at y=7.6) so scabbard, guard & hilt never clip skirt/torso.
    rap_rot = [-18, 0, 25]
    gx, gy, gz = 3.05, 11.75, -0.20
    dx_dn, dy_dn, dz_dn = 0.4226, -0.8619, 0.2801
    els.append(build_beveled_box_mesh(
        "rapier_hip_strap", ("torso", "rapier"),
        1.85, 11.65, -0.35, 3.08, 12.15, -0.05, bevel=0.05,
        origin=[2.45, 11.90, -0.20],
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.LEATHER_BROWN),
    ))
    els.append(build_tapered_cylinder(
        "lambent_light_scabbard", ("torso", "rapier"),
        origin=[gx + 5.1 * dx_dn, gy + 5.1 * dy_dn, gz + 5.1 * dz_dn],
        r_bottom=0.14, r_top=0.28, height=10.2,
        n_sides=12, n_rings=4, axis="y", rotation=rap_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
    ))
    els.append(build_tapered_cylinder(
        "lambent_light_chape", ("torso", "rapier"),
        origin=[gx + 10.6 * dx_dn, gy + 10.6 * dy_dn, gz + 10.6 * dz_dn],
        r_bottom=0.06, r_top=0.16, height=1.2,
        n_sides=12, n_rings=2, axis="y", rotation=rap_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.RAPIER_TEAL, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "lambent_light_guard", ("torso", "rapier"),
        gx - 0.40, gy - 0.32, gz - 0.48, gx + 0.40, gy + 0.32, gz + 0.48, bevel=0.12,
        origin=[gx, gy, gz], rotation=rap_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.RAPIER_SILVER, metallic=True),
    ))
    els.append(build_tapered_cylinder(
        "lambent_light_hilt", ("torso", "rapier"),
        origin=[gx - 1.05 * dx_dn, gy - 1.05 * dy_dn, gz - 1.05 * dz_dn],
        r_bottom=0.16, r_top=0.18, height=2.0,
        n_sides=12, n_rings=2, axis="y", rotation=rap_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.RAPIER_TEAL),
    ))
    els.append(build_cylinder_mesh(
        "lambent_light_pommel", ("torso", "rapier"),
        origin=[gx - 2.10 * dx_dn, gy - 2.10 * dy_dn, gz - 2.10 * dz_dn],
        radius=0.24, height=0.35, n_sides=12, axis="y", rotation=rap_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
    ))

    # =======================================================================
    # 4. ANATOMICAL ARMS, GAUNTLETS & ARTICULATED HANDS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        sx = sign * 3.15
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=[sx, 19.1, 0.0],
            elbow_pos=[sx + sign * 0.25, 14.9, 0.0],
            wrist_pos=[sx + sign * 0.30, 11.2, -0.08],
            radii={"shoulder": 0.78, "bicep": 0.64, "elbow": 0.54, "forearm": 0.60, "wrist": 0.46},
            sleeve_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
            skin_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.SKIN_BASE),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        ))
        # White Gauntlet Forearm Armor Shell + Gold Top Trim Cuff flush over forearm
        gx_arm = sx + sign * 0.28
        gaunt_rings = [
            make_ellipse_ring(gx_arm + sign * 0.02, 11.3, -0.08, 0.52, 0.56, n_pts=12),
            make_ellipse_ring(gx_arm, 13.0, -0.04, 0.62, 0.66, n_pts=12),
            make_ellipse_ring(gx_arm - sign * 0.02, 14.8, 0.0, 0.64, 0.68, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"gauntlet_{side}", (arm_grp, "forearm"), gaunt_rings,
            origin=[gx_arm, 14.8, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
            tex_scale=5,
        ))
        els.append(build_beveled_box_mesh(
            f"gauntlet_gold_trim_{side}", (arm_grp, "forearm"),
            gx_arm - 0.68, 14.4, -0.72, gx_arm + 0.68, 14.95, 0.72, bevel=0.06,
            origin=[gx_arm, 14.68, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
        ))

    # =======================================================================
    # 5. ANATOMICAL LEGS & WHITE THIGH-HIGH BOOTS WITH GOLD TRIM
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.15
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 12.2, 0.0],
            knee_pos=[lx, 6.0, 0.0],
            ankle_pos=[lx, 1.35, 0.0],
            radii={"hip": 0.96, "thigh": 0.90, "knee": 0.72, "calf": 0.78, "ankle": 0.56},
            pants_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.SKIN_BASE),
            boot_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
            knee_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        ))
        # White Thigh-High Boot Shaft + Gold Top Cuff + Knee Guard flush over leg
        boot_upper_rings = [
            make_ellipse_ring(lx, 5.8, 0.0, 0.76, 0.80, n_pts=12),
            make_ellipse_ring(lx, 8.8, 0.0, 0.88, 0.92, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"boot_thigh_{side}", (leg_grp, "thigh"), boot_upper_rings,
            origin=[lx, 8.6, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
            tex_scale=5,
        ))
        els.append(build_beveled_box_mesh(
            f"boot_gold_cuff_{side}", (leg_grp, "thigh"),
            lx - 0.92, 8.35, -0.96, lx + 0.92, 8.95, 0.96, bevel=0.08,
            origin=[lx, 8.65, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BRIGHT, metallic=True),
        ))
        els.append(build_armor_plate(
            f"boot_knee_plate_{side}", (leg_grp, "knee"),
            origin=[lx, 6.1, -0.82], width=1.30, height=1.10, thickness=0.20, curve_z=0.30, bevel=0.10,
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.GOLD_BASE, metallic=True),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_foot_{side}", (leg_grp, "foot"),
            lx - 0.74, 0.35, -1.92, lx + 0.74, 1.45, 0.85, bevel=0.14,
            origin=[lx, 0.90, -0.45],
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.TUNIC_WHITE),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_toe_red_{side}", (leg_grp, "foot"),
            lx - 0.68, 0.40, -1.96, lx + 0.68, 0.95, -1.25, bevel=0.10,
            origin=[lx, 0.68, -1.60],
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.KOB_RED),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", (leg_grp, "foot"),
            lx - 0.78, 0.0, -1.98, lx + 0.78, 0.38, 0.92, bevel=0.06,
            origin=[lx, 0.19, -0.45],
            painter=lambda w, h: paint_solid_shaded(w, h, AsunaPalette.BOOT_SOLE),
        ))

    return els


def main():
    print("[1/3] Building high-detail polygonal Asuna (target_height=26.8)...")
    els = build_asuna_elements()

    group_origins = {
        "head": [0, 20.6, 0],
        "torso": [0, 12.2, 0],
        "left_arm": [3.1, 19.2, 0],
        "left_arm/forearm": [3.45, 14.8, 0],
        "right_arm": [-3.1, 19.2, 0],
        "right_arm/forearm": [-3.45, 14.8, 0],
        "left_leg": [1.15, 12.2, 0],
        "right_leg": [-1.15, 12.2, 0],
    }

    scale = scale_elements_to_height(els, group_origins, 26.8)
    print(f"      Elements: {len(els)}, Uniform Scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=AsunaPalette.TUNIC_WHITE)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(base_dir, "output"), exist_ok=True)
    atlas.save(os.path.join(base_dir, "output", "asuna_texture.png"), format="PNG")

    targets = [
        os.path.join(base_dir, "output", "asuna.bbmodel"),
    ]

    print("[3/3] Exporting output/asuna.bbmodel...")
    export_bbmodel(els, atlas, "asuna", targets, group_origins=group_origins)
    print("[DONE] Asuna generated!")


if __name__ == "__main__":
    main()
