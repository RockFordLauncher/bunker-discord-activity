#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Rem (Re:Zero) Maid Polygonal 3D Generator (.bbmodel)
Upgraded to 1024x1024 atlas, 12-16 segment smooth meshes (16-segment wide bell skirt + petticoat),
120+ elements, 3500+ faces, 18+ asymmetrical sky-blue hair strands, 3-piece ruffled headdress,
multi-petal pink flower hairpin + purple ribbons, choker with bell, 3D apron, back waist bow,
and exact target_height = 24.6 units (shortest!).
"""

import os
import math
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    Cuboid,
    build_lofted_mesh,
    make_ellipse_ring,
    build_sculpted_head_mesh,
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


class RemPalette:
    SKIN_BASE = (255, 241, 233, 255)
    SKIN_HL = (255, 249, 245, 255)
    SKIN_SHADOW = (240, 202, 186, 255)
    SKIN_DEEP = (220, 174, 156, 255)
    BLUSH_LIGHT = (254, 194, 202, 255)
    BLUSH_ACCENT = (244, 128, 144, 255)

    HAIR_HL = (195, 238, 255, 255)
    HAIR_LIGHT = (118, 210, 255, 255)
    HAIR_MID = (52, 184, 245, 255)
    HAIR_BASE = (22, 156, 224, 255)
    HAIR_SHADE = (8, 122, 188, 255)

    EYE_LASH = (14, 20, 36, 255)
    EYE_PUPIL = (10, 62, 102, 255)
    EYE_IRIS_TOP = (4, 122, 192, 255)
    EYE_IRIS_MID = (24, 172, 238, 255)
    EYE_IRIS_GLOW = (165, 224, 254, 255)
    SCLERA = (255, 255, 255, 255)
    MOUTH = (228, 84, 92, 255)

    FLOWER_BASE = (236, 72, 153, 255)
    FLOWER_HL = (249, 168, 212, 255)
    FLOWER_CORE = (253, 224, 71, 255)
    RIBBON_PURPLE = (168, 85, 247, 255)
    RIBBON_SHADOW = (126, 34, 206, 255)
    BELL_GOLD = (245, 196, 66, 255)

    DRESS_BLACK = (24, 24, 30, 255)
    DRESS_DARK = (12, 12, 16, 255)
    DRESS_HL = (46, 48, 58, 255)

    WHITE_LACE = (255, 255, 255, 255)
    WHITE_SHADOW = (218, 224, 238, 255)
    STOCKING_WHITE = (250, 250, 254, 255)
    SHOE_BLACK = (12, 12, 16, 255)
    SHOE_SOLE = (6, 6, 8, 255)


def paint_rem_face_64(w, h):
    """Dedicated 64x64 front face texture: authentic Re:Zero Rem anime eyes (compact, round-oval, gentle lashes)."""
    img = Image.new("RGBA", (w, h), RemPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    # Chin AO
    for y in range(int(h * 0.85), h):
        d.line([(0, y), (w - 1, y)], fill=RemPalette.SKIN_SHADOW)

    # Top hairline (covers forehead top edge so zero bald gap even under bangs)
    hair_h = int(h * 0.20)
    d.rectangle([0, 0, w - 1, hair_h], fill=RemPalette.HAIR_MID)
    for y in range(hair_h + 1, hair_h + 5):
        f = (y - hair_h) / 5.0
        c = tuple(int(RemPalette.SKIN_DEEP[i] * (1 - f) + RemPalette.SKIN_BASE[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)

    eye_y0 = int(h * 0.43)
    eye_y1 = int(h * 0.60)
    eye_h = eye_y1 - eye_y0
    eye_w = int(w * 0.21)

    for cx in [int(w * 0.28), int(w * 0.72)]:
        ex0 = cx - eye_w // 2
        ex1 = cx + eye_w // 2
        d.rectangle([ex0 + 1, eye_y0 + 2, ex1 - 1, eye_y1 - 1], fill=RemPalette.SCLERA)
        d.line([(ex0 + 1, eye_y0), (ex1 - 1, eye_y0)], fill=RemPalette.EYE_LASH)
        d.line([(ex0, eye_y0 + 1), (ex1, eye_y0 + 1)], fill=RemPalette.EYE_LASH)
        d.line([(ex0 + 3, eye_y1), (ex1 - 3, eye_y1)], fill=(120, 128, 150, 255))

        ix0, ix1 = ex0 + 2, ex1 - 2
        for gy in range(eye_y0 + 2, eye_y1):
            t = (gy - (eye_y0 + 2)) / max(1, eye_h - 3)
            ic = RemPalette.EYE_IRIS_TOP if t < 0.35 else (
                RemPalette.EYE_IRIS_MID if t < 0.72 else RemPalette.EYE_IRIS_GLOW
            )
            d.line([(ix0, gy), (ix1, gy)], fill=ic)

        d.rectangle([cx - 2, eye_y0 + 4, cx + 2, eye_y0 + 7], fill=RemPalette.EYE_PUPIL)
        d.rectangle([ix0, eye_y0 + 2, ix0 + 1, eye_y0 + 3], fill=RemPalette.SCLERA)
        d.point((ix1 - 1, eye_y1 - 2), fill=RemPalette.SCLERA)

    brow_y = eye_y0 - 4
    for cx in [int(w * 0.28), int(w * 0.72)]:
        d.line([(cx - 4, brow_y + 1), (cx + 4, brow_y)], fill=RemPalette.HAIR_SHADE)

    blush_y = eye_y1 + 2
    for cx in [int(w * 0.25), int(w * 0.75)]:
        d.rectangle([cx - 4, blush_y, cx + 4, blush_y + 1], fill=RemPalette.BLUSH_LIGHT)
        d.point((cx - 1, blush_y), fill=RemPalette.BLUSH_ACCENT)
        d.point((cx + 2, blush_y), fill=RemPalette.BLUSH_ACCENT)

    mid_x = w // 2
    d.point((mid_x, int(h * 0.67)), fill=RemPalette.SKIN_SHADOW)
    mouth_y = int(h * 0.79)
    d.line([(mid_x - 2, mouth_y), (mid_x + 2, mouth_y)], fill=RemPalette.MOUTH)
    return img


def paint_sky_hair(w, h):
    """Smooth continuous cel-shaded sky-blue anime hair gradient."""
    img = Image.new("RGBA", (w, h), RemPalette.HAIR_MID)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.30:
            f = t / 0.30
            c0, c1 = RemPalette.HAIR_MID, RemPalette.HAIR_LIGHT
        else:
            f = (t - 0.30) / 0.70
            c0, c1 = RemPalette.HAIR_LIGHT, RemPalette.HAIR_SHADE
        c = tuple(int(c0[i] * (1 - f) + c1[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)
    return img


def paint_maid_corset_wrap(w, h):
    """Maid corset with exposed collarbone/cleavage skin, white front pinafore, black lacing & AO."""
    img = Image.new("RGBA", (w, h), RemPalette.DRESS_BLACK)
    d = ImageDraw.Draw(img)
    mid_x = int(w * 0.25)
    pinafore_hw = max(3, int(w * 0.08))
    top_skin_h = int(h * 0.24)
    d.rectangle([mid_x - pinafore_hw, 0, mid_x + pinafore_hw, top_skin_h], fill=RemPalette.SKIN_BASE)
    d.rectangle([mid_x - pinafore_hw, top_skin_h, mid_x + pinafore_hw, h - 1], fill=RemPalette.WHITE_LACE)
    for y in range(top_skin_h + 2, h - 2, 3):
        d.line([(mid_x - 2, y), (mid_x + 2, y)], fill=RemPalette.DRESS_BLACK)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=RemPalette.WHITE_SHADOW)
    return img


def paint_maid_skirt_wrap(w, h):
    """Wide pleated black maid skirt with scalloped white lace hem, waist AO & white front apron."""
    img = Image.new("RGBA", (w, h), RemPalette.DRESS_BLACK)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 5 == 0:
            d.line([(x, 0), (x, h - 1)], fill=RemPalette.DRESS_HL)
        elif x % 5 == 2:
            d.line([(x, 0), (x, h - 1)], fill=RemPalette.DRESS_DARK)

    d.line([(0, 0), (w - 1, 0)], fill=RemPalette.DRESS_DARK)
    lace_h = max(3, int(h * 0.16))
    for y in range(h - lace_h, h):
        for x in range(w):
            if y == h - lace_h and (x % 2 == 0):
                d.point((x, y), fill=RemPalette.WHITE_SHADOW)
            else:
                d.point((x, y), fill=RemPalette.WHITE_LACE)

    mid_x = int(w * 0.25)
    ap_hw = max(5, int(w * 0.12))
    d.rectangle([mid_x - ap_hw, 0, mid_x + ap_hw, h - lace_h - 1], fill=RemPalette.WHITE_LACE)
    d.line([(mid_x - ap_hw, 0), (mid_x - ap_hw, h - lace_h - 1)], fill=RemPalette.WHITE_SHADOW)
    d.line([(mid_x + ap_hw, 0), (mid_x + ap_hw, h - lace_h - 1)], fill=RemPalette.WHITE_SHADOW)
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


def build_rem_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED ANIME HEAD + 18+ ASYMMETRICAL SKY-BLUE HAIR STRANDS
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_anime_mesh", ("head", "face"),
        origin=[0, 18.8, 0], y_bot=18.8, y_top=23.0, width=4.0, depth=3.9,
        face_painter=paint_rem_face_64,
        hair_painter=paint_sky_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
    ))

    # 12-Segment Full Top & Back Hair Volume Cap (zero bald spots!)
    crown_rings = [
        make_ellipse_ring(0, 21.70, 0.02, 2.18, 2.12, n_pts=12),
        make_ellipse_ring(0, 22.30, 0.03, 2.20, 2.14, n_pts=12),
        make_ellipse_ring(0, 22.85, 0.05, 2.12, 2.06, n_pts=12),
        make_ellipse_ring(0, 23.30, 0.08, 1.65, 1.65, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "hair_full_crown_mesh", ("head", "hair"), crown_rings,
        origin=[0, 22.5, 0.05],
        side_painter=paint_sky_hair,
        cap_top_painter=paint_sky_hair,
        tex_scale=6,
    ))

    # 12-Segment Rounded Bob Back Hair
    bob_rings = [
        make_ellipse_ring(0, 18.4, 0.45, 2.12, 1.80, n_pts=12),
        make_ellipse_ring(0, 19.6, 0.40, 2.20, 1.88, n_pts=12),
        make_ellipse_ring(0, 20.9, 0.35, 2.22, 1.92, n_pts=12),
        make_ellipse_ring(0, 22.2, 0.25, 2.16, 1.88, n_pts=12),
    ]
    bob_back_rings = [[(x, y, max(-0.25, z)) for (x, y, z) in r] for r in bob_rings]
    els.append(build_lofted_mesh(
        "hair_bob_back_mesh", ("head", "hair"), bob_back_rings,
        origin=[0, 20.5, 0.3],
        side_painter=paint_sky_hair,
        cap_top_painter=paint_sky_hair,
        tex_scale=6,
    ))

    # 20 Pointed 3D Asymmetrical Bangs & Bob Strands
    bang_specs = [
        # Right-side sweeping bangs draping across right eye (-X)
        ("sweep_r1", (-1.10, 22.80, -2.08), [-3, 0, -14], 1.15, 0.38, 2.95, (0.30, -0.05), 1.1),
        ("sweep_r2", (-0.35, 22.90, -2.14), [-4, 0, -18], 1.05, 0.38, 2.65, (0.28, -0.05), 1.1),
        ("sweep_r3", (-1.68, 22.45, -1.85), [-2, 14, -8], 0.85, 0.42, 3.20, (0.12, 0.0), 1.1),
        ("sweep_r4", (-0.72, 22.88, -2.16), [-4, 4, -15], 0.72, 0.32, 2.75, (0.24, -0.06), 1.1),
        ("sweep_r5", (-1.42, 22.72, -1.96), [-3, 10, -11], 0.75, 0.36, 3.05, (0.18, -0.04), 1.1),
        # Left-side shorter bangs above open left eye (+X)
        ("left_short1", (0.55, 22.92, -2.12), [-3, 0, 10], 0.88, 0.35, 1.55, (-0.15, -0.05), 1.1),
        ("left_short2", (1.15, 22.78, -2.02), [-3, -8, 12], 0.82, 0.36, 1.85, (-0.12, -0.04), 1.1),
        ("left_short3", (1.62, 22.45, -1.80), [-3, -16, 14], 0.80, 0.40, 2.25, (-0.10, 0.0), 1.1),
        # Temple bridges & cheek-hugging sidelocks
        ("temple_bridge_l", (1.78, 22.70, -1.32), [-2, -28, 10], 0.85, 0.60, 2.70, (-0.10, 0.0), 1.1),
        ("temple_bridge_r", (-1.78, 22.70, -1.32), [-2, 28, -10], 0.85, 0.60, 2.70, (0.10, 0.0), 1.1),
        ("sidelock_l", (1.94, 22.10, -0.50), [2, 0, 5], 0.65, 0.85, 3.95, (-0.12, 0.0), 1.1),
        ("sidelock_r", (-1.94, 22.10, -0.50), [2, 0, -5], 0.65, 0.85, 3.95, (0.12, 0.0), 1.1),
        ("sidelock_inner_l", (1.82, 21.60, -0.85), [3, -12, 6], 0.52, 0.50, 3.40, (-0.14, 0.05), 1.1),
        ("sidelock_inner_r", (-1.82, 21.60, -0.85), [3, 12, -6], 0.52, 0.50, 3.40, (0.14, 0.05), 1.1),
        # Layered Bob Back Strands (curved inward at tips)
        ("bob_l1", (1.65, 21.80, 0.90), [8, -10, 8], 0.95, 0.65, 3.65, (-0.25, -0.15), 1.15),
        ("bob_r1", (-1.65, 21.80, 0.90), [8, 10, -8], 0.95, 0.65, 3.65, (0.25, -0.15), 1.15),
        ("bob_l2", (0.85, 21.90, 1.75), [12, -6, 4], 1.10, 0.65, 3.70, (-0.12, -0.18), 1.15),
        ("bob_r2", (-0.85, 21.90, 1.75), [12, 6, -4], 1.10, 0.65, 3.70, (0.12, -0.18), 1.15),
        ("bob_c", (0.0, 22.00, 1.92), [14, 0, 0], 1.25, 0.65, 3.75, (0.0, -0.20), 1.15),
        ("ahoge", (0.0, 23.25, 0.10), [150, 12, 18], 0.35, 0.28, 1.15, (0.18, 0.15), 1.05),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair", "bangs"), [0.0, 0.0, 0.0], bang_specs,
        painter=paint_sky_hair, n_sides=6, n_rings=4,
    ))

    # 3-Piece Ruffled Maid Headdress + 6 Lace Pleats
    els.append(build_beveled_box_mesh(
        "headdress_band", ("head", "headdress"),
        -2.05, 22.75, -0.55, 2.05, 23.55, 0.45, bevel=0.14,
        origin=[0, 23.1, -0.05],
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
    ))
    for side, sx, rz in [("l", 1.65, -28), ("r", -1.65, 28)]:
        els.append(build_beveled_box_mesh(
            f"headdress_frill_{side}", ("head", "headdress"),
            sx - 0.50, 22.2, -0.5, sx + 0.50, 23.1, 0.35, bevel=0.10,
            origin=[sx, 22.65, -0.05], rotation=[0, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        ))
    for p_idx, px in enumerate([-1.35, -0.80, -0.28, 0.28, 0.80, 1.35]):
        els.append(build_beveled_box_mesh(
            f"headdress_pleat_{p_idx}", ("head", "headdress"),
            px - 0.22, 23.2, -0.68, px + 0.22, 23.72, -0.35, bevel=0.06,
            origin=[px, 23.45, -0.50], rotation=[-12, 0, px * -8],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        ))

    # 3D Multi-Petal Pink Flower Hairpin (5 Petals + Center Bud) + Dual Purple Ribbons
    fx, fy, fz = 2.02, 21.92, -1.35
    els.append(build_cylinder_mesh(
        "flower_center_bud", ("head", "headdress"),
        origin=[fx + 0.12, fy, fz], radius=0.16, height=0.18, n_sides=12, axis="x",
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.FLOWER_CORE),
    ))
    for p_idx in range(5):
        ang = 2.0 * math.pi * p_idx / 5.0
        py = fy + 0.24 * math.cos(ang)
        pz = fz + 0.24 * math.sin(ang)
        els.append(build_beveled_box_mesh(
            f"flower_petal_{p_idx}", ("head", "headdress"),
            fx - 0.10, py - 0.18, pz - 0.18, fx + 0.16, py + 0.18, pz + 0.18, bevel=0.08,
            origin=[fx, py, pz], rotation=[p_idx * 72, 12, 10],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.FLOWER_BASE if p_idx % 2 == 0 else RemPalette.FLOWER_HL),
        ))
    els.append(build_hair_strand_mesh(
        "ribbon_tail_1", ("head", "headdress"), [2.05, 21.7, -1.2], [10, 0, 16],
        0.35, 0.14, 2.25, tip_offset=(0.2, 0.2),
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.RIBBON_PURPLE),
    ))
    els.append(build_hair_strand_mesh(
        "ribbon_tail_2", ("head", "headdress"), [2.10, 21.7, -1.0], [18, 0, 26],
        0.30, 0.14, 1.95, tip_offset=(0.3, 0.3),
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.RIBBON_SHADOW),
    ))

    # =======================================================================
    # 2. NECK, CHOKER WITH BELL, CORSET & SCULPTED FEMININE BUST
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 18.0, 0.0, 0.80, 0.80, n_pts=12),
        make_ellipse_ring(0, 19.1, 0.0, 0.72, 0.74, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "neck"), neck_rings,
        origin=[0, 18.2, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
        tex_scale=6,
    ))
    choker_rings = [
        make_ellipse_ring(0, 18.3, 0.0, 0.88, 0.88, n_pts=12),
        make_ellipse_ring(0, 18.75, 0.0, 0.88, 0.88, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "maid_choker", ("torso", "neck"), choker_rings,
        origin=[0, 18.5, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.DRESS_BLACK),
        tex_scale=6,
    ))
    els.append(build_tapered_cylinder(
        "choker_bell", ("torso", "neck"),
        origin=[0.0, 18.32, -0.96], r_bottom=0.20, r_top=0.14, height=0.34,
        n_sides=12, n_rings=3, axis="y", bulge=1.25,
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.BELL_GOLD, metallic=True),
    ))

    # 12-Segment Compact Hourglass Corset Bodice
    corset_rings = [
        make_ellipse_ring(0, 12.2, 0.0, 1.85, 1.25, n_pts=12),
        make_ellipse_ring(0, 13.8, 0.0, 2.08, 1.40, n_pts=12),
        make_ellipse_ring(0, 15.3, -0.08, 2.32, 1.62, n_pts=12),
        make_ellipse_ring(0, 16.5, -0.15, 2.52, 1.78, n_pts=12),
        make_ellipse_ring(0, 18.1, 0.0, 3.05, 1.40, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "corset_bodice_mesh", ("torso", "corset"), corset_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_maid_corset_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.DRESS_DARK),
        tex_scale=6,
    ))

    # Smooth Sculpted Feminine Bust at proper upper-chest height (replaces boxy bricks)
    els.append(build_sculpted_bust_mesh(
        "rem_sculpted_bust", ("torso", "corset"),
        origin=[0.0, 16.3, -1.35],
        chest_y_bot=15.05,
        chest_y_top=17.45,
        bust_z_front=-2.38,
        width=3.88,
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.DRESS_BLACK),
        cleavage_depth=0.22,
    ))
    # Front Corset Ribbon Bow (knot + left/right wings + flush corset lacing bars)
    els.append(build_beveled_box_mesh(
        "chest_bow_knot", ("torso", "corset"),
        -0.25, 16.95, -2.18, 0.25, 17.40, -1.78, bevel=0.08,
        origin=[0, 17.18, -1.98],
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
    ))
    for side, sx, rz in [("l", 0.48, -14), ("r", -0.48, 14)]:
        els.append(build_beveled_box_mesh(
            f"chest_bow_wing_{side}", ("torso", "corset"),
            sx - 0.42, 16.90, -2.14, sx + 0.42, 17.45, -1.76, bevel=0.08,
            origin=[sx, 17.18, -1.95], rotation=[0, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        ))
    for l_idx, (ly, lz) in enumerate([(13.0, -1.34), (13.9, -1.46), (14.8, -1.62), (15.7, -2.02)]):
        els.append(build_beveled_box_mesh(
            f"corset_lace_bar_{l_idx}", ("torso", "corset"),
            -0.28, ly - 0.08, lz - 0.12, 0.28, ly + 0.08, lz + 0.10, bevel=0.03,
            origin=[0, ly, lz],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_SHADOW),
        ))

    # =======================================================================
    # 3. WIDE LUSH 16-SEGMENT BELL SKIRT + PETTICOAT + 3D APRON + BACK BOW
    # =======================================================================
    skirt_rings = [
        make_ellipse_ring(0, 6.2, 0.0, 5.30, 4.55, n_pts=16),
        make_ellipse_ring(0, 7.8, 0.0, 4.75, 4.02, n_pts=16),
        make_ellipse_ring(0, 9.4, 0.0, 3.95, 3.25, n_pts=16),
        make_ellipse_ring(0, 11.0, 0.0, 2.95, 2.25, n_pts=16),
        make_ellipse_ring(0, 12.4, 0.0, 1.95, 1.35, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "maid_bell_skirt_mesh", ("torso", "skirt"), skirt_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_maid_skirt_wrap,
        cap_bot_painter=None,
        tex_scale=5,
    ))

    # 16-Segment Inner White Lace Petticoat (hollow bottom)
    petticoat_rings = [
        make_ellipse_ring(0, 5.5, 0.0, 5.05, 4.30, n_pts=16),
        make_ellipse_ring(0, 6.1, 0.0, 4.95, 4.20, n_pts=16),
        make_ellipse_ring(0, 6.6, 0.0, 4.85, 4.10, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "skirt_lace_petticoat", ("torso", "skirt"), petticoat_rings,
        origin=[0, 12.2, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        cap_bot_painter=None,
        tex_scale=5,
    ))

    # 3D Front Apron Panel (skirt-hugging front-arc mesh, zero forward spike!) + Waistband
    apron_levels = [
        (6.9, 5.05, 4.32),
        (8.2, 4.55, 3.84),
        (9.6, 3.82, 3.14),
        (11.0, 2.92, 2.24),
        (12.35, 2.02, 1.42),
    ]
    apron_rings = []
    n_arc = 9
    for ay, rx, rz in apron_levels:
        outer_pts = []
        inner_pts = []
        for i in range(n_arc):
            ang = math.radians(-34.0 + 68.0 * i / (n_arc - 1))
            outer_pts.append(((rx + 0.14) * math.sin(ang), ay, -(rz + 0.14) * math.cos(ang)))
        for i in range(n_arc - 1, -1, -1):
            ang = math.radians(-34.0 + 68.0 * i / (n_arc - 1))
            inner_pts.append(((rx + 0.02) * math.sin(ang), ay, -(rz + 0.02) * math.cos(ang)))
        apron_rings.append(outer_pts + inner_pts)
    els.append(build_lofted_mesh(
        "apron_front_3d", ("torso", "skirt"), apron_rings,
        origin=[0.0, 9.6, -2.5],
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_SHADOW),
        tex_scale=5,
    ))
    apron_band_rings = [
        make_ellipse_ring(0, 11.95, 0.0, 2.02, 1.42, n_pts=16),
        make_ellipse_ring(0, 12.45, 0.0, 2.02, 1.42, n_pts=16),
    ]
    els.append(build_lofted_mesh(
        "apron_waistband", ("torso", "skirt"), apron_band_rings,
        origin=[0, 12.2, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        tex_scale=5,
    ))

    # Large 3D Back Waist Bow & Flowing Ribbon Tails (draping backward +Z outside skirt)
    els.append(build_beveled_box_mesh(
        "waist_bow_knot", ("torso", "skirt"),
        -0.45, 11.7, 1.35, 0.45, 12.6, 2.0, bevel=0.12,
        origin=[0, 12.15, 1.65],
        painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
    ))
    for side, sx, rz in [("l", 0.95, -15), ("r", -0.95, 15)]:
        els.append(build_beveled_box_mesh(
            f"waist_bow_wing_{side}", ("torso", "skirt"),
            sx - 0.78, 11.5, 1.45, sx + 0.78, 12.8, 2.1, bevel=0.14,
            origin=[sx, 12.15, 1.75], rotation=[0, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
        ))
        els.append(build_hair_strand_mesh(
            f"waist_bow_tail_{side}", ("torso", "skirt"),
            [sx * 0.6, 11.7, 1.85], [-32, 0, rz * 0.6], 0.55, 0.25, 3.65,
            tip_offset=(sx * 0.35, 0.45),
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_SHADOW),
        ))

    # =======================================================================
    # 4. ANATOMICAL ARMS, PUFFY DETACHED SLEEVES & ARTICULATED HANDS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        sx = sign * 2.95
        els.extend(build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=[sx, 17.6, 0.0],
            elbow_pos=[sx + sign * 0.25, 13.8, 0.0],
            wrist_pos=[sx + sign * 0.32, 10.2, -0.08],
            radii={"shoulder": 0.72, "bicep": 0.60, "elbow": 0.50, "forearm": 0.54, "wrist": 0.42},
            sleeve_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
            skin_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SKIN_BASE),
        ))
        # Puffy Black Detached Sleeve + 2-Tier White Lace Cuffs flush over arm
        px = sx + sign * 0.18
        puff_rings = [
            make_ellipse_ring(px + sign * 0.08, 13.4, 0.0, 0.88, 0.92, n_pts=12),
            make_ellipse_ring(px + sign * 0.06, 14.5, 0.0, 0.96, 1.00, n_pts=12),
            make_ellipse_ring(px + sign * 0.04, 15.6, 0.0, 0.94, 0.98, n_pts=12),
            make_ellipse_ring(px, 16.7, 0.0, 0.72, 0.75, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"puffy_sleeve_{side}", (arm_grp, "arm"), puff_rings,
            origin=[px, 16.5, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.DRESS_BLACK),
            cap_top_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
            cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
            tex_scale=5,
        ))
        top_frill_rings = [
            make_ellipse_ring(px, 16.45, 0.0, 0.82, 0.85, n_pts=12),
            make_ellipse_ring(px, 16.85, 0.0, 0.82, 0.85, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"sleeve_top_frill_{side}", (arm_grp, "arm"), top_frill_rings,
            origin=[px, 16.65, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
            tex_scale=6,
        ))
        cuff_rings = [
            make_ellipse_ring(px + sign * 0.08, 12.95, 0.0, 0.92, 0.95, n_pts=12),
            make_ellipse_ring(px + sign * 0.08, 13.55, 0.0, 0.90, 0.93, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"sleeve_lace_cuff_{side}", (arm_grp, "arm"), cuff_rings,
            origin=[px + sign * 0.08, 13.25, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_LACE),
            tex_scale=6,
        ))
        cuff_inner_rings = [
            make_ellipse_ring(px + sign * 0.08, 12.60, 0.0, 0.80, 0.83, n_pts=12),
            make_ellipse_ring(px + sign * 0.08, 13.05, 0.0, 0.82, 0.85, n_pts=12),
        ]
        els.append(build_lofted_mesh(
            f"sleeve_lace_tier2_{side}", (arm_grp, "arm"), cuff_inner_rings,
            origin=[px + sign * 0.08, 12.83, 0],
            side_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_SHADOW),
            tex_scale=6,
        ))

    # =======================================================================
    # 5. ANATOMICAL LEGS IN WHITE STOCKINGS & MARY JANE SHOES
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        leg_grp = f"{side}_leg"
        lx = sign * 1.15
        els.extend(build_anatomical_leg_parts(
            side=side,
            sign=sign,
            leg_grp=leg_grp,
            hip_pos=[lx, 11.2, 0.0],
            knee_pos=[lx, 5.6, 0.0],
            ankle_pos=[lx, 1.3, 0.0],
            radii={"hip": 0.94, "thigh": 0.88, "knee": 0.68, "calf": 0.74, "ankle": 0.54},
            pants_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.STOCKING_WHITE),
            boot_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.STOCKING_WHITE),
            knee_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.STOCKING_WHITE),
        ))
        els.append(build_beveled_box_mesh(
            f"mary_jane_shoe_{side}", (leg_grp, "foot"),
            lx - 0.74, 0.32, -1.85, lx + 0.74, 1.35, 0.80, bevel=0.15,
            origin=[lx, 0.85, -0.4],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SHOE_BLACK),
        ))
        els.append(build_beveled_box_mesh(
            f"shoe_strap_{side}", (leg_grp, "foot"),
            lx - 0.78, 1.15, -0.58, lx + 0.78, 1.46, -0.14, bevel=0.05,
            origin=[lx, 1.30, -0.35],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.DRESS_HL),
        ))
        els.extend(build_buckle_assembly(
            f"shoe_buckle_{side}", (leg_grp, "foot"),
            origin=[lx + sign * 0.78, 1.30, -0.35], width=0.28, height=0.28, depth=0.10,
            rotation=[0, 90 * sign, 0],
            frame_painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.WHITE_SHADOW, metallic=True),
        ))
        els.append(build_beveled_box_mesh(
            f"shoe_sole_{side}", (leg_grp, "foot"),
            lx - 0.78, 0.0, -1.92, lx + 0.78, 0.35, 0.86, bevel=0.06,
            origin=[lx, 0.18, -0.4],
            painter=lambda w, h: paint_solid_shaded(w, h, RemPalette.SHOE_SOLE),
        ))

    return els


def main():
    print("[1/3] Building high-detail polygonal Rem Maid (target_height=24.6)...")
    els = build_rem_elements()

    group_origins = {
        "head": [0, 18.8, 0],
        "torso": [0, 12.2, 0],
        "left_arm": [2.9, 17.8, 0],
        "left_arm/forearm": [3.3, 13.0, 0],
        "right_arm": [-2.9, 17.8, 0],
        "right_arm/forearm": [-3.3, 13.0, 0],
        "left_leg": [1.15, 11.0, 0],
        "right_leg": [-1.15, 11.0, 0],
    }

    scale = scale_elements_to_height(els, group_origins, 24.6)
    print(f"      Elements: {len(els)}, Uniform Scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=RemPalette.DRESS_BLACK)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(base_dir, "output"), exist_ok=True)
    atlas.save(os.path.join(base_dir, "output", "rem_maid_texture.png"), format="PNG")

    targets = [
        os.path.join(base_dir, "output", "rem_maid.bbmodel"),
        os.path.join(base_dir, "output", "anime_character.bbmodel"),
    ]

    print("[3/3] Exporting output/rem_maid.bbmodel & output/anime_character.bbmodel...")
    export_bbmodel(els, atlas, "rem_maid", targets, group_origins=group_origins)
    print("[DONE] Rem Maid generated!")


if __name__ == "__main__":
    main()
