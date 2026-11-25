#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Albert Wesker (Resident Evil 5) Polygonal 3D Generator (.bbmodel)
Target Height: 30.5 units (190cm - tallest character)
Features:
  - 100% True Polygonal Meshes ("type": "mesh") - zero primitive cuboids
  - 14-16 segment smooth lofted limbs, torso, and open-front hollow coat tails
  - Sculpted head + ears + wraparound polarized sunglasses + 24+ slicked-back blonde hair strands
  - Open-front popped collar, folded lapels, 8 metallic buttons, stitched seams, shoulder epaulets
  - Tactical belt with 3D bronze buckle assembly, 4 tactical pouches, grenades & spare magazines
  - Samurai Edge pistol in thigh holster, articulated fingers/gloves, knee pads, lugged laced/buckled boots
  - 1024x1024 procedural atlas with Ambient Occlusion, edge highlights & specular glints
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    build_sculpted_head_mesh,
    build_open_coat_arc_mesh,
    build_lofted_mesh,
    make_ellipse_ring,
    build_hair_strand_mesh,
    build_multi_strand_hair_layer,
    build_beveled_box_mesh,
    build_tapered_cylinder,
    build_cylinder_mesh,
    build_armor_plate,
    build_buckle_assembly,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    build_muscular_limb_mesh,
    build_pouch_mesh,
    scale_elements_to_height,
    bake_elements_atlas,
    export_bbmodel,
)


class WeskerPalette:
    SKIN_BASE = (240, 224, 210, 255)
    SKIN_HL = (250, 238, 226, 255)
    SKIN_SHADOW = (214, 190, 170, 255)
    SKIN_DEEP = (186, 158, 136, 255)
    LIPS = (192, 146, 134, 255)

    HAIR_HL = (248, 240, 218, 255)
    HAIR_LIGHT = (226, 208, 170, 255)
    HAIR_MID = (194, 170, 128, 255)
    HAIR_SHADE = (150, 126, 88, 255)
    HAIR_DEEP = (106, 86, 56, 255)

    GLASS_FRAME = (14, 14, 18, 255)
    GLASS_LENS_TOP = (14, 16, 22, 255)
    GLASS_LENS_BOT = (38, 46, 58, 255)
    GLASS_GLARE = (245, 250, 255, 255)

    LEATHER_BLACK = (18, 19, 24, 255)
    LEATHER_DARK = (10, 11, 14, 255)
    LEATHER_MID = (32, 35, 43, 255)
    LEATHER_HL = (56, 60, 74, 255)
    STITCH_GRAY = (72, 76, 88, 255)
    LINING_CRIMSON = (52, 14, 18, 255)

    BUTTON_SILVER = (192, 202, 218, 255)
    BUTTON_HL = (244, 248, 255, 255)
    BUCKLE_GOLD = (218, 148, 22, 255)
    BUCKLE_HL = (252, 214, 82, 255)
    BUCKLE_SHADOW = (138, 86, 8, 255)

    PANTS_BLACK = (20, 22, 28, 255)
    PANTS_HL = (40, 44, 56, 255)
    BOOT_SOLE = (8, 8, 10, 255)
    GUN_STEEL = (156, 166, 178, 255)
    GUN_DARK = (34, 36, 42, 255)
    GUN_WOOD = (110, 62, 34, 255)
    GRENADE_OLIVE = (58, 72, 46, 255)


# ---------------------------------------------------------------------------
# Procedural Texture Painters (with AO & Specular Highlights)
# ---------------------------------------------------------------------------
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


