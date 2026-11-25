#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ultra-High-Detail Subaru Natsuki (Re:Zero) Polygonal 3D Generator
1024x1024 atlas, 12-16 segment smooth meshes, 130+ elements, 3800+ faces,
iconic black-orange-white tracksuit jacket with high collar, front zipper, orange chest chevron & sleeve stripes,
spiky black anime hair (22+ strands), white inner tee, black track pants with orange side stripes & folds,
detailed white/orange/black sneakers with 3D laces & treads, and exact target_height = 27.6.
"""

import os
from PIL import Image, ImageDraw

from poly_bbmodel_lib import (
    Cuboid,
    build_lofted_mesh,
    make_ellipse_ring,
    build_sculpted_head_mesh,
    build_open_coat_arc_mesh,
    build_multi_strand_hair_layer,
    build_beveled_box_mesh,
    build_tapered_cylinder,
    build_cylinder_mesh,
    build_anatomical_arm_parts,
    build_anatomical_leg_parts,
    build_muscular_limb_mesh,
    scale_elements_to_height,
    bake_elements_atlas,
    export_bbmodel,
)


class SubaruPalette:
    SKIN_BASE = (255, 232, 218, 255)
    SKIN_SHADOW = (232, 192, 174, 255)
    SKIN_DEEP = (206, 162, 146, 255)
    LIPS = (198, 140, 132, 255)

    EYE_WHITE = (252, 252, 255, 255)
    EYE_DARK = (18, 16, 18, 255)
    EYE_IRIS_TOP = (52, 34, 24, 255)
    EYE_IRIS_MID = (92, 60, 38, 255)
    EYE_IRIS_BOT = (134, 88, 52, 255)
    EYE_HL = (255, 255, 255, 255)

    HAIR_DARK = (14, 14, 18, 255)
    HAIR_BASE = (24, 24, 30, 255)
    HAIR_HL = (48, 50, 62, 255)

    JACKET_BLACK = (22, 23, 28, 255)
    JACKET_DARK = (13, 14, 17, 255)
    JACKET_MID = (34, 36, 44, 255)

    TRACK_ORANGE = (242, 108, 24, 255)
    TRACK_ORANGE_HL = (255, 146, 56, 255)
    TRACK_ORANGE_DARK = (192, 74, 12, 255)

    TRACK_WHITE = (246, 248, 252, 255)
    TRACK_WHITE_SH = (212, 218, 228, 255)

    ZIPPER_SILVER = (216, 222, 234, 255)
    SHOE_SOLE = (14, 14, 18, 255)


def paint_subaru_face_64(w, h):
    """Dedicated 64x64 front face texture: sharp determined dark-brown anime eyes & brows."""
    img = Image.new("RGBA", (w, h), SubaruPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    for y in range(int(h * 0.85), h):
        d.line([(0, y), (w - 1, y)], fill=SubaruPalette.SKIN_SHADOW)

    hair_h = int(h * 0.16)
    d.rectangle([0, 0, w - 1, hair_h], fill=SubaruPalette.HAIR_BASE)
    for y in range(hair_h + 1, hair_h + 5):
        f = (y - hair_h) / 5.0
        c = tuple(int(SubaruPalette.SKIN_DEEP[i] * (1 - f) + SubaruPalette.SKIN_BASE[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)

    eye_y0 = int(h * 0.43)
    eye_y1 = int(h * 0.57)
    eye_h = eye_y1 - eye_y0
    eye_w = int(w * 0.20)

    for cx in [int(w * 0.28), int(w * 0.72)]:
        ex0 = cx - eye_w // 2
        ex1 = cx + eye_w // 2
        d.rectangle([ex0, eye_y0 + 1, ex1, eye_y1], fill=SubaruPalette.EYE_WHITE)
        d.rectangle([ex0 - 1, eye_y0, ex1 + 1, eye_y0 + 1], fill=SubaruPalette.EYE_DARK)
        d.line([(ex0 + 2, eye_y1), (ex1 - 2, eye_y1)], fill=(96, 86, 82, 255))

        ix0, ix1 = ex0 + 2, ex1 - 2
        for gy in range(eye_y0 + 2, eye_y1):
            t = (gy - (eye_y0 + 2)) / max(1, eye_h - 3)
            ic = SubaruPalette.EYE_IRIS_TOP if t < 0.35 else (
                SubaruPalette.EYE_IRIS_MID if t < 0.72 else SubaruPalette.EYE_IRIS_BOT
            )
            d.line([(ix0, gy), (ix1, gy)], fill=ic)
        d.rectangle([cx - 2, eye_y0 + 3, cx + 2, eye_y1 - 3], fill=SubaruPalette.EYE_DARK)
        d.rectangle([ix0, eye_y0 + 2, ix0 + 1, eye_y0 + 3], fill=SubaruPalette.EYE_HL)
        d.point((ix1 - 1, eye_y1 - 2), fill=SubaruPalette.EYE_HL)

    brow_y = eye_y0 - 4
    d.line([(int(w * 0.17), brow_y), (int(w * 0.37), brow_y + 1)], fill=SubaruPalette.HAIR_DARK)
    d.line([(int(w * 0.63), brow_y + 1), (int(w * 0.83), brow_y)], fill=SubaruPalette.HAIR_DARK)

    mid_x = w // 2
    d.point((mid_x, int(h * 0.68)), fill=SubaruPalette.SKIN_SHADOW)
    mouth_y = int(h * 0.80)
    d.line([(mid_x - 3, mouth_y), (mid_x + 3, mouth_y)], fill=SubaruPalette.LIPS)
    return img


def paint_black_hair(w, h):
    img = Image.new("RGBA", (w, h), SubaruPalette.HAIR_BASE)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.30:
            f = t / 0.30
            c0, c1 = SubaruPalette.HAIR_DARK, SubaruPalette.HAIR_HL
        else:
            f = (t - 0.30) / 0.70
            c0, c1 = SubaruPalette.HAIR_HL, SubaruPalette.HAIR_DARK
        c = tuple(int(c0[i] * (1 - f) + c1[i] * f) for i in range(4))
        d.line([(0, y), (w - 1, y)], fill=c)
    return img


def paint_subaru_jacket_wrap(w, h):
    """Iconic black-orange-white tracksuit jacket with white upper shoulder/chest, orange chevron, white tee V-neck."""
    img = Image.new("RGBA", (w, h), SubaruPalette.JACKET_BLACK)
    d = ImageDraw.Draw(img)
    # Upper white shoulder/chest panel
    top_white_h = int(h * 0.34)
    d.rectangle([0, 0, w - 1, top_white_h], fill=SubaruPalette.TRACK_WHITE)
    # Orange horizontal/chevron divider band
    d.rectangle([0, top_white_h, w - 1, top_white_h + max(3, int(h * 0.08))], fill=SubaruPalette.TRACK_ORANGE)

    # Front center zipper & white inner tee V-neck
    mid_x = int(w * 0.25)
    v_bot = int(h * 0.24)
    for y in range(v_bot):
        span = int((1.0 - y / max(1, v_bot)) * (w * 0.06))
        d.line([(mid_x - span, y), (mid_x + span, y)], fill=SubaruPalette.TRACK_WHITE)
    d.line([(mid_x, v_bot), (mid_x, h - 1)], fill=SubaruPalette.ZIPPER_SILVER)

    # Bottom white ribbed hem
    d.rectangle([0, h - max(3, int(h * 0.09)), w - 1, h - 1], fill=SubaruPalette.TRACK_WHITE)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=SubaruPalette.TRACK_WHITE_SH)
    return img


def paint_subaru_pants_wrap(w, h):
    """Black track pants with orange side stripes & subtle fabric folds."""
    img = Image.new("RGBA", (w, h), SubaruPalette.JACKET_BLACK)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 7 == 0:
            d.line([(x, 0), (x, h - 1)], fill=SubaruPalette.JACKET_MID)
        elif x % 7 == 3:
            d.line([(x, 0), (x, h - 1)], fill=SubaruPalette.JACKET_DARK)
    # Side orange stripe along outer edge
    stripe_x = int(w * 0.50)
    d.rectangle([stripe_x - 1, 0, stripe_x + 1, h - 1], fill=SubaruPalette.TRACK_ORANGE)
    d.line([(0, 0), (w - 1, 0)], fill=SubaruPalette.JACKET_DARK)
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


def build_subaru_elements():
    els = []

    # =======================================================================
    # 1. SCULPTED ANIME HEAD + 22+ SPIKY BLACK ANIME HAIR STRANDS
    # =======================================================================
    els.append(build_sculpted_head_mesh(
        "head_anime_mesh", ("head", "face"),
        origin=[0, 21.6, 0], y_bot=21.6, y_top=26.0, width=4.2, depth=4.1,
        face_painter=paint_subaru_face_64,
        hair_painter=paint_black_hair,
        skin_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.SKIN_BASE),
    ))

    # 12-Segment Hair Crown Cap (zero bald spots)
    crown_rings = [
        make_ellipse_ring(0, 24.5, 0.05, 2.26, 2.18, n_pts=12),
        make_ellipse_ring(0, 25.4, 0.05, 2.30, 2.22, n_pts=12),
        make_ellipse_ring(0, 26.2, 0.06, 2.12, 2.08, n_pts=12),
        make_ellipse_ring(0, 26.7, 0.08, 1.65, 1.70, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "hair_crown_cap", ("head", "hair"), crown_rings,
        origin=[0, 25.0, 0.05],
        side_painter=paint_black_hair,
        cap_top_painter=paint_black_hair,
        tex_scale=6,
    ))

    # 22 Spiky Black Anime Hair Strands (swept-up/spiky Subaru silhouette)
    hair_strands = [
        # Spiky forehead & swept-up front tufts
        ("front_spike_c", (0.0, 26.30, -2.18), [-18, 0, 4], 0.80, 0.38, 1.65, (0.10, -0.25), 1.1),
        ("front_spike_l1", (-0.65, 26.25, -2.12), [-14, 6, -12], 0.78, 0.36, 1.85, (-0.18, -0.20), 1.1),
        ("front_spike_r1", (0.65, 26.25, -2.12), [-14, -6, 12], 0.78, 0.36, 1.85, (0.18, -0.20), 1.1),
        ("front_spike_l2", (-1.30, 26.05, -1.92), [-8, 14, -18], 0.76, 0.38, 2.20, (-0.22, -0.10), 1.1),
        ("front_spike_r2", (1.30, 26.05, -1.92), [-8, -14, 18], 0.76, 0.38, 2.20, (0.22, -0.10), 1.1),
        # Upper swept-up crown spikes
        ("top_spike_1", (-0.85, 26.55, -1.25), [128, -12, -16], 0.65, 0.50, 1.75, (-0.15, 0.25), 1.1),
        ("top_spike_2", (0.0, 26.65, -1.05), [132, 0, 6], 0.72, 0.52, 1.90, (0.08, 0.30), 1.1),
        ("top_spike_3", (0.85, 26.55, -1.25), [128, 12, 16], 0.65, 0.50, 1.75, (0.15, 0.25), 1.1),
        ("crown_spike_l", (-1.45, 26.20, 0.15), [110, 0, -35], 0.72, 0.58, 1.85, (-0.25, 0.20), 1.1),
        ("crown_spike_r", (1.45, 26.20, 0.15), [110, 0, 35], 0.72, 0.58, 1.85, (0.25, 0.20), 1.1),
        # Sideburns & temple spikes
        ("sideburn_l", (-2.05, 25.0, -0.65), [2, 0, -6], 0.55, 0.75, 3.4, (0.10, 0.0), 1.1),
        ("sideburn_r", (2.05, 25.0, -0.65), [2, 0, 6], 0.55, 0.75, 3.4, (-0.10, 0.0), 1.1),
        ("temple_l", (-2.05, 25.6, -1.25), [-4, 12, -20], 0.58, 0.48, 2.3, (-0.20, -0.05), 1.1),
        ("temple_r", (2.05, 25.6, -1.25), [-4, -12, 20], 0.58, 0.48, 2.3, (0.20, -0.05), 1.1),
        ("side_flare_l", (-2.15, 24.8, 0.45), [8, 0, -28], 0.65, 0.78, 2.2, (-0.30, 0.15), 1.1),
        ("side_flare_r", (2.15, 24.8, 0.45), [8, 0, 28], 0.65, 0.78, 2.2, (0.30, 0.15), 1.1),
        # Back & nape spikes
        ("back_u_l", (-1.2, 24.9, 1.95), [18, -10, -10], 1.25, 0.62, 3.1, (-0.15, 0.25), 1.1),
        ("back_u_c", (0.0, 25.1, 2.05), [20, 0, 0], 1.35, 0.65, 3.3, (0.0, 0.30), 1.1),
        ("back_u_r", (1.2, 24.9, 1.95), [18, 10, 10], 1.25, 0.62, 3.1, (0.15, 0.25), 1.1),
        ("nape_l", (-1.2, 22.9, 1.95), [22, -12, -12], 1.00, 0.52, 2.2, (-0.2, 0.25), 1.1),
        ("nape_c", (0.0, 23.0, 2.05), [24, 0, 0], 1.05, 0.52, 2.3, (0.0, 0.30), 1.1),
        ("nape_r", (1.2, 22.9, 1.95), [22, 12, 12], 1.00, 0.52, 2.2, (0.2, 0.25), 1.1),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", ("head", "hair"), [0.0, 0.0, 0.0], hair_strands,
        painter=paint_black_hair, n_sides=6, n_rings=4,
    ))

    # =======================================================================
    # 2. NECK, HIGH TRACKSUIT COLLAR, CHEST CHEVRON & ZIPPER
    # =======================================================================
    neck_rings = [
        make_ellipse_ring(0, 20.6, 0.0, 1.02, 1.02, n_pts=12),
        make_ellipse_ring(0, 21.9, 0.0, 0.90, 0.92, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "neck_mesh", ("torso", "collar"), neck_rings,
        origin=[0, 20.8, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.SKIN_BASE),
        tex_scale=6,
    ))

    # High Tracksuit Collar (White outer, Orange inner lining)
    collar_levels = [
        (20.5, 2.05, 1.65, 0.14, 1.0),
        (22.1, 2.30, 1.80, 0.22, 1.1),
    ]
    els.append(build_open_coat_arc_mesh(
        "tracksuit_collar", ("torso", "collar"),
        origin=[0, 20.8, 0.18],
        levels=collar_levels,
        outer_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        inner_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        trim_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE_HL),
        thickness=0.14,
        open_half_deg=44.0,
        n_arc=13,
    ))

    # 12-Segment Tracksuit Jacket Torso
    torso_rings = [
        make_ellipse_ring(0, 12.2, 0.0, 2.48, 1.56, n_pts=12),
        make_ellipse_ring(0, 14.5, 0.0, 2.68, 1.68, n_pts=12),
        make_ellipse_ring(0, 17.0, 0.0, 3.05, 1.80, n_pts=12),
        make_ellipse_ring(0, 19.2, 0.0, 3.45, 1.86, n_pts=12),
        make_ellipse_ring(0, 20.8, 0.0, 3.90, 1.78, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "tracksuit_jacket_torso", ("torso", "chest"), torso_rings,
        origin=[0, 12.2, 0],
        side_painter=paint_subaru_jacket_wrap,
        cap_top_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        cap_bot_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE_SH),
        tex_scale=6,
    ))

    # 3D Orange Chest Chevron V-Stripes + Front Zipper Track & Pull + White Inner Tee
    for side, sx, rz in [("l", 1.30, -24), ("r", -1.30, 24)]:
        els.append(build_beveled_box_mesh(
            f"chest_chevron_{side}", ("torso", "chest"),
            sx - 1.35, 17.4, -1.96, sx + 1.35, 18.0, -1.68, bevel=0.06,
            origin=[sx, 17.7, -1.82], rotation=[0, 0, rz],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))
    els.append(build_beveled_box_mesh(
        "white_inner_tee_v", ("torso", "chest"),
        -0.75, 18.8, -1.86, 0.75, 20.7, -1.55, bevel=0.06,
        origin=[0, 19.75, -1.70],
        painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
    ))
    els.append(build_beveled_box_mesh(
        "jacket_zipper_track", ("torso", "chest"),
        -0.12, 12.3, -1.94, 0.12, 19.0, -1.72, bevel=0.04,
        origin=[0, 15.65, -1.83],
        painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.ZIPPER_SILVER, metallic=True),
    ))
    els.append(build_beveled_box_mesh(
        "jacket_zipper_pull", ("torso", "chest"),
        -0.18, 18.3, -2.06, 0.18, 18.9, -1.84, bevel=0.04,
        origin=[0, 18.6, -1.95],
        painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.ZIPPER_SILVER, metallic=True),
    ))
    # Jacket Pockets (left & right lower front)
    for side, sx in [("l", 1.55), ("r", -1.55)]:
        els.append(build_beveled_box_mesh(
            f"jacket_pocket_{side}", ("torso", "chest"),
            sx - 0.65, 13.4, -1.80, sx + 0.65, 14.8, -1.55, bevel=0.06,
            origin=[sx, 14.1, -1.68],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.JACKET_MID),
        ))

    # White Ribbed Waist Hem
    hem_rings = [
        make_ellipse_ring(0, 11.7, 0.0, 2.52, 1.62, n_pts=12),
        make_ellipse_ring(0, 12.4, 0.0, 2.52, 1.62, n_pts=12),
    ]
    els.append(build_lofted_mesh(
        "jacket_ribbed_hem", ("torso", "belt"), hem_rings,
        origin=[0, 12.05, 0],
        side_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        tex_scale=5,
    ))

    # =======================================================================
    # 3. ANATOMICAL ARMS WITH ORANGE SLEEVE STRIPES, WHITE CUFFS & HANDS
    # =======================================================================
    for side, sign in [("left", 1), ("right", -1)]:
        arm_grp = f"{side}_arm"
        shoulder_pos = [sign * 3.75, 20.4, 0.0]
        elbow_pos = [sign * 3.96, 15.4, 0.04]
        wrist_pos = [sign * 4.04, 12.1, -0.08]
        arm_parts = build_anatomical_arm_parts(
            side=side,
            sign=sign,
            arm_grp=arm_grp,
            shoulder_pos=shoulder_pos,
            elbow_pos=elbow_pos,
            wrist_pos=wrist_pos,
            radii={"shoulder": 1.00, "bicep": 0.88, "elbow": 0.76, "forearm": 0.80, "wrist": 0.66},
            sleeve_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.JACKET_BLACK),
            skin_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.JACKET_BLACK),
            glove_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.SKIN_BASE),
        )
        # White tracksuit shoulder cap & white ribbed wrist cuff
        sx, sy, sz = shoulder_pos
        inward_shift = -sign * 0.48
        arm_parts[0] = build_muscular_limb_mesh(
            f"ShoulderCap_{side}", arm_grp, shoulder_pos,
            [
                (sx + inward_shift * 0.35, sy - 0.55, sz, 0.96, 0.92),
                (sx + inward_shift * 0.55, sy - 0.05, sz, 1.12, 1.04),
                (sx + inward_shift * 0.65, sy + 0.42, sz, 0.96, 0.90),
                (sx + inward_shift * 0.72, sy + 0.74, sz, 0.58, 0.55),
            ],
            n_sides=10,
            side_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        )
        wx, wy, wz = wrist_pos
        arm_parts[3] = build_muscular_limb_mesh(
            f"WristCuff_{side}", arm_grp, wrist_pos,
            [
                (wx, wy - 0.18, wz, 0.71, 0.74),
                (wx, wy + 0.08, wz, 0.78, 0.81),
                (wx, wy + 0.34, wz, 0.74, 0.77),
            ],
            n_sides=10,
            side_painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        )
        els.extend(arm_parts)
        # Flush Orange Sleeve Stripes on Upper Arm & Forearm
        els.append(build_beveled_box_mesh(
            f"sleeve_orange_upper_{side}", (arm_grp, "arm"),
            sx + sign * 0.64, 15.6, -0.22, sx + sign * 0.88, 19.8, 0.22, bevel=0.05,
            origin=[sx + sign * 0.76, 17.7, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))
        els.append(build_beveled_box_mesh(
            f"sleeve_orange_forearm_{side}", (arm_grp, "forearm"),
            wx + sign * 0.56, 12.3, -0.22, wx + sign * 0.78, 15.2, 0.22, bevel=0.05,
            origin=[wx + sign * 0.67, 13.75, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))

    # =======================================================================
    # 4. ANATOMICAL BLACK TRACK PANTS WITH FLUSH STRIPES & SNEAKERS
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
            ankle_pos=[lx, 1.7, 0.0],
            radii={"hip": 1.12, "thigh": 1.04, "knee": 0.88, "calf": 0.94, "ankle": 0.76},
            pants_painter=paint_subaru_pants_wrap,
            boot_painter=paint_subaru_pants_wrap,
            knee_painter=paint_subaru_pants_wrap,
        ))
        # Flush 3D Orange Side Stripes along Pants
        els.append(build_beveled_box_mesh(
            f"pants_stripe_upper_{side}", (leg_grp, "thigh"),
            lx + sign * 0.76, 6.4, -0.22, lx + sign * 0.98, 11.8, 0.22, bevel=0.04,
            origin=[lx + sign * 0.87, 9.1, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))
        els.append(build_beveled_box_mesh(
            f"pants_stripe_lower_{side}", (leg_grp, "shin"),
            lx + sign * 0.66, 1.9, -0.20, lx + sign * 0.86, 6.1, 0.20, bevel=0.04,
            origin=[lx + sign * 0.76, 4.0, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))

        # Detailed White/Orange/Black Sneakers with 3D Laces & Treads
        els.append(build_beveled_box_mesh(
            f"sneaker_collar_{side}", (leg_grp, "foot"),
            lx - 0.80, 1.35, -0.92, lx + 0.80, 1.90, 0.92, bevel=0.10,
            origin=[lx, 1.62, 0],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE),
        ))
        els.append(build_beveled_box_mesh(
            f"sneaker_body_{side}", (leg_grp, "foot"),
            lx - 0.84, 0.42, -2.18, lx + 0.84, 1.50, 0.96, bevel=0.16,
            origin=[lx, 0.96, -0.52],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_WHITE),
        ))
        els.append(build_beveled_box_mesh(
            f"sneaker_heel_black_{side}", (leg_grp, "foot"),
            lx - 0.86, 0.45, 0.20, lx + 0.86, 1.45, 1.00, bevel=0.10,
            origin=[lx, 0.95, 0.60],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.JACKET_BLACK),
        ))
        # 4x 3D Sneaker Lace Bars
        for l_idx, lz in enumerate([-1.35, -1.05, -0.75, -0.45]):
            els.append(build_beveled_box_mesh(
                f"sneaker_lace_{side}_{l_idx}", (leg_grp, "foot"),
                lx - 0.36, 1.46, lz - 0.07, lx + 0.36, 1.62, lz + 0.07, bevel=0.03,
                origin=[lx, 1.54, lz],
                painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE_HL),
            ))
        els.append(build_beveled_box_mesh(
            f"sneaker_sole_{side}", (leg_grp, "foot"),
            lx - 0.88, 0.0, -2.26, lx + 0.88, 0.46, 1.04, bevel=0.07,
            origin=[lx, 0.23, -0.52],
            painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.SHOE_SOLE),
        ))
        for t_idx, tz in enumerate([-1.85, -1.15, -0.45, 0.25]):
            els.append(build_beveled_box_mesh(
                f"sneaker_tread_{side}_{t_idx}", (leg_grp, "foot"),
                lx - 0.86, 0.0, tz - 0.14, lx + 0.86, 0.16, tz + 0.14, bevel=0.03,
                origin=[lx, 0.08, tz],
                painter=lambda w, h: paint_solid_shaded(w, h, SubaruPalette.TRACK_ORANGE_DARK),
            ))

    return els


def main():
    print("[1/3] Building high-detail polygonal Subaru Natsuki (target_height=27.6)...")
    els = build_subaru_elements()

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

    scale = scale_elements_to_height(els, group_origins, 27.6)
    print(f"      Elements: {len(els)}, Uniform Scale: {scale:.4f}")

    print("[2/3] Baking 1024x1024 texture atlas...")
    atlas = bake_elements_atlas(els, atlas_size=1024, default_color=SubaruPalette.JACKET_BLACK)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(base_dir, "output"), exist_ok=True)
    atlas.save(os.path.join(base_dir, "output", "subaru_texture.png"), format="PNG")

    targets = [
        os.path.join(base_dir, "output", "subaru.bbmodel"),
    ]

    print("[3/3] Exporting output/subaru.bbmodel...")
    export_bbmodel(els, atlas, "subaru", targets, group_origins=group_origins)
    print("[DONE] Subaru Natsuki generated!")


if __name__ == "__main__":
    main()
