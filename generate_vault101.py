#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
High-Detail Vault 101 Dweller (Fallout 3) Polygonal 3D Generator (.bbmodel)
Target Height: 28.2 units (176 cm)
Features:
  - Sculpted head (64x64 crisp face, AO, stubble) + 22-strand shaggy dark-brown 3D hair
  - Comm headset with padded earcup, headband, and mic boom
  - 14-segment V-tapered blue-and-yellow Vault 101 jumpsuit with gold collar, front zipper,
    yellow piping, and large "101" emblem on back
  - Leather utility belt with 3D brass buckle, 4 tactical pouches, and metal canteen
  - Bulky Pip-Boy 3000 on left forearm (glowing green screen, dials, buttons, wrist cuffs)
  - Laced armored vault boots with lugged soles and knee pads
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


class VaultPalette:
    SKIN_BASE = (236, 204, 180, 255)
    SKIN_HL = (248, 222, 200, 255)
    SKIN_SHADOW = (204, 168, 142, 255)
    SKIN_DEEP = (172, 134, 110, 255)
    LIPS = (182, 128, 118, 255)

    HAIR_HL = (96, 68, 48, 255)
    HAIR_MID = (68, 46, 32, 255)
    HAIR_SHADE = (48, 32, 22, 255)
    HAIR_DEEP = (30, 20, 14, 255)

    VAULT_BLUE = (24, 62, 138, 255)
    VAULT_BLUE_HL = (42, 88, 174, 255)
    VAULT_BLUE_DARK = (14, 38, 92, 255)
    VAULT_GOLD = (232, 184, 32, 255)
    VAULT_GOLD_HL = (252, 214, 78, 255)
    VAULT_GOLD_SHADE = (176, 132, 16, 255)

    LEATHER_MID = (86, 54, 34, 255)
    LEATHER_DARK = (54, 34, 20, 255)
    LEATHER_HL = (116, 76, 48, 255)

    BRASS_MID = (202, 158, 48, 255)
    BRASS_HL = (246, 212, 102, 255)

    STEEL_MID = (128, 136, 146, 255)
    STEEL_DARK = (74, 80, 88, 255)
    STEEL_HL = (196, 204, 214, 255)

    PIP_METAL = (92, 98, 90, 255)
    PIP_DARK = (44, 48, 44, 255)
    PIP_SCREEN_BG = (10, 34, 14, 255)
    PIP_GREEN = (62, 255, 108, 255)
    PIP_GREEN_DIM = (26, 146, 52, 255)

    BOOT_DARK = (28, 24, 22, 255)
    BOOT_SOLE = (14, 14, 16, 255)