def paint_wesker_face_64(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)
    # Subtle cheekbone & jaw AO gradient
    for y in range(h):
        v = y / max(1, h - 1)
        if v > 0.78:
            d.line([(0, y), (w - 1, y)], fill=WeskerPalette.SKIN_SHADOW)
    # Hairline at top + forehead shadow
    hh = int(h * 0.17)
    d.rectangle([0, 0, w - 1, hh], fill=WeskerPalette.HAIR_MID)
    for y in range(hh + 1, hh + 4):
        d.line([(0, y), (w - 1, y)], fill=WeskerPalette.SKIN_SHADOW)
    # Furrowed stern brows
    by = int(h * 0.37)
    d.line([(int(w * 0.17), by), (int(w * 0.38), by + 2)], fill=WeskerPalette.HAIR_DEEP)
    d.line([(int(w * 0.62), by + 2), (int(w * 0.83), by)], fill=WeskerPalette.HAIR_DEEP)
    # Subtle glowing red-amber eyes peeking behind lens edges
    ey = int(h * 0.45)
    d.rectangle([int(w * 0.24), ey, int(w * 0.34), ey + 2], fill=(160, 48, 32, 255))
    d.rectangle([int(w * 0.66), ey, int(w * 0.76), ey + 2], fill=(160, 48, 32, 255))
    # Nose bridge highlight & shadow
    mid_x = w // 2
    d.line([(mid_x, int(h * 0.44)), (mid_x, int(h * 0.64))], fill=WeskerPalette.SKIN_HL)
    d.rectangle([mid_x - 1, int(h * 0.65), mid_x + 1, int(h * 0.68)], fill=WeskerPalette.SKIN_SHADOW)
    # Stern mouth
    my = int(h * 0.80)
    d.line([(mid_x - 6, my), (mid_x + 6, my)], fill=WeskerPalette.LIPS)
    d.line([(mid_x - 4, my + 1), (mid_x + 4, my + 1)], fill=WeskerPalette.SKIN_DEEP)
    return img


def paint_sunglasses_lens(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.GLASS_FRAME)
    d = ImageDraw.Draw(img)
    for gy in range(1, max(2, h - 1)):
        t = gy / max(1, h - 1)
        c = (
            int(WeskerPalette.GLASS_LENS_TOP[0] * (1 - t) + WeskerPalette.GLASS_LENS_BOT[0] * t),
            int(WeskerPalette.GLASS_LENS_TOP[1] * (1 - t) + WeskerPalette.GLASS_LENS_BOT[1] * t),
            int(WeskerPalette.GLASS_LENS_TOP[2] * (1 - t) + WeskerPalette.GLASS_LENS_BOT[2] * t),
            255,
        )
        d.line([(1, gy), (max(1, w - 2), gy)], fill=c)
    # Polarized diagonal glare streak
    if w >= 6 and h >= 4:
        for gy in range(1, h - 1):
            gx = w // 2 - (gy - h // 2)
            if 1 <= gx < w - 1:
                d.point((gx, gy), fill=WeskerPalette.GLASS_GLARE)
                if gx + 1 < w - 1:
                    d.point((gx + 1, gy), fill=(180, 200, 225, 255))
    d.line([(0, 0), (w - 1, 0)], fill=(68, 74, 88, 255))
    return img


def paint_slicked_hair(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.HAIR_MID)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.22:
            c = WeskerPalette.HAIR_HL
        elif t < 0.55:
            c = WeskerPalette.HAIR_LIGHT
        elif t > 0.85:
            c = WeskerPalette.HAIR_DEEP
        else:
            c = WeskerPalette.HAIR_MID
        d.line([(0, y), (w - 1, y)], fill=c)
    for x in range(0, w, 2):
        d.line([(x, 0), (x, h - 1)], fill=WeskerPalette.HAIR_SHADE)
    return img


def paint_trench_coat_wrap(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.LEATHER_BLACK)
    d = ImageDraw.Draw(img)
    for x in range(w):
        u = x / max(1, w)
        if abs(u - 0.25) < 0.025 or abs(u - 0.75) < 0.025:
            d.line([(x, 0), (x, h - 1)], fill=WeskerPalette.LEATHER_DARK)
        elif abs(u - 0.22) < 0.012 or abs(u - 0.28) < 0.012:
            for y in range(0, h, 3):
                d.point((x, y), fill=WeskerPalette.STITCH_GRAY)
        elif x % 5 == 0:
            d.line([(x, 0), (x, h - 1)], fill=WeskerPalette.LEATHER_MID)
    d.line([(0, 0), (w - 1, 0)], fill=WeskerPalette.LEATHER_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=WeskerPalette.LEATHER_DARK)
    return img


def paint_coat_tails_wrap(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.LEATHER_BLACK)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 6 == 0:
            d.line([(x, 0), (x, h - 1)], fill=WeskerPalette.LEATHER_MID)
        elif x % 6 == 3:
            d.line([(x, 0), (x, h - 1)], fill=WeskerPalette.LEATHER_DARK)
    # Top waist AO shadow under belt, bottom stitched hem + highlight
    for y in range(min(3, h)):
        d.line([(0, y), (w - 1, y)], fill=WeskerPalette.LEATHER_DARK)
    if h >= 4:
        for x in range(0, w, 3):
            d.point((x, h - 2), fill=WeskerPalette.STITCH_GRAY)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=WeskerPalette.LEATHER_HL)
    return img


