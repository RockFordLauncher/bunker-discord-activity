#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
High-Detail Wasteland Raider Polygonal 3D Generator (.bbmodel)
Target Height: 28.8 units (180 cm)
Features:
  - Rugged scarred face, leather eyepatch with diagonal strap, 18-spike fiery-red punk mohawk
  - Asymmetric spiked wasteland shoulder pauldrons (road-sign/rebar armor plates & metal spikes)
  - Ragged tactical vest, leather harness & ammo bandolier across chest with brass cartridges
  - Spiked wrist bracer on left forearm, cloth wraps on right arm
  - Heavy wasteland backpack with strapped bedroll & welded scrap metal / exhaust pipe
  - Torn combat jeans with scrap knee plates & reinforced combat boots
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


class RaiderPalette:
    SKIN_BASE = (218, 178, 148, 255)
    SKIN_HL = (234, 198, 170, 255)
    SKIN_SHADOW = (182, 140, 112, 255)
    SKIN_DEEP = (146, 108, 84, 255)
    SCAR = (164, 82, 78, 255)
    LIPS = (158, 108, 98, 255)

    MOHAWK_HL = (255, 112, 42, 255)
    MOHAWK_MID = (224, 48, 28, 255)
    MOHAWK_SHADE = (164, 24, 18, 255)
    MOHAWK_DEEP = (96, 14, 12, 255)
    SHAVED_SIDE = (58, 42, 36, 255)

    LEATHER_MID = (78, 48, 30, 255)
    LEATHER_DARK = (46, 28, 18, 255)
    LEATHER_HL = (108, 70, 44, 255)

    RUST_MID = (132, 74, 48, 255)
    RUST_DARK = (78, 42, 28, 255)
    STEEL_MID = (138, 144, 152, 255)
    STEEL_HL = (206, 212, 222, 255)
    STEEL_DARK = (68, 74, 82, 255)

    SIGN_YELLOW = (214, 168, 36, 255)
    BRASS_MID = (196, 152, 46, 255)
    BRASS_HL = (242, 204, 96, 255)

    DENIM_MID = (54, 68, 86, 255)
    DENIM_DARK = (34, 44, 58, 255)
    DENIM_HL = (78, 96, 118, 255)

    BEDROLL = (108, 114, 86, 255)
    BOOT_DARK = (24, 20, 18, 255)