# ---------------------------------------------------------------------------
# Procedural Texture Painters
# ---------------------------------------------------------------------------
def paint_vault_face(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.SKIN_BASE)
    d = ImageDraw.Draw(img)

    # Forehead AO under shaggy hair
    for y in range(0, int(h * 0.24)):
        t = y / max(1, int(h * 0.24))
        c = VaultPalette.SKIN_DEEP if t < 0.4 else VaultPalette.SKIN_SHADOW
        d.line([(0, y), (w - 1, y)], fill=c)

    # Side cheek & chin AO
    for y in range(int(h * 0.55), h):
        d.line([(0, y), (3, y)], fill=VaultPalette.SKIN_SHADOW)
        d.line([(w - 4, y), (w - 1, y)], fill=VaultPalette.SKIN_SHADOW)
    d.line([(0, h - 2), (w - 1, h - 1)], fill=VaultPalette.SKIN_DEEP)

    # Determined eyebrows
    ey = int(h * 0.42)
    lx, rx = int(w * 0.28), int(w * 0.72)
    ew = max(4, w // 7)
    d.line([(lx - ew // 2, ey - 3), (lx + ew // 2, ey - 2)], fill=VaultPalette.HAIR_DEEP, width=2)
    d.line([(rx - ew // 2, ey - 2), (rx + ew // 2, ey - 3)], fill=VaultPalette.HAIR_DEEP, width=2)

    # Crisp stylized eyes
    for cx in (lx, rx):
        d.rectangle([cx - 4, ey, cx + 4, ey + 4], fill=(246, 246, 248, 255))
        d.rectangle([cx - 2, ey, cx + 2, ey + 4], fill=(56, 98, 146, 255))
        d.rectangle([cx - 1, ey + 1, cx + 1, ey + 3], fill=(16, 22, 32, 255))
        d.point((cx - 1, ey + 1), fill=(255, 255, 255, 255))
        d.line([(cx - 4, ey), (cx + 4, ey)], fill=(38, 28, 24, 255))

    # Nose bridge & nostrils
    nx, ny = w // 2, int(h * 0.62)
    d.line([(nx, int(h * 0.48)), (nx, ny)], fill=VaultPalette.SKIN_HL)
    d.line([(nx - 2, ny + 1), (nx + 2, ny + 1)], fill=VaultPalette.SKIN_SHADOW)

    # Mouth
    my = int(h * 0.78)
    d.line([(nx - 5, my), (nx + 5, my)], fill=VaultPalette.LIPS, width=2)
    d.line([(nx - 3, my + 2), (nx + 3, my + 2)], fill=VaultPalette.SKIN_SHADOW)
    return img


def paint_skin(w, h):
    # Smooth uniform skin tone without horizontal banding across mesh rings
    return Image.new("RGBA", (w, h), VaultPalette.SKIN_BASE)


def paint_brown_hair(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.HAIR_MID)
    d = ImageDraw.Draw(img)
    for x in range(w):
        c = VaultPalette.HAIR_HL if (x % 4 == 0) else (VaultPalette.HAIR_SHADE if x % 3 == 0 else VaultPalette.HAIR_MID)
        d.line([(x, 0), (x, h - 1)], fill=c)
    for y in range(min(3, h)):
        d.line([(0, y), (w - 1, y)], fill=VaultPalette.HAIR_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=VaultPalette.HAIR_DEEP)
    return img


def paint_vault_torso(w, h):
    """Blue Vault 101 jumpsuit with yellow chest/shoulder piping, front zipper & back '101'."""
    img = Image.new("RGBA", (w, h), VaultPalette.VAULT_BLUE)
    d = ImageDraw.Draw(img)

    # Subtle vertical cloth fold shading
    for x in range(w):
        if x % 5 == 0:
            d.line([(x, 0), (x, h - 1)], fill=VaultPalette.VAULT_BLUE_DARK)
        elif x % 5 == 2:
            d.line([(x, 0), (x, h - 1)], fill=VaultPalette.VAULT_BLUE_HL)

    # Top shoulder highlight & bottom waist AO
    d.line([(0, 0), (w - 1, 0)], fill=VaultPalette.VAULT_BLUE_HL)
    for y in range(max(0, h - 4), h):
        d.line([(0, y), (w - 1, y)], fill=VaultPalette.VAULT_BLUE_DARK)

    # Yellow collar-to-chest piping (front u~0.25)
    front_x = int(w * 0.25)
    d.line([(front_x - 3, 0), (front_x - 3, h - 1)], fill=VaultPalette.VAULT_GOLD)
    d.line([(front_x + 3, 0), (front_x + 3, h - 1)], fill=VaultPalette.VAULT_GOLD)
    d.line([(front_x, 0), (front_x, h - 1)], fill=VaultPalette.BRASS_HL)

    # Yellow horizontal chest stripe
    cy = int(h * 0.28)
    d.rectangle([max(0, front_x - 8), cy, min(w - 1, front_x + 8), cy + 2], fill=VaultPalette.VAULT_GOLD)

    # Back "101" emblem (back u~0.75)
    bx = int(w * 0.75)
    by0, by1 = int(h * 0.25), int(h * 0.65)
    # Yellow circular/shield backing
    d.ellipse([bx - 10, by0 - 2, bx + 10, by1 + 2], fill=VaultPalette.VAULT_GOLD, outline=VaultPalette.VAULT_GOLD_SHADE)
    # Blue "101" digits
    d.rectangle([bx - 6, by0 + 2, bx - 4, by1 - 2], fill=VaultPalette.VAULT_BLUE_DARK)
    d.rectangle([bx - 2, by0 + 2, bx + 2, by1 - 2], fill=VaultPalette.VAULT_BLUE_DARK)
    d.rectangle([bx - 1, by0 + 4, bx + 1, by1 - 4], fill=VaultPalette.VAULT_GOLD)
    d.rectangle([bx + 4, by0 + 2, bx + 6, by1 - 2], fill=VaultPalette.VAULT_BLUE_DARK)
    return img


def paint_vault_blue_fabric(w, h):
    # Subtle vertical weave + yellow side stripe without horizontal banding
    img = Image.new("RGBA", (w, h), VaultPalette.VAULT_BLUE)
    d = ImageDraw.Draw(img)
    for x in range(w):
        if x % 5 == 0:
            d.line([(x, 0), (x, h - 1)], fill=(20, 52, 118, 255))
    sx = w // 2
    d.line([(sx, 0), (sx, h - 1)], fill=VaultPalette.VAULT_GOLD, width=max(1, w // 12))
    return img


def paint_vault_gold(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.VAULT_GOLD)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=VaultPalette.VAULT_GOLD_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=VaultPalette.VAULT_GOLD_SHADE)
    return img


def paint_leather(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.LEATHER_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=VaultPalette.LEATHER_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=VaultPalette.LEATHER_DARK)
    if w >= 6 and h >= 6:
        d.rectangle([1, 1, w - 2, h - 2], outline=VaultPalette.LEATHER_DARK)
    return img


def paint_brass(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.BRASS_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=VaultPalette.BRASS_HL)
    d.point((w // 2, h // 2), fill=VaultPalette.BRASS_HL)
    return img


def paint_steel(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.STEEL_MID)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=VaultPalette.STEEL_HL)
    d.line([(0, h - 1), (w - 1, h - 1)], fill=VaultPalette.STEEL_DARK)
    return img


def paint_pipboy_body(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.PIP_METAL)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=VaultPalette.PIP_DARK)
    d.line([(1, 1), (w - 2, 1)], fill=VaultPalette.STEEL_HL)
    return img


def paint_pipboy_screen(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.PIP_SCREEN_BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=VaultPalette.PIP_GREEN_DIM)
    # Scanlines
    for y in range(2, h - 2, 3):
        d.line([(2, y), (w - 3, y)], fill=VaultPalette.PIP_GREEN_DIM)
    # Vault-Boy silhouette / radar graph
    cx, cy = w // 2, h // 2
    d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=VaultPalette.PIP_GREEN)
    d.line([(2, cy + 4), (w // 3, cy - 2), (2 * w // 3, cy + 2), (w - 3, cy - 4)], fill=VaultPalette.PIP_GREEN)
    return img


def paint_boot(w, h):
    img = Image.new("RGBA", (w, h), VaultPalette.BOOT_DARK)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (w - 1, 0)], fill=(54, 48, 44, 255))
    d.line([(0, h - 1), (w - 1, h - 1)], fill=VaultPalette.BOOT_SOLE)
    return img


# ---------------------------------------------------------------------------
# Model Builder
# ---------------------------------------------------------------------------
def build_vault101():
    els = []
    group_origins = {
        "root": [0, 0, 0],
        "root/torso": [0, 14.0, 0],
        "root/torso/neck": [0, 22.8, 0],
        "root/torso/neck/head": [0, 23.8, 0],
        "root/torso/arm_left": [3.95, 21.5, 0],
        "root/torso/arm_right": [-3.95, 21.5, 0],
        "root/torso/leg_left": [1.85, 13.4, 0],
        "root/torso/leg_right": [-1.85, 13.4, 0],
    }

    # --- 1. HEAD & SHAGGY HAIR & COMM HEADSET ---
    head_gp = ["root", "torso", "neck", "head"]
    neck_gp = ["root", "torso", "neck"]

    els.append(build_tapered_cylinder(
        "neck_mesh", neck_gp, origin=[0, 22.4, 0], r_bottom=1.35, r_top=1.18, height=1.8,
        n_sides=12, n_rings=3, side_painter=paint_skin, cap_top_painter=paint_skin, cap_bot_painter=paint_skin
    ))

    els.append(build_sculpted_head_mesh(
        "head_sculpted", head_gp, origin=[0, 23.8, 0],
        y_bot=23.6, y_top=28.0, width=4.1, depth=4.2,
        face_painter=paint_vault_face, hair_painter=paint_brown_hair, skin_painter=paint_skin,
    ))

    # Ears
    for side, sx in [("left", 2.05), ("right", -2.05)]:
        els.append(build_beveled_box_mesh(
            f"ear_{side}", head_gp, sx - 0.22, 25.1, -0.35, sx + 0.22, 26.2, 0.35,
            bevel=0.08, origin=[sx, 25.6, 0], painter=paint_skin
        ))

    # 22-strand shaggy dark-brown 3D hair
    hair_specs = [
        ("bang_c1", (0.0, 4.1, -2.0), (14, 0, -4), 0.95, 0.45, 1.9, (-0.1, -0.2), 1.1, 0.12),
        ("bang_c2", (-0.6, 4.1, -1.95), (16, 10, 8), 0.9, 0.45, 2.1, (0.15, -0.25), 1.1, 0.14),
        ("bang_c3", (0.7, 4.05, -1.95), (15, -12, -10), 0.85, 0.45, 1.8, (-0.15, -0.2), 1.1, 0.12),
        ("bang_l1", (1.35, 3.85, -1.55), (12, -25, -18), 0.85, 0.48, 2.2, (0.1, -0.15), 1.15, 0.10),
        ("bang_r1", (-1.35, 3.85, -1.55), (12, 25, 18), 0.85, 0.48, 2.3, (-0.1, -0.15), 1.15, 0.10),
        ("side_l1", (1.95, 3.4, -0.6), (6, -15, -14), 0.85, 0.65, 2.6, (0.2, 0.0), 1.15, 0.0),
        ("side_l2", (2.0, 3.2, 0.5), (-4, -10, -12), 0.9, 0.7, 2.8, (0.2, 0.1), 1.15, 0.0),
        ("side_r1", (-1.95, 3.4, -0.6), (6, 15, 14), 0.85, 0.65, 2.6, (-0.2, 0.0), 1.15, 0.0),
        ("side_r2", (-2.0, 3.2, 0.5), (-4, 10, 12), 0.9, 0.7, 2.8, (-0.2, 0.1), 1.15, 0.0),
        ("top_1", (0.0, 4.4, -0.6), (-68, 0, 0), 1.3, 0.7, 2.2, (0.0, 0.2), 1.2, 0.08),
        ("top_2", (-0.9, 4.3, -0.4), (-64, 14, 12), 1.1, 0.65, 2.3, (-0.1, 0.2), 1.15, 0.08),
        ("top_3", (0.9, 4.3, -0.4), (-64, -14, -12), 1.1, 0.65, 2.3, (0.1, 0.2), 1.15, 0.08),
        ("crown_c", (0.0, 4.35, 0.7), (-85, 0, 0), 1.4, 0.75, 2.2, (0.0, 0.2), 1.2, 0.1),
        ("crown_l", (1.0, 4.2, 0.8), (-78, -18, -10), 1.1, 0.7, 2.3, (0.15, 0.15), 1.15, 0.1),
        ("crown_r", (-1.0, 4.2, 0.8), (-78, 18, 10), 1.1, 0.7, 2.3, (-0.15, 0.15), 1.15, 0.1),
        ("back_1", (0.0, 3.6, 1.95), (-14, 0, 0), 1.3, 0.75, 3.3, (0.0, 0.25), 1.2, 0.0),
        ("back_2", (0.95, 3.5, 1.8), (-12, -14, -8), 1.1, 0.7, 3.2, (0.1, 0.2), 1.15, 0.0),
        ("back_3", (-0.95, 3.5, 1.8), (-12, 14, 8), 1.1, 0.7, 3.2, (-0.1, 0.2), 1.15, 0.0),
        ("back_4", (1.65, 3.2, 1.3), (-10, -24, -10), 0.95, 0.65, 3.0, (0.15, 0.15), 1.1, 0.0),
        ("back_5", (-1.65, 3.2, 1.3), (-10, 24, 10), 0.95, 0.65, 3.0, (-0.15, 0.15), 1.1, 0.0),
        ("nape_l", (0.65, 1.8, 1.85), (-18, -8, -4), 0.85, 0.5, 1.9, (0.1, 0.2), 1.1, 0.0),
        ("nape_r", (-0.65, 1.8, 1.85), (-18, 8, 4), 0.85, 0.5, 1.9, (-0.1, 0.2), 1.1, 0.0),
    ]
    els.extend(build_multi_strand_hair_layer(
        "hair", head_gp, [0, 23.8, 0], hair_specs, painter=paint_brown_hair, n_sides=6, n_rings=4
    ))

    # Comm headset with mic boom (right side)
    els.append(build_cylinder_mesh(
        "headset_earcup", head_gp, origin=[-2.35, 25.6, 0.0], radius=0.68, height=0.45,
        n_sides=12, axis="x", side_painter=paint_steel, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
    ))
    els.append(build_beveled_box_mesh(
        "headset_band_r", head_gp, -2.35, 25.8, -0.22, -2.05, 28.1, 0.22,
        bevel=0.06, origin=[-2.2, 26.8, 0], rotation=[0, 0, -14], painter=paint_steel
    ))
    els.append(build_beveled_box_mesh(
        "headset_band_top", head_gp, -1.9, 27.9, -0.22, 1.2, 28.25, 0.22,
        bevel=0.06, origin=[0, 28.05, 0], painter=paint_steel
    ))
    els.append(build_tapered_cylinder(
        "headset_mic_boom", head_gp, origin=[-2.25, 25.2, -0.35], r_bottom=0.09, r_top=0.06, height=1.85,
        n_sides=8, n_rings=3, axis="z", rotation=[-12, 32, 0], side_painter=paint_steel
    ))
    els.append(build_cylinder_mesh(
        "headset_mic_tip", head_gp, origin=[-1.25, 24.8, -1.95], radius=0.16, height=0.35,
        n_sides=10, axis="z", side_painter=paint_boot
    ))

    # --- 2. TORSO, COLLAR, ZIPPER, 101 EMBLEM, BELT, POUCHES, CANTEEN ---
    torso_gp = ["root", "torso"]
    torso_rings = [
        make_ellipse_ring(0, 13.4, 0, 2.75, 1.75, n_pts=14),  # Hips
        make_ellipse_ring(0, 15.2, 0, 2.55, 1.60, n_pts=14),  # Waist
        make_ellipse_ring(0, 18.2, 0, 3.05, 1.85, n_pts=14),  # Ribcage
        make_ellipse_ring(0, 21.2, 0, 3.65, 2.05, n_pts=14),  # Chest / Shoulders
        make_ellipse_ring(0, 22.8, 0, 2.35, 1.55, n_pts=14),  # Collar base
    ]
    els.append(build_lofted_mesh(
        "vault_torso", torso_gp, torso_rings, origin=[0, 14.0, 0],
        side_painter=paint_vault_torso, cap_top_painter=paint_vault_blue_fabric, cap_bot_painter=paint_vault_blue_fabric
    ))

    # Gold high collar + 2 collar clasps
    collar_rings = [
        make_ellipse_ring(0, 22.5, 0, 2.05, 1.55, n_pts=14),
        make_ellipse_ring(0, 23.4, 0, 1.90, 1.48, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "vault_gold_collar", torso_gp, collar_rings, origin=[0, 22.8, 0],
        side_painter=paint_vault_gold, cap_top_painter=paint_vault_gold, cap_bot_painter=paint_vault_gold
    ))
    for c_side, cx in [("l", 0.95), ("r", -0.95)]:
        els.append(build_cylinder_mesh(
            f"collar_clasp_{c_side}", torso_gp, origin=[cx, 22.95, -1.52], radius=0.14, height=0.22,
            n_sides=8, axis="z", side_painter=paint_brass
        ))

    def _vault_front_z(x, y):
        if y <= 15.2:
            t = max(0.0, (y - 13.4) / 1.8)
            rx_y, rz_y = 2.75 + (2.55 - 2.75) * t, 1.75 + (1.60 - 1.75) * t
        elif y <= 18.2:
            t = (y - 15.2) / 3.0
            rx_y, rz_y = 2.55 + (3.05 - 2.55) * t, 1.60 + (1.85 - 1.60) * t
        elif y <= 21.2:
            t = (y - 18.2) / 3.0
            rx_y, rz_y = 3.05 + (3.65 - 3.05) * t, 1.85 + (2.05 - 1.85) * t
        else:
            t = min(1.0, (y - 21.2) / 1.6)
            rx_y, rz_y = 3.65 + (2.35 - 3.65) * t, 2.05 + (1.55 - 2.05) * t
        ratio = min(0.92, abs(x) / max(0.1, rx_y))
        return -rz_y * ((1.0 - ratio * ratio) ** 0.5)

    # 3D Front Zipper & Contour-Following Piping Bars (zero floating gap)
    for z_idx, zy in enumerate([16.0, 17.8, 19.6, 21.4]):
        fz = _vault_front_z(0.0, zy + 0.7)
        els.append(build_beveled_box_mesh(
            f"zipper_seg_{z_idx}", torso_gp, -0.16, zy, fz - 0.10, 0.16, zy + 1.4, fz + 0.14,
            bevel=0.04, origin=[0, zy + 0.7, fz], painter=paint_brass
        ))
    els.append(build_beveled_box_mesh(
        "zipper_pull", torso_gp, -0.18, 21.8, _vault_front_z(0, 22.0) - 0.14, 0.18, 22.35, _vault_front_z(0, 22.0) + 0.12,
        bevel=0.04, origin=[0, 22.0, _vault_front_z(0, 22.0)], painter=paint_brass
    ))
    for side, sx in [("l", 0.52), ("r", -0.52)]:
        pip_rings = [
            make_ellipse_ring(sx, 15.6, _vault_front_z(sx, 15.6), 0.15, 0.14, n_pts=8),
            make_ellipse_ring(sx, 18.2, _vault_front_z(sx, 18.2), 0.15, 0.14, n_pts=8),
            make_ellipse_ring(sx, 21.0, _vault_front_z(sx, 21.0), 0.15, 0.14, n_pts=8),
            make_ellipse_ring(sx, 22.4, _vault_front_z(sx, 22.4), 0.15, 0.14, n_pts=8),
        ]
        els.append(build_lofted_mesh(
            f"chest_piping_{side}", torso_gp, pip_rings, origin=[sx, 19.0, -1.8],
            side_painter=paint_vault_gold, cap_top_painter=paint_vault_gold, cap_bot_painter=paint_vault_gold
        ))

    # Back 3D "101" Emblem Plate + Raised Digits
    els.append(build_armor_plate(
        "back_101_plate", torso_gp, origin=[0, 19.2, 2.02], width=3.4, height=2.6,
        thickness=0.18, curve_z=-0.25, rotation=[0, 180, 0], painter=paint_vault_gold, trim_painter=paint_vault_blue_fabric
    ))
    els.append(build_beveled_box_mesh("emblem_1_l", torso_gp, -1.05, 18.4, 2.05, -0.75, 20.0, 2.24, bevel=0.04, painter=paint_vault_blue_fabric))
    els.append(build_beveled_box_mesh("emblem_0_c", torso_gp, -0.45, 18.4, 2.05, 0.45, 20.0, 2.24, bevel=0.04, painter=paint_vault_blue_fabric))
    els.append(build_beveled_box_mesh("emblem_1_r", torso_gp, 0.75, 18.4, 2.05, 1.05, 20.0, 2.24, bevel=0.04, painter=paint_vault_blue_fabric))

    # Leather Utility Belt (14-seg)
    belt_rings = [
        make_ellipse_ring(0, 14.3, 0, 2.78, 1.78, n_pts=14),
        make_ellipse_ring(0, 15.35, 0, 2.75, 1.76, n_pts=14),
    ]
    els.append(build_lofted_mesh(
        "utility_belt", torso_gp, belt_rings, origin=[0, 14.8, 0],
        side_painter=paint_leather, cap_top_painter=paint_leather, cap_bot_painter=paint_leather
    ))
    els.extend(build_buckle_assembly(
        "belt_buckle", torso_gp, origin=[0, 14.82, -1.82], width=1.15, height=0.95, depth=0.28,
        frame_painter=paint_brass, pin_painter=paint_steel
    ))

    # 4 Tactical Pouches on Belt (seated flush)
    pouch_cfgs = [
        ("pouch_fl", [1.85, 14.75, -1.32], [0, -28, 0]),
        ("pouch_fr", [-1.85, 14.75, -1.32], [0, 28, 0]),
        ("pouch_bl", [1.95, 14.75, 1.22], [0, -140, 0]),
        ("pouch_br", [-1.95, 14.75, 1.22], [0, 140, 0]),
    ]
    for pname, porig, prot in pouch_cfgs:
        els.append(build_pouch_mesh(
            pname, torso_gp, origin=porig, width=0.95, height=1.25, depth=0.62, rotation=prot,
            body_painter=paint_leather, flap_painter=paint_leather, buckle_painter=paint_brass
        ))

    # 4 Belt Loops + Canteen Strap
    for loop_idx, (lx_b, lz_b, rot_y) in enumerate([(1.2, -1.70, -18), (-1.2, -1.70, 18), (1.2, 1.70, 18), (-1.2, 1.70, -18)]):
        els.append(build_beveled_box_mesh(
            f"belt_loop_{loop_idx}", torso_gp, lx_b - 0.14, 14.2, lz_b - 0.12, lx_b + 0.14, 15.45, lz_b + 0.12,
            bevel=0.03, origin=[lx_b, 14.8, lz_b], rotation=[0, rot_y, 0], painter=paint_vault_blue_fabric
        ))

    # Metal Canteen on Right Hip (seated flush)
    els.append(build_tapered_cylinder(
        "canteen_body", torso_gp, origin=[-2.85, 13.8, -0.15], r_bottom=0.58, r_top=0.52, height=1.55,
        n_sides=12, n_rings=3, bulge=1.15, side_painter=paint_steel, cap_top_painter=paint_steel, cap_bot_painter=paint_steel
    ))
    els.append(build_cylinder_mesh(
        "canteen_cap", torso_gp, origin=[-2.85, 15.35, -0.15], radius=0.22, height=0.35,
        n_sides=10, side_painter=paint_brass
    ))
    els.append(build_beveled_box_mesh(
        "canteen_strap", torso_gp, -2.95, 14.5, -0.75, -2.40, 15.3, 0.45,
        bevel=0.04, origin=[-2.68, 14.9, -0.15], painter=paint_leather
    ))

    # --- 3. ANATOMICAL ARMS + FLUSH PIP-BOY 3000 ON LEFT FOREARM ---
    arm_radii = {"shoulder": 1.28, "bicep": 1.12, "elbow": 0.90, "forearm": 0.98, "wrist": 0.74}
    for side, sx in [("left", 1.0), ("right", -1.0)]:
        agp = ["root", "torso", f"arm_{side}"]
        sh_pos = [sx * 3.95, 21.5, 0.0]
        el_pos = [sx * 4.25, 18.4, 0.10]
        wr_pos = [sx * 4.35, 15.4, -0.10]

        els.extend(build_anatomical_arm_parts(
            side, sx, agp, sh_pos, el_pos, wr_pos, arm_radii,
            sleeve_painter=paint_vault_blue_fabric, skin_painter=paint_vault_blue_fabric, glove_painter=paint_leather
        ))

        # Shoulder pad seated flush against deltoid cap
        els.append(build_armor_plate(
            f"shoulder_pad_{side}", agp, origin=[sx * 4.72, 21.6, 0], width=1.6, height=1.7,
            thickness=0.28, curve_z=0.32, rotation=[0, -sx * 90, 0],
            painter=paint_vault_blue_fabric, trim_painter=paint_vault_gold
        ))

        # Yellow wrist cuff seated flush around wrist
        els.append(build_cylinder_mesh(
            f"cuff_{side}", agp, origin=[sx * 4.35, 15.4, -0.10], radius=0.86, height=0.52,
            n_sides=14, side_painter=paint_vault_gold
        ))

    # Bulky Pip-Boy 3000 seated flush on Left Forearm (x ~ 4.31, y ~ 15.6..17.8)
    lgp = ["root", "torso", "arm_left"]
    px, pz = 4.31, -0.01
    els.append(build_lofted_mesh(
        "pipboy_cuff", lgp,
        [make_ellipse_ring(px, 15.6, pz, 1.10, 1.12, n_pts=14), make_ellipse_ring(px, 17.8, pz, 1.16, 1.18, n_pts=14)],
        origin=[px, 16.7, pz], side_painter=paint_pipboy_body, cap_top_painter=paint_steel, cap_bot_painter=paint_steel
    ))
    els.append(build_beveled_box_mesh(
        "pipboy_housing", lgp, px + 0.55, 15.75, pz - 0.95, px + 1.45, 17.65, pz + 0.95,
        bevel=0.14, origin=[px + 1.0, 16.7, pz], painter=paint_pipboy_body
    ))
    els.append(build_beveled_box_mesh(
        "pipboy_screen", lgp, px + 1.38, 16.1, pz - 0.62, px + 1.55, 17.35, pz + 0.42,
        bevel=0.04, origin=[px + 1.45, 16.7, pz - 0.1], painter=paint_pipboy_screen
    ))
    for d_idx, dy in enumerate([16.05, 16.7, 17.35]):
        els.append(build_cylinder_mesh(
            f"pipboy_dial_{d_idx}", lgp, origin=[px + 1.38, dy, pz + 0.68], radius=0.17, height=0.24,
            n_sides=10, axis="x", side_painter=paint_steel, cap_top_painter=paint_brass
        ))
    els.append(build_tapered_cylinder(
        "pipboy_geiger_tube", lgp, origin=[px + 1.05, 17.65, pz - 0.55], r_bottom=0.14, r_top=0.10, height=0.65,
        n_sides=8, n_rings=2, side_painter=paint_brass
    ))
    for btn_idx, bz in enumerate([-0.35, 0.0, 0.35]):
        els.append(build_cylinder_mesh(
            f"pipboy_btn_{btn_idx}", lgp, origin=[px + 1.42, 15.9, pz + bz], radius=0.08, height=0.18,
            n_sides=8, axis="x", side_painter=paint_pipboy_screen
        ))
    for clasp_idx, cy in enumerate([16.0, 17.4]):
        els.append(build_beveled_box_mesh(
            f"pipboy_clasp_{clasp_idx}", lgp, px - 1.18, cy - 0.12, pz - 0.35, px - 0.95, cy + 0.12, pz + 0.35,
            bevel=0.03, origin=[px - 1.06, cy, pz], painter=paint_steel
        ))

    # --- 4. ANATOMICAL LEGS, FLUSH KNEE PADS & LACED ARMORED VAULT BOOTS ---
    leg_radii = {"hip": 1.64, "thigh": 1.52, "knee": 1.22, "calf": 1.28, "ankle": 1.00}
    for side, sx in [("left", 1.0), ("right", -1.0)]:
        leg_gp = ["root", "torso", f"leg_{side}"]
        lx = sx * 1.85

        els.extend(build_anatomical_leg_parts(
            side, sx, leg_gp,
            hip_pos=[lx, 13.4, 0.0],
            knee_pos=[lx, 8.2, -0.05],
            ankle_pos=[lx, 5.2, 0.05],
            radii=leg_radii,
            pants_painter=paint_vault_blue_fabric,
            boot_painter=paint_vault_blue_fabric,
            knee_painter=paint_vault_blue_fabric,
        ))

        # Knee armor pad seated flush
        els.append(build_armor_plate(
            f"knee_pad_{side}", leg_gp, origin=[lx, 8.2, -1.28], width=1.65, height=1.85,
            thickness=0.32, curve_z=0.38, painter=paint_steel, trim_painter=paint_leather
        ))

        # Armored Vault Boot shaft (14-seg)
        boot_rings = [
            make_ellipse_ring(lx, 0.8, -0.1, 1.24, 1.45, n_pts=14),
            make_ellipse_ring(lx, 2.8, 0.0, 1.18, 1.28, n_pts=14),
            make_ellipse_ring(lx, 5.5, 0.0, 1.22, 1.28, n_pts=14),
        ]
        els.append(build_lofted_mesh(
            f"boot_shaft_{side}", leg_gp, boot_rings, origin=[lx, 3.0, 0],
            side_painter=paint_boot, cap_top_painter=paint_leather, cap_bot_painter=paint_boot
        ))
        # Armored toe cap & lugged sole
        els.append(build_beveled_box_mesh(
            f"boot_toe_{side}", leg_gp, lx - 1.18, 0.45, -2.35, lx + 1.18, 1.65, -0.9,
            bevel=0.22, origin=[lx, 1.0, -1.6], painter=paint_boot
        ))
        els.append(build_beveled_box_mesh(
            f"boot_sole_{side}", leg_gp, lx - 1.28, 0.0, -2.45, lx + 1.28, 0.55, 1.55,
            bevel=0.10, origin=[lx, 0.25, -0.45], painter=paint_steel
        ))
        els.append(build_beveled_box_mesh(
            f"boot_heel_{side}", leg_gp, lx - 1.18, 0.45, 0.45, lx + 1.18, 1.05, 1.52,
            bevel=0.10, origin=[lx, 0.75, 0.98], painter=paint_boot
        ))
        els.append(build_beveled_box_mesh(
            f"knee_strap_{side}", leg_gp, lx - 1.32, 8.05, -0.8, lx + 1.32, 8.35, 1.35,
            bevel=0.04, origin=[lx, 8.2, 0.28], painter=paint_leather
        ))
        # 4 criss-cross lace bars + ankle buckle
        for l_idx, ly in enumerate([2.1, 2.8, 3.5, 4.2]):
            els.append(build_beveled_box_mesh(
                f"boot_lace_{side}_{l_idx}", leg_gp, lx - 0.55, ly, -1.42, lx + 0.55, ly + 0.16, -1.20,
                bevel=0.03, origin=[lx, ly, -1.31], painter=paint_vault_gold
            ))
        els.extend(build_buckle_assembly(
            f"boot_buckle_{side}", leg_gp, origin=[lx + sx * 1.24, 4.8, -0.2], width=0.55, height=0.45, depth=0.18,
            rotation=[0, -sx * 90, 0], frame_painter=paint_brass, pin_painter=paint_steel
        ))

    # Scale cleanly to exact 28.2 units, bake 1024x1024 atlas, and export
    scale_elements_to_height(els, group_origins, 28.2)
    atlas = bake_elements_atlas(els, atlas_size=1024, max_face_size=128)
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output", "vault101.bbmodel")
    bb = export_bbmodel(els, atlas, "vault101", [out_path], group_origins=group_origins)
    n_faces = sum(len(e.faces) if isinstance(e, PolyMesh) else 6 for e in els)
    print(f"vault101.bbmodel exported: {len(els)} elements, {n_faces} faces, atlas={atlas.width}x{atlas.height}")
    return bb


if __name__ == "__main__":
    build_vault101()