def paint_leather_highlight(w, h, base=WeskerPalette.LEATHER_BLACK, hl=WeskerPalette.LEATHER_HL):
    img = Image.new("RGBA", (w, h), base)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 4):
        d.line([(x, 0), (x, h - 1)], fill=(min(255, base[0] + 6), min(255, base[1] + 6), min(255, base[2] + 8), 255))
    d.line([(0, 0), (w - 1, 0)], fill=hl)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=WeskerPalette.LEATHER_DARK)
    return img


def paint_gold_buckle(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.BUCKLE_GOLD)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=WeskerPalette.BUCKLE_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=WeskerPalette.BUCKLE_SHADOW)
    if w >= 4 and h >= 4:
        d.point((1, 1), fill=WeskerPalette.BUCKLE_HL)
    return img


def paint_metallic_silver(w, h):
    img = Image.new("RGBA", (w, h), WeskerPalette.BUTTON_SILVER)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=WeskerPalette.BUTTON_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=(90, 98, 110, 255))
    return img


# ---------------------------------------------------------------------------
# Wesker High-Detail Polygonal Geometry Builder
# ---------------------------------------------------------------------------
def build_wesker_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED HEAD, EARS, SUNGLASSES & 24+ SLICKED HAIR STRANDS
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_sculpted_mesh", ("head", "face"),
        origin=[0, 24.8, 0], y_bot=24.9, y_top=29.5, width=4.0, depth=4.0,
        face_painter=paint_wesker_face_64,
        hair_painter=paint_slicked_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.SKIN_BASE),
    ))

    # Sculpted Ears
    for side, sx in [("l", 2.02), ("r", -2.02)]:
        x0, x1 = (sx - 0.14, sx + 0.30) if side == "l" else (sx - 0.30, sx + 0.14)
        els.append(build_beveled_box_mesh(
            f"ear_{side}", ("head", "face"),
            x0, 26.3, -0.35, x1, 27.6, 0.45, bevel=0.1,
            origin=[sx, 26.95, 0.05],
            painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.SKIN_BASE),
        ))

    # 3D Wraparound Polarized Sunglasses (bridge + 2 angled lenses + 2 temple arms + 2 nose pads)
    els.append(build_beveled_box_mesh(
        "sunglasses_bridge", ("head", "sunglasses"),
        -0.38, 27.25, -2.38, 0.38, 27.62, -2.04, bevel=0.06,
        origin=[0, 27.44, -2.21],
        painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.GLASS_FRAME),
    ))
    for side, sign, ry in [("l", 1, -10), ("r", -1, 10)]:
        lx = sign * 1.15
        els.append(build_beveled_box_mesh(
            f"sunglasses_lens_{side}", ("head", "sunglasses"),
            lx - 0.92, 26.80, -2.35, lx + 0.92, 27.82, -2.02, bevel=0.07,
            origin=[lx, 27.31, -2.18], rotation=[0, ry, 0],
            painter=paint_sunglasses_lens,
        ))
        tx = sign * 2.06
        els.append(build_beveled_box_mesh(
            f"sunglasses_temple_{side}", ("head", "sunglasses"),
            tx - 0.10, 27.22, -2.08, tx + 0.10, 27.55, 0.65, bevel=0.04,
            origin=[tx, 27.38, -0.7],
            painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.GLASS_FRAME),
        ))
        els.append(build_beveled_box_mesh(
            f"sunglasses_nosepad_{side}", ("head", "sunglasses"),
            sign * 0.28 - 0.10, 26.92, -2.20, sign * 0.28 + 0.10, 27.28, -1.96, bevel=0.03,
            origin=[sign * 0.28, 27.1, -2.08],
            painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.BUTTON_SILVER),
        ))

    # 16-segment Lofted Pompadour Hair Crown
    hair_crown_rings = [
        make_ellipse_ring(0, 28.4, 0.08, 2.14, 2.26, n_pts=16),
        make_ellipse_ring(0, 29.4, 0.18, 2.18, 2.30, n_pts=16),
        make_ellipse_ring(0, 30.1, 0.32, 1.85, 2.02, n_pts=16),
        make_ellipse_ring(0, 30.48, 0.45, 1.15, 1.40, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "hair_pompadour_crown", ("head", "hair"), hair_crown_rings,
        origin=[0, 28.4, 0.1],
        side_painter=paint_slicked_hair,
        cap_top_painter=paint_slicked_hair,
        tex_scale=6,
    ))

    # 24 Multi-Layered 3D Slicked-Back Blonde Hair Strands (front sweep, crown spikes, temples, nape)
    hair_strands = [
        # Front slicked-back pompadour ridges (7 strands sweeping up & back)
        ("front_c", (0.0, 0.55, -1.75), (-76, 0, 0), 0.72, 0.42, 2.3, (0.0, 0.3), 1.15, 0.18),
        ("front_l1", (0.58, 0.50, -1.68), (-74, -10, 4), 0.65, 0.38, 2.2, (0.1, 0.25), 1.12, 0.15),
        ("front_r1", (-0.58, 0.50, -1.68), (-74, 10, -4), 0.65, 0.38, 2.2, (-0.1, 0.25), 1.12, 0.15),
        ("front_l2", (1.15, 0.38, -1.50), (-70, -22, 8), 0.62, 0.36, 2.1, (0.15, 0.2), 1.10, 0.12),
        ("front_r2", (-1.15, 0.38, -1.50), (-70, 22, -8), 0.62, 0.36, 2.1, (-0.15, 0.2), 1.10, 0.12),
        ("front_l3", (1.65, 0.18, -1.15), (-60, -35, 12), 0.55, 0.34, 1.9, (0.18, 0.15), 1.08, 0.10),
        ("front_r3", (-1.65, 0.18, -1.15), (-60, 35, -12), 0.55, 0.34, 1.9, (-0.18, 0.15), 1.08, 0.10),
        # Mid-crown swept ridges (5 strands)
        ("crown_c", (0.0, 0.92, -0.35), (-84, 0, 0), 0.85, 0.44, 2.5, (0.0, 0.2), 1.15, 0.12),
        ("crown_l1", (0.78, 0.84, -0.30), (-82, -12, 6), 0.72, 0.40, 2.4, (0.12, 0.2), 1.12, 0.10),
        ("crown_r1", (-0.78, 0.84, -0.30), (-82, 12, -6), 0.72, 0.40, 2.4, (-0.12, 0.2), 1.12, 0.10),
        ("crown_l2", (1.48, 0.62, -0.20), (-76, -24, 10), 0.65, 0.36, 2.2, (0.15, 0.18), 1.10, 0.08),
        ("crown_r2", (-1.48, 0.62, -0.20), (-76, 24, -10), 0.65, 0.36, 2.2, (-0.15, 0.18), 1.10, 0.08),
        # Temple sideburns & side-swept locks (6 strands)
        ("temple_l1", (2.02, -0.25, -0.65), (22, 14, -10), 0.58, 0.95, 2.4, (0.08, 0.35), 1.08, 0.06),
        ("temple_r1", (-2.02, -0.25, -0.65), (22, -14, 10), 0.58, 0.95, 2.4, (-0.08, 0.35), 1.08, 0.06),
        ("temple_l2", (2.05, -0.45, 0.15), (28, 18, -8), 0.55, 0.85, 2.5, (0.06, 0.3), 1.08, 0.05),
        ("temple_r2", (-2.05, -0.45, 0.15), (28, -18, 8), 0.55, 0.85, 2.5, (-0.06, 0.3), 1.08, 0.05),
        ("sideburn_l", (1.98, -1.05, -0.82), (8, 8, -4), 0.34, 0.55, 1.4, (0.04, 0.08), 1.05, 0.0),
        ("sideburn_r", (-1.98, -1.05, -0.82), (8, -8, 4), 0.34, 0.55, 1.4, (-0.04, 0.08), 1.05, 0.0),
        # Back & nape swept spikes (6 strands)
        ("back_c", (0.0, -0.20, 2.05), (56, 0, 0), 1.10, 0.62, 3.3, (0.0, 0.30), 1.12, 0.10),
        ("back_l1", (0.95, -0.28, 1.88), (52, 16, -6), 0.95, 0.56, 3.1, (0.14, 0.25), 1.10, 0.08),
        ("back_r1", (-0.95, -0.28, 1.88), (52, -16, 6), 0.95, 0.56, 3.1, (-0.14, 0.25), 1.10, 0.08),
        ("back_l2", (1.62, -0.45, 1.38), (45, 30, -10), 0.80, 0.52, 2.8, (0.18, 0.22), 1.08, 0.06),
        ("back_r2", (-1.62, -0.45, 1.38), (45, -30, 10), 0.80, 0.52, 2.8, (-0.18, 0.22), 1.08, 0.06),
        ("nape_c", (0.0, -1.55, 1.95), (28, 0, 0), 1.25, 0.52, 2.4, (0.0, 0.22), 1.05, 0.05),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair"),
        base_origin=[0, 29.3, 0.0],
        strand_specs=hair_strands,
        painter=paint_slicked_hair,
        n_sides=6, n_rings=4,
    ))

    # =======================================================================
    # 2. NECK, POPPED COLLAR, V-TAPERED TRENCH COAT & HOLLOW COAT TAILS
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 23.6, 0.0, 1.18, 1.18, n_pts=14),
        make_ellipse_ring(0, 25.3, -0.05, 1.02, 1.06, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 24.0, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.SKIN_SHADOW),
        tex_scale=6,
    ))

    # High Popped Collar WITH FRONT V-CUTOUT (13-segment smooth arc)
    collar_levels = [
        (23.8, 2.24, 1.84, 0.15, 1.0),
        (24.8, 2.38, 1.94, 0.20, 1.08),
        (25.9, 2.54, 2.06, 0.28, 1.16),
    ]
    els.append(build_open_coat_arc_mesh(
        "collar_popped_arc", ("torso", "collar"),
        origin=[0, 24.0, 0.2],
        levels=collar_levels,
        outer_painter=lambda w, h: paint_leather_highlight(w, h),
        inner_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LINING_CRIMSON),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_HL),
        thickness=0.16,
        open_half_deg=44.0,
        n_arc=13,
    ))

    # V-Tapered Athletic Coat Torso (16-segment smooth mesh)
    torso_rings = [
        make_ellipse_ring(0, 13.5, 0.0, 2.65, 1.65, n_pts=16),  # Waist
        make_ellipse_ring(0, 17.0, 0.0, 2.98, 1.85, n_pts=16),  # Ribcage
        make_ellipse_ring(0, 21.2, 0.0, 3.68, 2.05, n_pts=16),  # Chest
        make_ellipse_ring(0, 24.2, 0.0, 4.35, 1.95, n_pts=16),  # Broad Shoulder Bridge
    ]
    els.append(build_lofted_mesh(
        "torso_coat_mesh", ("torso", "chest"), torso_rings,
        origin=[0, 13.5, 0],
        side_painter=paint_trench_coat_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_MID),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_DARK),
        tex_scale=5,
    ))

    # Sculpted Inner Chest Undershirt V-panel & Zipper Placket
    els.append(build_beveled_box_mesh(
        "undershirt_v_panel", ("torso", "chest"),
        -0.85, 19.5, -2.02, 0.85, 24.0, -1.78, bevel=0.08,
        origin=[0, 21.8, -1.90],
        painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_DARK),
    ))
    els.append(build_cylinder_mesh(
        "coat_center_seam", ("torso", "chest"),
        origin=[0, 16.5, -1.96], radius=0.08, height=6.0, n_sides=8, axis="y",
        side_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.STITCH_GRAY),
    ))

    # Folded Double-Breasted Lapels + 8 Metallic Cylindrical Buttons + Stitched Seam Piping
    for side, sign, rot_z in [("l", 1, -7), ("r", -1, 7)]:
        sx = sign * 1.18
        # Upper & lower folded lapel plates
        els.append(build_armor_plate(
            f"coat_lapel_upper_{side}", ("torso", "chest"),
            origin=[sx, 21.4, -2.02], width=1.65, height=4.4, thickness=0.22,
            curve_z=0.18, bevel=0.10, rotation=[4, 0, rot_z],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_HL),
        ))
        els.append(build_armor_plate(
            f"coat_lapel_lower_{side}", ("torso", "chest"),
            origin=[sx * 0.88, 17.2, -1.98], width=1.45, height=4.2, thickness=0.20,
            curve_z=0.15, bevel=0.10, rotation=[2, 0, rot_z * 0.4],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_HL),
        ))
        # Shoulder Epaulets with metallic snap button
        els.append(build_beveled_box_mesh(
            f"shoulder_epaulet_{side}", ("torso", "chest"),
            sign * 2.35 - 0.95, 24.05, -0.55, sign * 2.35 + 0.95, 24.35, 0.55, bevel=0.08,
            origin=[sign * 2.35, 24.2, 0.0], rotation=[0, 0, -sign * 8],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
        ))
        els.append(build_cylinder_mesh(
            f"epaulet_btn_{side}", ("torso", "chest"),
            origin=[sign * 1.85, 24.38, 0.0], radius=0.16, height=0.12, n_sides=10, axis="y",
            side_painter=paint_metallic_silver,
        ))
        # 4 Metallic Buttons per side (8 total)
        for b_idx, by in enumerate([16.2, 18.0, 19.8, 21.6]):
            els.append(build_cylinder_mesh(
                f"coat_btn_{side}_{b_idx}", ("torso", "chest"),
                origin=[sx * 0.96, by, -2.18], radius=0.18, height=0.14, n_sides=12, axis="z",
                side_painter=paint_metallic_silver,
                cap_top_painter=paint_metallic_silver,
                cap_bot_painter=paint_metallic_silver,
            ))

    # Tactical Belt (16-seg) + 3D Bronze Buckle Assembly + 4 Tactical Pouches + Grenades/Magazines
    belt_rings = [
        make_ellipse_ring(0, 12.6, 0.0, 2.76, 1.76, n_pts=16),
        make_ellipse_ring(0, 13.8, 0.0, 2.76, 1.76, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "tactical_belt", ("torso", "belt"), belt_rings,
        origin=[0, 13.2, 0],
        side_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK, WeskerPalette.LEATHER_MID),
        tex_scale=5,
    ))
    els.extend(build_buckle_assembly(
        "belt_buckle_bronze", ("torso", "belt"),
        origin=[0, 13.2, -1.80], width=1.45, height=1.10, depth=0.30,
        frame_painter=paint_gold_buckle,
        pin_painter=paint_metallic_silver,
    ))
    # 4 Tactical Pouches (2 front-side + 2 back-side, seated flush into belt)
    pouch_coords = [
        ("front_l", [2.25, 13.1, -1.12], [0, -32, 0]),
        ("front_r", [-2.25, 13.1, -1.12], [0, 32, 0]),
        ("hip_l", [2.72, 13.1, 0.52], [0, -82, 0]),
        ("hip_r", [-2.72, 13.1, 0.52], [0, 82, 0]),
    ]
    for pname, porig, prot in pouch_coords:
        els.append(build_pouch_mesh(
            f"tactical_pouch_{pname}", ("torso", "belt"),
            origin=porig, width=0.95, height=1.35, depth=0.65, rotation=prot,
            body_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            flap_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_BLACK),
            buckle_painter=paint_gold_buckle,
        ))
    # Back Tactical Grenades (x2) & Spare Magazine Carrier (seated flush on back belt)
    for g_idx, gx in enumerate([-1.15, 1.15]):
        els.append(build_tapered_cylinder(
            f"belt_grenade_{g_idx}", ("torso", "belt"),
            origin=[gx, 13.0, 1.82], r_bottom=0.34, r_top=0.38, height=1.15,
            n_sides=12, n_rings=4, axis="y", bulge=1.18,
            side_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.GRENADE_OLIVE),
        ))
        els.append(build_cylinder_mesh(
            f"belt_grenade_cap_{g_idx}", ("torso", "belt"),
            origin=[gx, 13.68, 1.82], radius=0.22, height=0.28, n_sides=10, axis="y",
            side_painter=paint_metallic_silver,
        ))
    els.append(build_beveled_box_mesh(
        "belt_mag_carrier", ("torso", "belt"),
        -0.45, 12.45, 1.72, 0.45, 13.95, 2.18, bevel=0.08,
        origin=[0, 13.2, 1.95],
        painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
    ))

    # Open-Front Flared 15-segment Trench Coat Tails (HOLLOW BOTTOM + CRIMSON/DARK LINING)
    coat_tail_levels = [
        (4.8, 3.85, 2.55, 0.16, 1.25),
        (7.8, 3.50, 2.30, 0.10, 1.12),
        (10.6, 3.15, 2.02, 0.04, 1.02),
        (13.3, 2.80, 1.80, 0.00, 0.92),
    ]
    els.append(build_open_coat_arc_mesh(
        "coat_tails_open_hollow", ("torso", "coat_tails"),
        origin=[0, 13.2, 0],
        levels=coat_tail_levels,
        outer_painter=paint_coat_tails_wrap,
        inner_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LINING_CRIMSON),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_HL),
        thickness=0.16,
        open_half_deg=28.0,
        n_arc=15,
    ))

    # =======================================================================
    # 3. SCULPTED ANATOMICAL ARMS & ARTICULATED TACTICAL GLOVES
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        shoulder_pos = [sign * 4.15, 23.4, 0.0]
        elbow_pos = [sign * 4.40, 17.8, 0.05]
        wrist_pos = [sign * 4.52, 13.6, -0.10]
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=shoulder_pos,
            elbow_pos=elbow_pos,
            wrist_pos=wrist_pos,
            radii={"shoulder": 1.24, "bicep": 1.06, "elbow": 0.84, "forearm": 0.92, "wrist": 0.70},
            sleeve_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            skin_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            glove_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
        ))
        hx, hy, hz = wrist_pos
        els.append(build_beveled_box_mesh(
            f"glove_knuckle_pad_{side}", (arm_grp, "hand"),
            hx - 0.54, hy - 1.12, hz - 0.84, hx + 0.54, hy - 0.70, hz + 0.78, bevel=0.08,
            origin=[hx, hy - 0.91, hz - 0.03],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
        ))

    # =======================================================================
    # 4. SCULPTED LEGS, FLUSH KNEE PADS, SAMURAI EDGE HOLSTER & LUGGED BOOTS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.38
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 13.5, 0.0],
            knee_pos=[lx, 7.2, 0.0],
            ankle_pos=[lx, 1.6, 0.0],
            radii={"hip": 1.28, "thigh": 1.22, "knee": 0.96, "calf": 1.08, "ankle": 0.86},
            pants_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.PANTS_BLACK, WeskerPalette.PANTS_HL),
            boot_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_BLACK),
            knee_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.PANTS_BLACK, WeskerPalette.PANTS_HL),
        ))
        # Curved Knee Pad + Flush Elliptical Strap
        els.append(build_armor_plate(
            f"knee_pad_{side}", (leg_grp, "knee"),
            origin=[lx, 7.25, -1.16], width=1.65, height=1.50, thickness=0.28,
            curve_z=0.35, bevel=0.12,
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
            trim_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.LEATHER_DARK),
        ))
        els.append(build_muscular_limb_mesh(
            f"knee_strap_{side}", (leg_grp, "knee"),
            origin=[lx, 7.25, -0.12],
            ring_specs=[
                (lx, 7.02, -0.12, 1.04, 1.13),
                (lx, 7.48, -0.12, 1.04, 1.13),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
        ))
        # Flush Elliptical Boot Cuff Strap & Buckle
        els.append(build_muscular_limb_mesh(
            f"boot_cuff_strap_{side}", (leg_grp, "boot"),
            origin=[lx, 6.2, 0.08],
            ring_specs=[
                (lx, 5.99, 0.08, 1.03, 1.15),
                (lx, 6.41, 0.08, 1.03, 1.15),
            ],
            n_sides=14,
            side_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
        ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", (leg_grp, "boot"),
            origin=[lx + sign * 1.00, 6.2, 0.08], width=0.35, height=0.48, depth=0.18,
            rotation=[0, -sign * 90, 0],
            frame_painter=paint_metallic_silver,
        ))
        # Boot Laces (5 horizontal cross-laces seated flush on shin front)
        for l_idx, (ly, lz) in enumerate([(2.2, -0.84), (3.0, -0.88), (3.8, -0.92), (4.6, -0.96), (5.4, -0.96)]):
            els.append(build_cylinder_mesh(
                f"boot_lace_{side}_{l_idx}", (leg_grp, "boot"),
                origin=[lx, ly, lz], radius=0.07, height=0.92, n_sides=8, axis="x",
                side_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.STITCH_GRAY),
            ))
        # Boot Foot, Toe Cap & Lugged Tread Sole
        els.append(build_beveled_box_mesh(
            f"boot_foot_{side}", (leg_grp, "foot"),
            lx - 0.92, 0.45, -2.35, lx + 0.92, 1.85, 1.05, bevel=0.18,
            origin=[lx, 1.2, -0.5],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_BLACK),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_toecap_{side}", (leg_grp, "foot"),
            lx - 0.88, 0.50, -2.42, lx + 0.88, 1.45, -1.35, bevel=0.16,
            origin=[lx, 0.98, -1.88],
            painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", (leg_grp, "foot"),
            lx - 0.98, 0.0, -2.45, lx + 0.98, 0.52, 1.12, bevel=0.08,
            origin=[lx, 0.25, -0.5],
            painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.BOOT_SOLE),
        ))

    # Samurai Edge Pistol & Flush Elliptical Thigh Holster Rig on Right Leg (-X)
    els.append(build_muscular_limb_mesh(
        "holster_leg_strap_top", ("right_leg", "thigh"),
        origin=[-1.38, 11.6, -0.06],
        ring_specs=[
            (-1.38, 11.41, -0.06, 1.25, 1.30),
            (-1.38, 11.79, -0.06, 1.25, 1.30),
        ],
        n_sides=14,
        side_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
    ))
    els.append(build_muscular_limb_mesh(
        "holster_leg_strap_bot", ("right_leg", "thigh"),
        origin=[-1.38, 9.8, -0.07],
        ring_specs=[
            (-1.38, 9.61, -0.07, 1.18, 1.23),
            (-1.38, 9.99, -0.07, 1.18, 1.23),
        ],
        n_sides=14,
        side_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
    ))
    els.append(build_pouch_mesh(
        "thigh_holster_r", ("right_leg", "thigh"),
        origin=[-2.50, 10.7, 0.05], width=0.68, height=2.65, depth=1.55,
        body_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_MID),
        flap_painter=lambda w, h: paint_leather_highlight(w, h, WeskerPalette.LEATHER_DARK),
        buckle_painter=paint_metallic_silver,
    ))
    # Samurai Edge Pistol (Grip + Slide + Barrel + Trigger Guard)
    els.append(build_beveled_box_mesh(
        "samurai_edge_grip", ("right_leg", "thigh"),
        -2.70, 11.95, -0.15, -2.26, 13.15, 0.72, bevel=0.07,
        origin=[-2.48, 12.5, 0.28], rotation=[24, 0, 0],
        painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.GUN_WOOD),
    ))
    els.append(build_beveled_box_mesh(
        "samurai_edge_slide", ("right_leg", "thigh"),
        -2.68, 11.75, -0.88, -2.28, 12.40, 0.55, bevel=0.06,
        origin=[-2.48, 12.08, -0.16], rotation=[85, 0, 0],
        painter=paint_metallic_silver,
    ))
    els.append(build_cylinder_mesh(
        "samurai_edge_barrel", ("right_leg", "thigh"),
        origin=[-2.48, 11.15, -0.45], radius=0.12, height=0.75, n_sides=10, axis="y",
        side_painter=lambda w, h: paint_solid_shaded(w, h, WeskerPalette.GUN_DARK),
    ))

    return els