# ---------------------------------------------------------------------------
# Procedural Texture Painters
# ---------------------------------------------------------------------------
def paint_raider_face(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    for y in range(0, int(h * 0.22)):
        d.line([(0, y), (w - 1, y)], fill=RaiderPalette.SKIN_SHADOW)
    for y in range(int(h * 0.58), h):
        d.line([(0, y), (3, y)], fill=RaiderPalette.SKIN_SHADOW)
        d.line([(w - 4, y), (w - 1, y)], fill=RaiderPalette.SKIN_SHADOW)
    d.line([(0, h - 2), (w - 1, h - 1)], fill=RaiderPalette.SKIN_DEEP)

    # Diagonal battle scar across left cheek
    d.line([(int(w * 0.20), int(h * 0.36)), (int(w * 0.36), int(h * 0.72))], fill=RaiderPalette.SCAR, width=2)

    # Fierce brows & right eye (left eye covered by 3D eyepatch)
    ey = int(h * 0.42)
    rx = int(w * 0.72)
    d.line([(rx - 5, ey - 3), (rx + 5, ey - 2)], fill=(38, 22, 18, 255), width=2)
    d.rectangle([rx - 4, ey, rx + 4, ey + 4], fill=(242, 240, 234, 255))
    d.rectangle([rx - 2, ey, rx + 2, ey + 4], fill=(138, 56, 34, 255))
    d.rectangle([rx - 1, ey + 1, rx + 1, ey + 3], fill=(18, 12, 10, 255))

    # Nose & grimace
    nx = w // 2
    d.line([(nx, int(h * 0.48)), (nx, int(h * 0.62))], fill=RaiderPalette.SKIN_HL)
    my = int(h * 0.78)
    d.line([(nx - 5, my), (nx + 5, my)], fill=RaiderPalette.LIPS, width=2)
    return img


def paint_skin(w, h):
    # Smooth uniform skin tone without horizontal banding across mesh rings
    img = Image.new("RGBA", (w, h), RaiderPalette.SKIN_BASE)
    return img


def paint_shaved_scalp(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.SHAVED_SIDE)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            d.point((x, y), fill=(44, 32, 28, 255))
    return img


def paint_mohawk_red(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.MOHAWK_MID)
    d = ImageDraw.Draw(img)
    for x in range(w):
        c = RaiderPalette.MOHAWK_HL if x % 4 == 0 else (RaiderPalette.MOHAWK_SHADE if x % 3 == 0 else RaiderPalette.MOHAWK_MID)
        d.line([(x, 0), (x, h - 1)], fill=c)
    d.line([(0, 0), (w - 1, 0)], fill=RaiderPalette.MOHAWK_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=RaiderPalette.MOHAWK_DEEP)
    return img


def paint_leather(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.LEATHER_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=RaiderPalette.LEATHER_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=RaiderPalette.LEATHER_DARK)
    if w >= 6 and h >= 6:
        d.rectangle([1, 1, w - 2, h - 2], outline=RaiderPalette.LEATHER_DARK)
    return img


def paint_rust_steel(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.STEEL_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=RaiderPalette.STEEL_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=RaiderPalette.STEEL_DARK)
    if w >= 8 and h >= 8:
        d.rectangle([2, 2, w // 2, h // 2], fill=RaiderPalette.RUST_MID)
    return img


def paint_road_sign(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.SIGN_YELLOW)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=RaiderPalette.RUST_DARK)
    d.line([(2, 2), (w - 3, h - 3)], fill=(24, 24, 24, 255), width=2)
    return img


def paint_brass(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.BRASS_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=RaiderPalette.BRASS_HL)
    return img


def paint_denim(w, h):
    # Subtle vertical denim weave without horizontal striping/shadow-banding
    img = Image.new("RGBA", (w, h), RaiderPalette.DENIM_MID)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 4 == 0:
            d.line([(x, 0), (x, h - 1)], fill=(48, 61, 78, 255))
        elif x % 4 == 2:
            d.line([(x, 0), (x, h - 1)], fill=(60, 75, 94, 255))
    return img


def paint_bedroll(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.BEDROLL)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=(134, 142, 110, 255))
    d.line([(0, h - 1), (w - 1, h - 1)], fill=(68, 74, 52, 255))
    return img


def paint_boot(w, h):
    img = Image.new("RGBA", (w, h), RaiderPalette.BOOT_DARK)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=RaiderPalette.LEATHER_HL)
    return img


