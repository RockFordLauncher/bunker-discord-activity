#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Kirito (Sword Art Online - The Black Swordsman) Polygonal 3D Generator
Upgraded to 1024x1024 atlas, 12-16 segment smooth meshes, 140+ elements, 4000+ faces,
AO shading, specular highlights, 26+ spiky 3D hair strands, dual detailed swords behind back,
3D diagonal harness + 3-rivet clasp, fingerless gloves with individual fingers, and exact 27.5u height.
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
    build_pouch_mesh,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    build_muscular_limb_mesh,
    scale_elements_to_height,
    bake_elements_atlas,
    export_bbmodel,
)


class KiritoPalette:
    SKIN_BASE = (255, 233, 219, 255)
    SKIN_SHADOW = (228, 188, 170, 255)
    SKIN_DEEP = (204, 160, 144, 255)
    LIPS = (196, 142, 134, 255)
    EYE_WHITE = (250, 252, 255, 255)
    EYE_DARK = (16, 18, 26, 255)
    EYE_IRIS_TOP = (30, 36, 54, 255)
    EYE_IRIS_MID = (52, 62, 88, 255)
    EYE_IRIS_BOT = (84, 98, 132, 255)
    EYE_HL = (255, 255, 255, 255)

    HAIR_DARK = (14, 15, 22, 255)
    HAIR_BASE = (24, 26, 36, 255)
    HAIR_MID = (34, 38, 52, 255)
    HAIR_HL = (52, 58, 78, 255)

    COAT_BLACK = (18, 19, 25, 255)
    COAT_DARK = (10, 11, 14, 255)
    COAT_MID = (28, 31, 40, 255)
    COAT_HL = (48, 54, 68, 255)

    SILVER_WHITE = (238, 242, 250, 255)
    SILVER_BASE = (188, 198, 214, 255)
    SILVER_DARK = (86, 94, 110, 255)

    SHIRT_DARK = (24, 25, 30, 255)
    PANTS_BLACK = (19, 20, 25, 255)
    BELT_LEATHER = (15, 16, 20, 255)
    LEATHER_HL = (36, 38, 46, 255)
    BOOT_SOLE = (8, 8, 10, 255)

    ELUCIDATOR_BLACK = (14, 15, 19, 255)
    ELUCIDATOR_EDGE = (232, 240, 250, 255)
    ELUCIDATOR_GUARD = (184, 194, 210, 255)

    REPULSER_CRYSTAL = (78, 182, 162, 255)
    REPULSER_LIGHT = (156, 238, 222, 255)
    REPULSER_CORE = (44, 128, 110, 255)
    REPULSER_GUARD = (196, 228, 222, 255)