def main():
    print("[1/3] Building Ultra-High-Detail Albert Wesker (target_height=30.5u)...")
    els = build_wesker_elements()

    group_origins = {
        "head": [0, 24.8, 0],
        "torso": [0, 13.5, 0],
        "left_arm": [4.0, 23.4, 0],
        "left_arm/forearm": [4.4, 17.5, 0],
        "right_arm": [-4.0, 23.4, 0],
        "right_arm/forearm": [-4.4, 17.5, 0],
        "left_leg": [1.38, 13.5, 0],
        "right_leg": [-1.38, 13.5, 0],
    }

    scale = scale_elements_to_height(els, group_origins, target_height=30.5)
    print(f"      Elements: {len(els)} | Uniform scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas with AO & specular highlights...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=WeskerPalette.LEATHER_BLACK, max_face_size=128)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    atlas.save(os.path.join(base_dir, "output", "wesker_texture.png"), format="PNG")

    targets = [
        os.path.join(base_dir, "output", "wesker.bbmodel"),
        os.path.join(base_dir, "output", "albert_wesker.bbmodel"),
    ]
    print("[3/3] Exporting .bbmodel files...")
    export_bbmodel(els, atlas, "albert_wesker", targets, group_origins=group_origins)
    print("[DONE] Albert Wesker generated successfully!")


if __name__ == "__main__":
    main()