# ---------------------------------------------------------------------------
# Model Builder
# ---------------------------------------------------------------------------
def build_raider():
    els = []
    group_origins = {
        "root": [0, 0, 0],
        "root/torso": [0, 14.2, 0],
        "root/torso/neck": [0, 23.2, 0],
        "root/torso/neck/head": [0, 24.3, 0],
        "root/torso/arm_left": [4.05, 21.8, 0],
        "root/torso/arm_right": [-4.05, 21.8, 0],
        "root/torso/leg_left": [1.9, 13.5, 0],
        "root/torso/leg_right": [-1.9, 13.5, 0],
    }

    # --- 1. HEAD, EYEPATCH + STRAP, 18-SPIKE FIERY-RED MOHAWK ---
    head_gp = ["root", "torso", "neck", "head"]
    neck_gp = ["root", "torso", "neck"]

    els.append(build_tapered_cylinder(
        "neck_mesh", neck_gp, origin=[0, 22.8, 0], r_bottom=1.42, r_top=1.22, height=1.8,
        n_sides=12, n_rings=3, side_painter=paint_skin, cap_top_painter=paint_skin, cap_bot_painter=paint_skin
    ))

    els.append(build_sculpted_head_mesh(
        "head_sculpted", head_gp, origin=[0, 24.3, 0],
        y_bot=24.1, y_top=28.5, width=4.1, depth=4.2,
        face_painter=paint_raider_face, hair_painter=paint_shaved_scalp, skin_painter=paint_skin,
    ))

    # Leather Eyepatch & Diagonal Strap
    els.append(build_beveled_box_mesh(
        "eyepatch_pad", head_gp, 0.35, 25.95, -2.28, 1.35, 26.75, -1.98,
        bevel=0.10, origin=[0.85, 26.35, -2.13], painter=paint_leather
    ))
    els.append(build_beveled_box_mesh(
        "eyepatch_strap_f", head_gp, -1.85, 26.4, -2.15, 2.05, 26.72, -1.85,
        bevel=0.04, origin=[0.1, 26.55, -2.0], rotation=[0, 0, -14], painter=paint_leather
    ))
    els.append(build_beveled_box_mesh(
        "eyepatch_strap_b", head_gp, -2.05, 25.6, 1.85, 2.05, 25.92, 2.15,
        bevel=0.04, origin=[0, 25.75, 2.0], rotation=[0, 0, -14], painter=paint_leather
    ))

    # 18-spike fiery-red punk mohawk (pointed upward & back along the center crest)
    mohawk_specs = []
    for i in range(18):
        t = i / 17.0
        z_off = -1.75 + t * 3.65
        y_off = 4.2 - 0.55 * (t * t)
        pitch = -155 + t * 58  # Points up-forward at front, up-back at rear
        len_val = 2.4 + (0.6 if 0.15 < t < 0.75 else 0.0)
        mohawk_specs.append((
            f"mohawk_spike_{i}", (0.0, y_off, z_off), (pitch, 0, 0),
            0.55, 0.42, len_val, (0.0, 0.12), 0.75, 0.04
        ))
    els.extend(build_multi_strand_hair_layer(
        "mohawk", head_gp, [0, 24.3, 0], mohawk_specs, painter=paint_mohawk_red, n_sides=6, n_rings=4
    ))

    # --- 2. TORSO, RAGGED VEST, AMMO BANDOLIER & BACKPACK ---
    torso_gp = ["root", "torso"]
    els.append(build_lofted_mesh(
        "raider_torso_skin", torso_gp,
        [
            make_ellipse_ring(0, 13.6, 0, 2.75, 1.75, n_pts=14),
            make_ellipse_ring(0, 15.6, 0, 2.60, 1.62, n_pts=14),
            make_ellipse_ring(0, 18.8, 0, 3.15, 1.88, n_pts=14),
            make_ellipse_ring(0, 21.8, 0, 3.72, 2.08, n_pts=14),
            make_ellipse_ring(0, 23.2, 0, 2.35, 1.55, n_pts=14),
        ],
        origin=[0, 14.2, 0], side_painter=paint_skin, cap_top_painter=paint_skin, cap_bot_painter=paint_denim
    ))

    # Ragged Tactical Vest (snug fit against torso)
    els.append(build_open_coat_arc_mesh(
        "ragged_vest", torso_gp, origin=[0, 18.5, 0],
        levels=[(15.2, 2.75, 1.72, 0.0, 1.0), (18.5, 3.25, 1.96, 0.0, 1.0), (22.0, 3.78, 2.16, 0.0, 1.0)],
        outer_painter=paint_leather, inner_painter=paint_rust_steel, trim_painter=paint_denim,
        thickness=0.18, open_half_deg=32.0, n_arc=13
    ))

    # Diagonal Ammo Bandolier across Chest (curved flush to torso/vest + 8 brass cartridges)
    def _torso_front_z(x, y):
        if y <= 15.6:
            t = max(0.0, (y - 13.6) / 2.0)
            rx_y, rz_y = 2.75 + (2.60 - 2.75) * t, 1.75 + (1.62 - 1.75) * t
        elif y <= 18.8:
            t = (y - 15.6) / 3.2
            rx_y, rz_y = 2.60 + (3.15 - 2.60) * t, 1.62 + (1.88 - 1.62) * t
        else:
            t = min(1.0, (y - 18.8) / 3.0)
            rx_y, rz_y = 3.15 + (3.72 - 3.15) * t, 1.88 + (2.08 - 1.88) * t
        ratio = min(0.92, abs(x) / max(0.1, rx_y))
        return -rz_y * ((1.0 - ratio * ratio) ** 0.5)

    band_rings = []
    for bt in [-1.0, -0.5, 0.0, 0.5, 1.0]:
        bx = bt * 1.95
        by = 18.6 - bt * 3.15
        bz = _torso_front_z(bx, by)
        # Inner edge embedded 0.14u into torso, outer edge proud by 0.14u
        band_rings.append(make_ellipse_ring(bx, by, bz, 0.42, 0.18, n_pts=8))
    els.append(build_lofted_mesh(
        "bandolier_strap", torso_gp, band_rings,
        origin=[0, 18.6, -1.8], side_painter=paint_leather, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
    ))
    for b_idx in range(8):
        bt = (b_idx / 7.0) * 1.8 - 0.9
        bx = bt * 1.95
        by = 18.6 - bt * 3.15
        bz = _torso_front_z(bx, by) - 0.14
        els.append(build_cylinder_mesh(
            f"bullet_casing_{b_idx}", torso_gp, origin=[bx, by, bz], radius=0.11, height=0.46,
            n_sides=8, rotation=[0, 0, -32], side_painter=paint_brass, cap_top_painter=paint_rust_steel
        ))

    # Utility Belt + Buckle + 3 Flush Pouches
    els.append(build_lofted_mesh(
        "raider_belt", torso_gp,
        [make_ellipse_ring(0, 14.4, 0, 2.82, 1.80, n_pts=14), make_ellipse_ring(0, 15.4, 0, 2.80, 1.78, n_pts=14)],
        origin=[0, 14.9, 0], side_painter=paint_leather, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
    ))
    els.extend(build_buckle_assembly(
        "raider_buckle", torso_gp, origin=[0, 14.9, -1.78], width=1.25, height=0.95, depth=0.3,
        frame_painter=paint_rust_steel, pin_painter=paint_brass
    ))
    for pname, porig, prot in [
        ("pouch_l", [2.15, 14.8, -1.02], [0, -35, 0]),
        ("pouch_r", [-2.15, 14.8, -1.02], [0, 35, 0]),
        ("pouch_back", [0.0, 14.8, 1.82], [0, 180, 0]),
    ]:
        els.append(build_pouch_mesh(
            pname, torso_gp, origin=porig, width=0.95, height=1.25, depth=0.62, rotation=prot,
            body_painter=paint_leather, flap_painter=paint_rust_steel, buckle_painter=paint_brass
        ))

    # Heavy Wasteland Backpack with Bedroll & Scrap Metal (seated flush into back)
    els.append(build_beveled_box_mesh(
        "backpack_main", torso_gp, -1.75, 16.5, 1.70, 1.75, 21.4, 3.25,
        bevel=0.22, origin=[0, 19.0, 2.48], painter=paint_leather
    ))
    els.append(build_cylinder_mesh(
        "backpack_bedroll", torso_gp, origin=[0, 21.85, 2.52], radius=0.68, height=3.8,
        n_sides=12, axis="x", side_painter=paint_bedroll, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
    ))
    for st_idx, st_x in enumerate([-1.1, 1.1]):
        els.append(build_cylinder_mesh(
            f"bedroll_strap_{st_idx}", torso_gp, origin=[st_x, 21.85, 2.52], radius=0.74, height=0.28,
            n_sides=12, axis="x", side_painter=paint_leather
        ))
    # Chest leather harness straps following exact torso contour (zero floating gap)
    for h_side, hx in [("l", 1.55), ("r", -1.55)]:
        harness_rings = [
            make_ellipse_ring(hx, 15.2, _torso_front_z(hx, 15.2), 0.28, 0.16, n_pts=8),
            make_ellipse_ring(hx, 18.6, _torso_front_z(hx, 18.6), 0.28, 0.16, n_pts=8),
            make_ellipse_ring(hx, 21.6, _torso_front_z(hx, 21.6), 0.28, 0.16, n_pts=8),
            make_ellipse_ring(hx * 0.85, 22.6, _torso_front_z(hx * 0.85, 22.6), 0.26, 0.16, n_pts=8),
        ]
        els.append(build_lofted_mesh(
            f"chest_harness_{h_side}", torso_gp, harness_rings, origin=[hx, 18.8, -1.8],
            side_painter=paint_leather, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
        ))
        els.append(build_cylinder_mesh(
            f"harness_rivet_{h_side}", torso_gp, origin=[hx, 20.8, _torso_front_z(hx, 20.8) - 0.12], radius=0.14, height=0.18,
            n_sides=8, axis="z", side_painter=paint_brass
        ))
    els.append(build_armor_plate(
        "backpack_scrap_plate", torso_gp, origin=[0.2, 18.8, 3.30], width=2.4, height=2.2,
        thickness=0.22, curve_z=-0.18, rotation=[0, 180, 12], painter=paint_road_sign, trim_painter=paint_rust_steel
    ))
    els.append(build_tapered_cylinder(
        "backpack_exhaust_pipe", torso_gp, origin=[-1.35, 21.2, 2.9], r_bottom=0.24, r_top=0.20, height=3.2,
        n_sides=10, n_rings=3, rotation=[-14, 0, -18], side_painter=paint_rust_steel
    ))

    # --- 3. ANATOMICAL ARMS, FLUSH SPIKED PAULDRONS & SPIKED BRACER ---
    arm_radii = {"shoulder": 1.32, "bicep": 1.15, "elbow": 0.90, "forearm": 1.00, "wrist": 0.76}

    # Left Arm: Sculpted muscular arm + Road-sign Pauldron (5 spikes) + Spiked Wrist Bracer
    lgp = ["root", "torso", "arm_left"]
    l_sh, l_el, l_wr = [4.05, 21.8, 0.0], [4.35, 18.6, 0.10], [4.45, 15.6, -0.10]
    els.extend(build_anatomical_arm_parts(
        "left", 1.0, lgp, l_sh, l_el, l_wr, arm_radii,
        sleeve_painter=paint_skin, skin_painter=paint_skin, glove_painter=paint_leather
    ))
    els.append(build_armor_plate(
        "pauldron_roadsign_l", lgp, origin=[4.85, 22.0, 0], width=2.3, height=2.2,
        thickness=0.34, curve_z=0.45, rotation=[0, -90, 0], painter=paint_road_sign, trim_painter=paint_rust_steel
    ))
    for s_idx, (sy, sz, rz) in enumerate([(22.7, -0.5, -55), (22.7, 0.5, -55), (22.0, 0.0, -78), (21.3, -0.5, -95), (21.3, 0.5, -95)]):
        els.append(build_tapered_cylinder(
            f"pauldron_spike_l_{s_idx}", lgp, origin=[4.98, sy, sz], r_bottom=0.16, r_top=0.02, height=1.15,
            n_sides=8, n_rings=2, rotation=[0, 0, rz], side_painter=paint_rust_steel
        ))
    # Spiked wrist bracer seated flush on left forearm
    els.append(build_cylinder_mesh(
        "spiked_bracer_l", lgp, origin=[4.41, 16.8, -0.02], radius=1.02, height=1.75, n_sides=12, side_painter=paint_leather
    ))
    for b_idx, ang_z in enumerate([0, 90, 180, 270]):
        els.append(build_tapered_cylinder(
            f"bracer_spike_{b_idx}", lgp, origin=[5.32, 16.8, -0.02], r_bottom=0.14, r_top=0.02, height=0.85,
            n_sides=8, n_rings=2, rotation=[0, ang_z, -82], side_painter=paint_rust_steel
        ))

    # Right Arm: Sculpted muscular arm + Leather Pauldron (3 spikes) + Cloth Arm Wrap
    rgp = ["root", "torso", "arm_right"]
    r_sh, r_el, r_wr = [-4.05, 21.8, 0.0], [-4.35, 18.6, 0.10], [-4.45, 15.6, -0.10]
    els.extend(build_anatomical_arm_parts(
        "right", -1.0, rgp, r_sh, r_el, r_wr, arm_radii,
        sleeve_painter=paint_skin, skin_painter=paint_skin, glove_painter=paint_leather
    ))
    els.append(build_armor_plate(
        "pauldron_leather_r", rgp, origin=[-4.82, 21.9, 0], width=2.0, height=1.9,
        thickness=0.34, curve_z=0.42, rotation=[0, 90, 0], painter=paint_leather, trim_painter=paint_rust_steel
    ))
    for s_idx, sz in enumerate([-0.55, 0.0, 0.55]):
        els.append(build_tapered_cylinder(
            f"pauldron_spike_r_{s_idx}", rgp, origin=[-4.95, 22.4, sz], r_bottom=0.14, r_top=0.02, height=0.95,
            n_sides=8, n_rings=2, rotation=[0, 0, 62], side_painter=paint_rust_steel
        ))
    els.append(build_cylinder_mesh(
        "cloth_wrap_r", rgp, origin=[-4.41, 16.8, -0.02], radius=0.98, height=1.65, n_sides=12, side_painter=paint_bedroll
    ))

    # --- 4. ANATOMICAL LEGS, FLUSH KNEE PLATES & REINFORCED BOOTS ---
    leg_radii = {"hip": 1.68, "thigh": 1.56, "knee": 1.24, "calf": 1.32, "ankle": 1.02}
    for side, sx in [("left", 1.0), ("right", -1.0)]:
        leg_gp = ["root", "torso", f"leg_{side}"]
        leg_x = sx * 1.9

        els.extend(build_anatomical_leg_parts(
            side, sx, leg_gp,
            hip_pos=[leg_x, 13.6, 0.0],
            knee_pos=[leg_x, 8.4, -0.05],
            ankle_pos=[leg_x, 5.2, 0.05],
            radii=leg_radii,
            pants_painter=paint_denim,
            boot_painter=paint_denim,
            knee_painter=paint_denim,
        ))
        els.append(build_armor_plate(
            f"knee_scrap_{side}", leg_gp, origin=[leg_x, 8.4, -1.32], width=1.72, height=1.9,
            thickness=0.34, curve_z=0.38, painter=paint_rust_steel, trim_painter=paint_leather
        ))

        # Reinforced combat boots
        els.append(build_lofted_mesh(
            f"boot_shaft_{side}", leg_gp,
            [
                make_ellipse_ring(leg_x, 0.85, -0.1, 1.28, 1.50, n_pts=14),
                make_ellipse_ring(leg_x, 3.0, 0.0, 1.22, 1.32, n_pts=14),
                make_ellipse_ring(leg_x, 5.6, 0.0, 1.26, 1.32, n_pts=14),
            ],
            origin=[leg_x, 3.0, 0], side_painter=paint_boot, cap_top_painter=paint_leather, cap_bot_painter=paint_boot
        ))
        els.append(build_beveled_box_mesh(
            f"boot_steel_toe_{side}", leg_gp, leg_x - 1.2, 0.45, -2.42, leg_x + 1.2, 1.68, -0.9,
            bevel=0.22, origin=[leg_x, 1.0, -1.65], painter=paint_rust_steel
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", leg_gp, leg_x - 1.28, 0.0, -2.5, leg_x + 1.28, 0.55, 1.58,
            bevel=0.10, origin=[leg_x, 0.25, -0.45], painter=paint_boot
        ))
        for s_idx, sy in enumerate([2.0, 2.9, 3.8, 4.7]):
            els.append(build_beveled_box_mesh(
                f"boot_strap_{side}_{s_idx}", leg_gp, leg_x - 0.65, sy, -1.46, leg_x + 0.65, sy + 0.16, -1.22,
                bevel=0.03, origin=[leg_x, sy, -1.34], painter=paint_leather
            ))
        for k_idx, ky in enumerate([7.4, 9.4]):
            els.append(build_beveled_box_mesh(
                f"knee_strap_{side}_{k_idx}", leg_gp, leg_x - 1.35, ky, -0.85, leg_x + 1.35, ky + 0.26, 1.38,
                bevel=0.04, origin=[leg_x, ky + 0.13, 0.26], painter=paint_leather
            ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", leg_gp, origin=[leg_x + sx * 1.26, 4.7, -0.2], width=0.58, height=0.46, depth=0.18,
            rotation=[0, -sx * 90, 0], frame_painter=paint_rust_steel, pin_painter=paint_brass
        ))

    scale_elements_to_height(els, group_origins, 28.8)
    atlas = bake_elements_atlas(els, atlas_size=1024, max_face_size=128)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", "raider.bbmodel")
    bb = export_bbmodel(els, atlas, "raider", [out_path], group_origins=group_origins)
    n_faces = sum(len(e.faces) if isinstance(e, PolyMesh) else 6 for e in els)
    print(f"raider.bbmodel exported: {len(els)} elements, {n_faces} faces, atlas={atlas.width}x{atlas.height}")
    return bb


if __name__ == "__main__":
    build_raider()