def paint_kirito_face_64(w, h):
    """Dedicated 64x64 front face texture: sharp dark anime eyes, brows, AO hairline, stern expression."""
    img = Image.new("RGBA", (w, h), KiritoPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    # Subtle cheek/chin AO gradient
    for y in range(int(h * 0.84), h):
        d.line([(0, y), (w - 1, y)], fill=KiritoPalette.SKIN_SHADOW)

    # Hairline top cover + soft AO shadow
    hair_h = int(h * 0.18)
    d.rectangle([0, 0, w - 1, hair_h], fill=KiritoPalette.HAIR_BASE)
    for y in range(hair_h + 1, hair_h + 5):
        f = (y - hair_h) / 5.0
        c = tuple(int(KiritoPalette.SKIN_DEEP[i] * (1 - f) + KiritoPalette.SKIN_BASE[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)

    eye_y0 = int(h * 0.43)
    eye_y1 = int(h * 0.58)
    eye_h = eye_y1 - eye_y0
    eye_w = int(w * 0.20)

    for cx in [int(w * 0.28), int(w * 0.72)]:
        ex0 = cx - eye_w // 2
        ex1 = cx + eye_w // 2
        # Sclera + subtle upper eyelid shadow
        d.rectangle([ex0, eye_y0 + 1, ex1, eye_y1], fill=KiritoPalette.EYE_WHITE)
        d.line([(ex0, eye_y0 + 2), (ex1, eye_y0 + 2)], fill=(216, 222, 234, 255))
        # Sharp upper lash
        d.rectangle([ex0 - 1, eye_y0, ex1 + 1, eye_y0 + 1], fill=KiritoPalette.EYE_DARK)
        # Subtle lower lash
        d.line([(ex0 + 2, eye_y1), (ex1 - 2, eye_y1)], fill=(96, 102, 120, 255))

        # Multi-tone dark slate iris
        ix0, ix1 = ex0 + 2, ex1 - 2
        for gy in range(eye_y0 + 2, eye_y1):
            t = (gy - (eye_y0 + 2)) / max(1, eye_h - 3)
            ic = KiritoPalette.EYE_IRIS_TOP if t < 0.35 else (
                KiritoPalette.EYE_IRIS_MID if t < 0.72 else KiritoPalette.EYE_IRIS_BOT
            )
            d.line([(ix0, gy), (ix1, gy)], fill=ic)
        # Pupil
        d.rectangle([cx - 2, eye_y0 + 3, cx + 2, eye_y1 - 3], fill=KiritoPalette.EYE_DARK)
        # Specular catchlights
        d.rectangle([ix0, eye_y0 + 2, ix0 + 1, eye_y0 + 3], fill=KiritoPalette.EYE_HL)
        d.point((ix1 - 1, eye_y1 - 2), fill=KiritoPalette.EYE_HL)

    brow_y = eye_y0 - 4
    d.line([(int(w * 0.17), brow_y), (int(w * 0.37), brow_y + 1)], fill=KiritoPalette.HAIR_DARK)
    d.line([(int(w * 0.63), brow_y + 1), (int(w * 0.83), brow_y)], fill=KiritoPalette.HAIR_DARK)

    mid_x = w // 2
    d.point((mid_x, int(h * 0.68)), fill=KiritoPalette.SKIN_SHADOW)
    d.point((mid_x + 1, int(h * 0.69)), fill=KiritoPalette.SKIN_SHADOW)
    mouth_y = int(h * 0.80)
    d.line([(mid_x - 3, mouth_y), (mid_x + 3, mouth_y)], fill=KiritoPalette.LIPS)
    return img


def paint_raven_hair(w, h):
    """Smooth continuous raven-black anime hair gradient with subtle strand highlights."""
    img = Image.new("RGBA", (w, h), KiritoPalette.HAIR_BASE)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.32:
            f = t / 0.32
            c0, c1 = KiritoPalette.HAIR_DARK, KiritoPalette.HAIR_HL
        else:
            f = (t - 0.32) / 0.68
            c0, c1 = KiritoPalette.HAIR_HL, KiritoPalette.HAIR_DARK
        c = tuple(int(c0[i] * (1 - f) + c1[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)
    return img


def paint_kirito_chest_wrap(w, h):
    """Coat of Midnight torso with V-neck inner shirt, silver piping, stitched seams & AO."""
    img = Image.new("RGBA", (w, h), KiritoPalette.COAT_BLACK)
    d = ImageDraw.Draw(img)
    # Subtle vertical fabric shading & seams
    for x in range(w):
        if x % 8 == 0:
            d.line([(x, 0), (x, h - 1)], fill=KiritoPalette.COAT_MID)
        elif x % 8 == 4:
            d.line([(x, 0), (x, h - 1)], fill=KiritoPalette.COAT_DARK)

    mid_x = int(w * 0.25)
    v_bot = int(h * 0.44)
    for y in range(v_bot):
        span = int((1.0 - y / max(1, v_bot)) * (w * 0.085))
        d.line([(mid_x - span, y), (mid_x + span, y)], fill=KiritoPalette.SHIRT_DARK)
        if y < int(h * 0.16) and span > 1:
            d.line([(mid_x - span + 1, y), (mid_x + span - 1, y)], fill=KiritoPalette.SKIN_SHADOW)

    trim_off = max(2, int(w * 0.085))
    d.line([(mid_x - trim_off, 0), (mid_x - trim_off, h - 1)], fill=KiritoPalette.SILVER_WHITE)
    d.line([(mid_x + trim_off, 0), (mid_x + trim_off, h - 1)], fill=KiritoPalette.SILVER_WHITE)
    # AO under collar & waist belt
    d.line([(0, 0), (w - 1, 0)], fill=KiritoPalette.COAT_DARK)
    d.line([(0, h - 2), (w - 1, h - 2)], fill=KiritoPalette.COAT_DARK)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=KiritoPalette.SILVER_BASE)
    return img


def paint_coat_tails_outer(w, h):
    """Outer flared coat tails with vertical fabric folds, top waist AO & silver bottom hem."""
    img = Image.new("RGBA", (w, h), KiritoPalette.COAT_BLACK)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 6 == 0:
            d.line([(x, 0), (x, h - 1)], fill=KiritoPalette.COAT_MID)
        elif x % 6 == 3:
            d.line([(x, 0), (x, h - 1)], fill=KiritoPalette.COAT_DARK)
    d.line([(0, 0), (w - 1, 0)], fill=KiritoPalette.COAT_DARK)
    d.line([(0, 1), (w - 1, 1)], fill=KiritoPalette.COAT_DARK)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=KiritoPalette.SILVER_WHITE)
    if h >= 3:
        d.line([(0, h - 2), (w - 1, h - 2)], fill=KiritoPalette.SILVER_BASE)
    return img


def paint_solid_shaded(w, h, color, metallic=False):
    """Shaded material patch with AO bottom, edge highlight top, and optional metallic sheen."""
    img = Image.new("RGBA", (w, h), color)
    d = ImageDraw.Draw(img)
    hl_amt = 34 if metallic else 20
    sh_amt = 28 if metallic else 20
    hl = (min(255, color[0] + hl_amt), min(255, color[1] + hl_amt), min(255, color[2] + hl_amt), color[3])
    sh = (max(0, color[0] - sh_amt), max(0, color[1] - sh_amt), max(0, color[2] - sh_amt), color[3])
    d.line([(0, 0), (w - 1, 0)], fill=hl)
    if metallic and h >= 4:
        d.line([(0, h // 3), (w - 1, h // 3)], fill=hl)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=sh)
    return img


def build_kirito_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED ANIME HEAD & 26+ SPIKY 3D HAIR STRANDS + COWLICK
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_anime_mesh", ("head", "face"),
        origin=[0, 21.6, 0], y_bot=21.6, y_top=26.0, width=4.2, depth=4.1,
        face_painter=paint_kirito_face_64,
        hair_painter=paint_raven_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SKIN_BASE),
    ))

    # 12-segment Rounded Hair Crown & Back Cap (zero bald spots)
    hair_cap_rings = [
        make_ellipse_ring(0, 24.4, 0.05, 2.26, 2.18, n_pts=12),
        make_ellipse_ring(0, 25.4, 0.05, 2.30, 2.22, n_pts=12),
        make_ellipse_ring(0, 26.15, 0.06, 2.12, 2.08, n_pts=12),
        make_ellipse_ring(0, 26.60, 0.08, 1.65, 1.70, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "hair_crown_cap", ("head", "hair"), hair_cap_rings,
        origin=[0, 25.0, 0.05],
        side_painter=paint_raven_hair,
        cap_top_painter=paint_raven_hair,
        tex_scale=6,
    ))

    # 26 Pointed 3D Anime Hair Strands (layered bangs, temple spikes, sideburns, crown & nape spikes + cowlick)
    hair_strands = [
        # Signature Top Cowlick (Ahoge)
        ("cowlick_main", (0.0, 26.48, 0.0), [155, 15, 22], 0.50, 0.42, 1.85, (0.28, 0.22), 1.15),
        ("cowlick_sub", (0.18, 26.42, 0.15), [140, -10, 32], 0.36, 0.30, 1.30, (0.20, 0.15), 1.05),
        # Forehead Bangs (double-layered so full coverage with spiky silhouette)
        ("bang_center_main", (0.0, 26.18, -2.18), [-4, 0, 2], 0.85, 0.36, 2.20, (0.12, -0.05), 1.1),
        ("bang_center_thin", (-0.25, 26.20, -2.24), [-5, 2, -4], 0.55, 0.28, 2.40, (0.08, -0.08), 1.1),
        ("bang_center_l", (-0.62, 26.16, -2.14), [-3, 4, -8], 0.90, 0.36, 2.40, (-0.15, -0.05), 1.1),
        ("bang_center_r", (0.62, 26.16, -2.14), [-3, -4, 8], 0.90, 0.36, 2.40, (0.15, -0.05), 1.1),
        ("bang_mid_l", (-1.28, 26.0, -1.96), [-2, 14, -14], 0.85, 0.38, 2.70, (-0.12, 0.0), 1.1),
        ("bang_mid_r", (1.28, 26.0, -1.96), [-2, -14, 14], 0.85, 0.38, 2.70, (0.12, 0.0), 1.1),
        ("bang_outer_l", (-1.82, 25.6, -1.48), [0, 20, -10], 0.72, 0.50, 3.10, (-0.10, 0.0), 1.1),
        ("bang_outer_r", (1.82, 25.6, -1.48), [0, -20, 10], 0.72, 0.50, 3.10, (0.10, 0.0), 1.1),
        # Cheek-hugging sideburns & inner temple locks
        ("sideburn_l", (-2.05, 25.0, -0.6), [2, 0, -5], 0.58, 0.85, 3.85, (0.10, 0.0), 1.1),
        ("sideburn_r", (2.05, 25.0, -0.6), [2, 0, 5], 0.58, 0.85, 3.85, (-0.10, 0.0), 1.1),
        ("temple_spike_l", (-2.00, 25.7, -1.05), [-4, 10, -18], 0.55, 0.45, 2.45, (-0.22, -0.05), 1.1),
        ("temple_spike_r", (2.00, 25.7, -1.05), [-4, -10, 18], 0.55, 0.45, 2.45, (0.22, -0.05), 1.1),
        # Side & Crown Spikes
        ("flare_l1", (-2.12, 24.8, 0.4), [5, 0, -24], 0.65, 0.85, 2.4, (-0.32, 0.1), 1.1),
        ("flare_r1", (2.12, 24.8, 0.4), [5, 0, 24], 0.65, 0.85, 2.4, (0.32, 0.1), 1.1),
        ("flare_l2", (-1.95, 25.8, 0.7), [12, -10, -32], 0.62, 0.65, 2.1, (-0.35, 0.15), 1.1),
        ("flare_r2", (1.95, 25.8, 0.7), [12, 10, 32], 0.62, 0.65, 2.1, (0.35, 0.15), 1.1),
        ("crown_spike_l", (-1.1, 26.2, 0.9), [28, -12, -18], 0.75, 0.60, 2.0, (-0.20, 0.25), 1.1),
        ("crown_spike_r", (1.1, 26.2, 0.9), [28, 12, 18], 0.75, 0.60, 2.0, (0.20, 0.25), 1.1),
        # Layered Back & Nape Spikes
        ("back_upper_l", (-1.2, 24.8, 1.95), [14, -10, -8], 1.35, 0.65, 3.4, (-0.15, 0.25), 1.1),
        ("back_upper_c", (0.0, 25.0, 2.05), [16, 0, 0], 1.45, 0.65, 3.6, (0.0, 0.30), 1.1),
        ("back_upper_r", (1.2, 24.8, 1.95), [14, 10, 8], 1.35, 0.65, 3.4, (0.15, 0.25), 1.1),
        ("nape_l", (-1.3, 22.8, 1.95), [18, -12, -10], 1.05, 0.55, 2.5, (-0.2, 0.25), 1.1),
        ("nape_c", (0.0, 22.9, 2.05), [20, 0, 0], 1.10, 0.55, 2.6, (0.0, 0.30), 1.1),
        ("nape_r", (1.3, 22.8, 1.95), [18, 12, 10], 1.05, 0.55, 2.5, (0.2, 0.25), 1.1),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair"), [0.0, 0.0, 0.0], hair_strands,
        painter=paint_raven_hair, n_sides=6, n_rings=4,
    ))

    # =======================================================================
    # 2. NECK, HIGH COLLAR, 3D HARNESS & OPEN-FRONT COAT (Torso: 12.2 .. 21.0)
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 20.6, 0.0, 1.00, 1.00, n_pts=12),
        make_ellipse_ring(0, 21.9, 0.0, 0.88, 0.90, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 20.8, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SKIN_BASE),
        tex_scale=6,
    ))

    # High Upturned Coat Collar WITH FRONT V-CUTOUT (open in front, wraps back & sides)
    collar_levels = [
        (20.5, 2.05, 1.65, 0.15, 1.0),
        (21.4, 2.20, 1.74, 0.20, 1.08),
        (22.25, 2.36, 1.84, 0.25, 1.15),
    ]
    els.append(build_open_coat_arc_mesh(
        "coat_collar_arc", ("torso", "collar"),
        origin=[0, 20.8, 0.2],
        levels=collar_levels,
        outer_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_BLACK),
        inner_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_DARK),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        thickness=0.14,
        open_half_deg=48.0,
        n_arc=13,
    ))

    # 12-Segment V-Tapered Athletic Torso
    torso_rings = [
        make_ellipse_ring(0, 12.2, 0.0, 2.30, 1.48, n_pts=12),
        make_ellipse_ring(0, 14.2, 0.0, 2.52, 1.58, n_pts=12),
        make_ellipse_ring(0, 16.5, 0.0, 2.88, 1.72, n_pts=12),
        make_ellipse_ring(0, 18.8, 0.0, 3.38, 1.85, n_pts=12),
        make_ellipse_ring(0, 20.8, 0.0, 3.95, 1.75, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "torso_coat_mesh", ("torso", "chest"), torso_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_kirito_chest_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_MID),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_DARK),
        tex_scale=6,
    ))

    # 3D Diagonal Chest Harness Strap + 3-Rivet Silver SAO Clasp
    els.append(build_beveled_box_mesh(
        "chest_harness_strap_3d", ("torso", "chest"),
        -0.38, 12.8, -2.04, 0.38, 21.1, -1.72, bevel=0.06,
        origin=[0, 17.0, -1.88], rotation=[0, 0, -34],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
    ))
    els.append(build_beveled_box_mesh(
        "harness_3d_clasp", ("torso", "chest"),
        -1.88, 17.05, -2.26, -0.62, 18.35, -1.82, bevel=0.14,
        origin=[-1.25, 17.7, -2.04],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
    ))
    # 3 Distinct Metallic Rivet Studs on the SAO Clasp
    for idx, (rx, ry) in enumerate([(-1.55, 17.98), (-0.95, 17.98), (-1.25, 17.38)]):
        els.append(build_cylinder_mesh(
            f"harness_clasp_rivet_{idx}", ("torso", "chest"),
            origin=[rx, ry, -2.28], radius=0.14, height=0.14, n_sides=12, axis="z",
            side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
        ))

    # Left Breast Pocket with Silver Trim + Flap
    els.append(build_beveled_box_mesh(
        "chest_pocket_l", ("torso", "chest"),
        0.95, 17.4, -2.08, 2.15, 18.2, -1.80, bevel=0.06,
        origin=[1.55, 17.8, -1.94],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_MID),
    ))
    els.append(Cuboid(
        "chest_pocket_trim_l", ("torso", "chest"),
        [0.95, 18.08, -2.14], [2.15, 18.26, -1.88], [1.55, 18.17, -2.01], [0, 0, 0],
        face_painters={"north": lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True)},
    ))

    # Folded Coat Lapels + 6 Silver Coat Buttons + Epaulets with Rivets
    for side, sx, rz in [("l", 1.35, -6), ("r", -1.35, 6)]:
        els.append(build_beveled_box_mesh(
            f"coat_lapel_{side}", ("torso", "chest"),
            sx - 0.75, 14.8, -2.06, sx + 0.75, 20.3, -1.72, bevel=0.10,
            origin=[sx, 17.6, -1.88], rotation=[3, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_MID),
        ))
        els.append(build_beveled_box_mesh(
            f"epaulet_{side}", ("torso", "chest"),
            sx * 2.1 - 0.9, 20.5, -1.2, sx * 2.1 + 0.9, 21.05, 1.2, bevel=0.08,
            origin=[sx * 2.1, 20.75, 0], rotation=[0, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
        ))
        els.append(build_cylinder_mesh(
            f"epaulet_rivet_{side}", ("torso", "chest"),
            origin=[sx * 1.9, 21.08, 0.0], radius=0.18, height=0.12, n_sides=12, axis="y",
            side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        ))
        for b_idx, by in enumerate([13.2, 14.6, 16.0]):
            els.append(build_cylinder_mesh(
                f"coat_button_{side}_{b_idx}", ("torso", "chest"),
                origin=[sx * 0.62, by, -1.86], radius=0.15, height=0.12, n_sides=12, axis="z",
                side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
            ))

    # 12-Segment Belt + 3D Silver Buckle Assembly + Belt Loops + 2 Hip Pouches
    belt_rings = [
        make_ellipse_ring(0, 11.4, 0.0, 2.42, 1.60, n_pts=12),
        make_ellipse_ring(0, 12.4, 0.0, 2.42, 1.60, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "torso_belt", ("torso", "belt"), belt_rings,
        origin=[0, 11.9, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
        tex_scale=5,
    ))
    els.extend(build_buckle_assembly(
        "belt_buckle", ("torso", "belt"),
        origin=[0, 11.9, -1.68], width=1.25, height=0.92, depth=0.30,
        frame_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        pin_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
    ))
    for side, sx in [("l", 2.25), ("r", -2.25)]:
        els.append(build_beveled_box_mesh(
            f"belt_loop_{side}", ("torso", "belt"),
            sx - 0.25, 11.3, -0.5, sx + 0.25, 12.5, 0.5, bevel=0.06,
            origin=[sx, 11.9, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
        ))
        els.append(build_pouch_mesh(
            f"hip_pouch_{side}", ("torso", "belt"),
            origin=[sx * 1.06, 11.35, 0.45], width=0.85, height=1.15, depth=0.55,
            rotation=[0, 90 if sx > 0 else -90, 0],
            body_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
            flap_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.LEATHER_HL),
            buckle_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        ))

    # OPEN-FRONT HOLLOW FLARED COAT TAILS (15 arc segments, NO bottom cap!)
    coat_levels = [
        (3.4,  4.25, 3.05, 0.25, 1.55),
        (5.5,  3.75, 2.65, 0.18, 1.40),
        (7.6,  3.25, 2.25, 0.12, 1.25),
        (9.9,  2.80, 1.90, 0.06, 1.08),
        (12.2, 2.38, 1.56, 0.00, 0.90),
    ]
    els.append(build_open_coat_arc_mesh(
        "coat_tails_open_mesh", ("torso", "coat_tails"),
        origin=[0, 12.2, 0],
        levels=coat_levels,
        outer_painter=paint_coat_tails_outer,
        inner_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_DARK),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        thickness=0.14,
        open_half_deg=26.0,
        n_arc=15,
    ))

    # =======================================================================
    # 3. DUAL SWORDS ON BACK (Cleanly Behind Back: rx=-7 -> ZERO CLIPPING!)
    # =======================================================================
    els.append(build_beveled_box_mesh(
        "sword_back_mount", ("torso", "swords"),
        -1.6, 14.5, 1.75, 1.6, 17.2, 2.15, bevel=0.10,
        origin=[0, 15.85, 1.95],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
    ))
    for ang_z in [-28, 28]:
        els.append(build_beveled_box_mesh(
            f"back_strap_{ang_z}", ("torso", "swords"),
            -0.25, 13.5, 1.75, 0.25, 18.5, 2.02, bevel=0.05,
            origin=[0, 16.0, 1.90], rotation=[0, 0, ang_z],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
        ))
    els.extend(build_buckle_assembly(
        "back_harness_buckle", ("torso", "swords"),
        origin=[0, 15.85, 2.18], width=0.85, height=0.65, depth=0.20,
        frame_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
    ))

    # --- ELUCIDATOR (Right Shoulder Hilt -> Sweeps down-left BEHIND coat!) ---
    e_orig = [1.0, 17.5, 2.38]
    e_rot = [-7, 0, -26]
    els.append(build_hair_strand_mesh(
        "elucidator_scabbard", ("torso", "swords", "elucidator"),
        e_orig, e_rot, 0.74, 0.44, 11.4, tip_offset=(0.0, 0.0), mid_bulge=1.0,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.ELUCIDATOR_BLACK),
        n_sides=8, n_rings=4,
    ))
    els.append(build_beveled_box_mesh(
        "elucidator_throat", ("torso", "swords", "elucidator"),
        0.55, 17.1, 2.10, 1.45, 17.6, 2.66, bevel=0.06,
        origin=e_orig, rotation=e_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "elucidator_guard_center", ("torso", "swords", "elucidator"),
        0.0, 17.5, 2.02, 2.0, 18.3, 2.74, bevel=0.10,
        origin=e_orig, rotation=e_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.ELUCIDATOR_GUARD, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "elucidator_guard_wing_l", ("torso", "swords", "elucidator"),
        1.7, 17.6, 2.12, 2.45, 18.2, 2.64, bevel=0.08,
        origin=e_orig, rotation=e_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.ELUCIDATOR_EDGE, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "elucidator_guard_wing_r", ("torso", "swords", "elucidator"),
        -0.45, 17.6, 2.12, 0.30, 18.2, 2.64, bevel=0.08,
        origin=e_orig, rotation=e_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.ELUCIDATOR_EDGE, metallic=True),
    ))
    els.append(build_tapered_cylinder(
        "elucidator_grip", ("torso", "swords", "elucidator"),
        origin=[1.0, 20.05, 2.38], r_bottom=0.25, r_top=0.28, height=3.5,
        n_sides=12, n_rings=3, axis="y", rotation=e_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.ELUCIDATOR_BLACK),
    ))
    els.append(build_beveled_box_mesh(
        "elucidator_pommel", ("torso", "swords", "elucidator"),
        0.60, 21.8, 2.05, 1.40, 2.5 + 20.0, 2.68, bevel=0.12,
        origin=e_orig, rotation=e_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
    ))

    # --- DARK REPULSER (Left Shoulder Hilt -> Sweeps down-right BEHIND coat!) ---
    r_orig = [-1.0, 17.5, 2.72]
    r_rot = [-7, 0, 26]
    els.append(build_hair_strand_mesh(
        "repulser_scabbard", ("torso", "swords", "dark_repulser"),
        r_orig, r_rot, 0.74, 0.44, 11.4, tip_offset=(0.0, 0.0), mid_bulge=1.0,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_CRYSTAL),
        n_sides=8, n_rings=4,
    ))
    els.append(build_beveled_box_mesh(
        "repulser_throat", ("torso", "swords", "dark_repulser"),
        -1.45, 17.1, 2.44, -0.55, 17.6, 3.00, bevel=0.06,
        origin=r_orig, rotation=r_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_LIGHT, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "repulser_guard_center", ("torso", "swords", "dark_repulser"),
        -2.0, 17.5, 2.36, 0.0, 18.3, 3.08, bevel=0.12,
        origin=r_orig, rotation=r_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_GUARD, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "repulser_guard_wing_l", ("torso", "swords", "dark_repulser"),
        -0.30, 17.6, 2.46, 0.45, 18.2, 2.98, bevel=0.08,
        origin=r_orig, rotation=r_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_LIGHT, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "repulser_guard_wing_r", ("torso", "swords", "dark_repulser"),
        -2.45, 17.6, 2.46, -1.70, 18.2, 2.98, bevel=0.08,
        origin=r_orig, rotation=r_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_LIGHT, metallic=True),
    ))
    els.append(build_tapered_cylinder(
        "repulser_grip", ("torso", "swords", "dark_repulser"),
        origin=[-1.0, 20.05, 2.72], r_bottom=0.25, r_top=0.28, height=3.5,
        n_sides=12, n_rings=3, axis="y", rotation=r_rot,
        side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "repulser_pommel", ("torso", "swords", "dark_repulser"),
        -1.40, 21.8, 2.38, -0.60, 22.5, 3.02, bevel=0.14,
        origin=r_orig, rotation=r_rot,
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.REPULSER_LIGHT, metallic=True),
    ))

    # =======================================================================
    # 4. ANATOMICAL ARMS, FLUSH STRAPS, SAO CREST & GLOVES
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        shoulder_pos = [sign * 3.78, 20.4, 0.0]
        elbow_pos = [sign * 3.96, 15.4, 0.04]
        wrist_pos = [sign * 4.04, 11.6, -0.08]
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=shoulder_pos,
            elbow_pos=elbow_pos,
            wrist_pos=wrist_pos,
            radii={"shoulder": 1.02, "bicep": 0.90, "elbow": 0.76, "forearm": 0.80, "wrist": 0.65},
            sleeve_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_BLACK),
            skin_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_MID),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_DARK),
        ))
        wx, wy, wz = wrist_pos
        # Flush Elliptical Forearm Strap & Buckle Assembly
        els.append(build_muscular_limb_mesh(
            f"forearm_strap_{side}", (arm_grp, "forearm"),
            origin=[wx, 13.7, -0.04],
            ring_specs=[
                (wx, 13.45, -0.04, 0.79, 0.85),
                (wx, 13.95, -0.04, 0.79, 0.85),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
        ))
        els.extend(build_buckle_assembly(
            f"forearm_buckle_{side}", (arm_grp, "forearm"),
            origin=[wx + sign * 0.79, 13.7, -0.04], width=0.45, height=0.42, depth=0.16,
            rotation=[0, 90 * sign, 0],
            frame_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        ))
        # Flush Silver Wrist Cuff
        els.append(build_muscular_limb_mesh(
            f"wrist_cuff_{side}", (arm_grp, "forearm"),
            origin=[wx, 11.8, wz],
            ring_specs=[
                (wx, 11.55, wz, 0.70, 0.74),
                (wx, 12.05, wz, 0.70, 0.74),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        ))
        # Flush Glove Knuckle Pad
        els.append(build_beveled_box_mesh(
            f"glove_knuckle_pad_{side}", (arm_grp, "hand"),
            wx - 0.50, wy - 1.05, wz - 0.78, wx + 0.50, wy - 0.65, wz + 0.72, bevel=0.06,
            origin=[wx, wy - 0.85, wz - 0.03],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_DARK, metallic=True),
        ))

    # Left Shoulder SAO Silver Crest + Right Flush Elliptical Bicep Strap
    els.append(build_beveled_box_mesh(
        "sao_crest_badge_l", ("left_arm", "arm"),
        4.52, 17.15, -0.54, 4.82, 18.25, 0.54, bevel=0.08,
        origin=[4.67, 17.7, 0],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "sao_crest_inner_l", ("left_arm", "arm"),
        4.74, 17.35, -0.34, 4.88, 18.05, 0.34, bevel=0.04,
        origin=[4.81, 17.7, 0],
        painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_DARK),
    ))
    els.append(build_muscular_limb_mesh(
        "bicep_strap_r", ("right_arm", "arm"),
        origin=[-3.92, 16.7, -0.05],
        ring_specs=[
            (-3.92, 16.45, -0.05, 0.90, 0.95),
            (-3.92, 16.95, -0.05, 0.90, 0.95),
        ],
        n_sides=14,
        side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BELT_LEATHER),
    ))
    els.extend(build_buckle_assembly(
        "bicep_buckle_r", ("right_arm", "arm"),
        origin=[-4.82, 16.7, -0.05], width=0.42, height=0.42, depth=0.16,
        rotation=[0, -90, 0],
        frame_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
    ))

    # =======================================================================
    # 5. ANATOMICAL LEGS, KNEE ARMOR & SILVER-CUFFED COMBAT BOOTS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.25
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 12.2, 0.0],
            knee_pos=[lx, 6.2, 0.0],
            ankle_pos=[lx, 1.5, 0.0],
            radii={"hip": 1.10, "thigh": 1.02, "knee": 0.86, "calf": 0.96, "ankle": 0.78},
            pants_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.PANTS_BLACK),
            boot_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_BLACK),
            knee_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.PANTS_BLACK),
        ))
        els.append(build_armor_plate(
            f"knee_plate_{side}", (leg_grp, "knee"),
            origin=[lx, 6.25, -1.04], width=1.55, height=1.35, thickness=0.28, curve_z=0.35, bevel=0.12,
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_HL),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
        ))
        els.append(build_muscular_limb_mesh(
            f"boot_silver_cuff_{side}", (leg_grp, "boot"),
            origin=[lx, 5.65, 0.04],
            ring_specs=[
                (lx, 5.30, 0.04, 0.93, 1.01),
                (lx, 6.02, 0.04, 0.93, 1.01),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_WHITE, metallic=True),
        ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", (leg_grp, "boot"),
            origin=[lx + sign * 0.92, 4.3, 0.04], width=0.52, height=0.46, depth=0.16,
            rotation=[0, 90 * sign, 0],
            frame_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_BASE, metallic=True),
        ))
        els.append(build_armor_plate(
            f"boot_shin_plate_{side}", (leg_grp, "boot"),
            origin=[lx, 3.5, -0.90], width=1.20, height=3.20, thickness=0.22, curve_z=0.25, bevel=0.08,
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_MID),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.SILVER_DARK, metallic=True),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_foot_{side}", (leg_grp, "foot"),
            lx - 0.84, 0.42, -2.15, lx + 0.84, 1.65, 0.95, bevel=0.16,
            origin=[lx, 1.0, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.COAT_BLACK),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", (leg_grp, "foot"),
            lx - 0.88, 0.0, -2.25, lx + 0.88, 0.48, 1.02, bevel=0.07,
            origin=[lx, 0.24, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, KiritoPalette.BOOT_SOLE),
        ))

    return els


def main():
    print("[1/3] Building high-detail open-coat polygonal Kirito (target_height=27.5)...")
    els = build_kirito_elements()

    group_origins = {
        "head": [0, 21.6, 0],
        "torso": [0, 12.2, 0],
        "left_arm": [3.6, 20.4, 0],
        "left_arm/forearm": [3.95, 15.2, 0],
        "right_arm": [-3.6, 20.4, 0],
        "right_arm/forearm": [-3.95, 15.2, 0],
        "left_leg": [1.25, 12.2, 0],
        "right_leg": [-1.25, 12.2, 0],
    }

    scale = scale_elements_to_height(els, group_origins, 27.5)
    print(f"      Elements: {len(els)}, Uniform Scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=KiritoPalette.COAT_BLACK)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(base_dir, "output"), exist_ok=True)
    atlas.save(os.path.join(base_dir, "output", "kirito_texture.png"), format="PNG")

    targets = [
        os.path.join(base_dir, "output", "kirito.bbmodel"),
    ]

    print("[3/3] Exporting output/kirito.bbmodel...")
    export_bbmodel(els, atlas, "kirito", targets, group_origins=group_origins)
    print("[DONE] Kirito generated!")


if __name__ == "__main__":
    main()
