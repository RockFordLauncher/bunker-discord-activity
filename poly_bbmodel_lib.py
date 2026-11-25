#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared High-Detail Polygonal Mesh & Beveled Geometry Library for Blockbench (.bbmodel)
Supports:
  - True Polygonal Meshes ("type": "mesh") with arbitrary vertices, quads/tris, and per-vertex UVs
  - Lofted octagonal/polygonal limbs, torsos, skirts, collars, and sculpted heads
  - Pointed curved 3D hair strands (root-to-tip taper)
  - Chamfered/Beveled boxes (eliminating harsh 90-degree primitive corners)
  - 512x512 ShelfBinPacker texture atlas with padding
  - Proper hierarchical Outliner with anatomical bone origins
"""

import os
import json
import uuid
import base64
import math
from io import BytesIO
from PIL import Image, ImageDraw


class ShelfBinPacker:
    def __init__(self, atlas_width=512, atlas_height=512, padding=2):
        self.atlas_width = atlas_width
        self.atlas_height = atlas_height
        self.padding = padding
        self.x = padding
        self.y = padding
        self.shelf_height = 0

    def pack(self, width, height):
        width = max(2, int(width))
        height = max(2, int(height))
        if self.x + width + self.padding > self.atlas_width:
            self.y += self.shelf_height + self.padding
            self.x = self.padding
            self.shelf_height = 0

        if self.y + height + self.padding > self.atlas_height:
            raise RuntimeError(
                f"Atlas overflow packing {width}x{height} at y={self.y} "
                f"(atlas={self.atlas_width}x{self.atlas_height})."
            )

        u1, v1 = self.x, self.y
        u2, v2 = self.x + width, self.y + height
        self.x += width + self.padding
        if height > self.shelf_height:
            self.shelf_height = height
        return (u1, v1, u2, v2)


class PolyMesh:
    """Blockbench native polygonal mesh element ('type': 'mesh')."""

    def __init__(self, name, group_path, origin=None, rotation=None):
        self.name = name
        self.group_path = (group_path,) if isinstance(group_path, str) else tuple(group_path)
        self.origin = [round(float(v), 3) for v in (origin if origin else [0, 0, 0])]
        self.rotation = [round(float(v), 3) for v in (rotation if rotation else [0, 0, 0])]
        self.uuid = str(uuid.uuid4())
        self.vertices = {}  # vkey -> [lx, ly, lz] (local to origin)
        self.faces = {}     # fkey -> {"vertices": [...], "uv": {vkey: [u, v]}, "texture": 0}
        self._v_idx = 0
        self._f_idx = 0
        # List of pending texture patches: (face_keys_or_uv_rects, width, height, painter_fn)
        self.texture_jobs = []

    def add_vertex_world(self, wx, wy, wz):
        vk = f"v{self._v_idx}"
        self._v_idx += 1
        self.vertices[vk] = [
            round(float(wx) - self.origin[0], 4),
            round(float(wy) - self.origin[1], 4),
            round(float(wz) - self.origin[2], 4),
        ]
        return vk

    def add_vertex_local(self, lx, ly, lz):
        vk = f"v{self._v_idx}"
        self._v_idx += 1
        self.vertices[vk] = [round(float(lx), 4), round(float(ly), 4), round(float(lz), 4)]
        return vk

    def add_face_with_uv_norm(self, vkeys, uv_norms, tex_w, tex_h, painter_fn):
        """
        Adds a face (tri or quad) and schedules a texture patch of size (tex_w, tex_h).
        uv_norms: list of (nx, ny) in [0..1] matching vkeys.
        """
        fk = f"f{self._f_idx}"
        self._f_idx += 1
        self.faces[fk] = {
            "vertices": list(vkeys),
            "uv": {vk: [0, 0] for vk in vkeys},
            "texture": 0,
        }
        self.texture_jobs.append(([fk], [uv_norms], tex_w, tex_h, painter_fn))
        return fk

    def add_strip_faces(self, face_vkeys_list, uv_norms_list, tex_w, tex_h, painter_fn):
        """Shares a single texture patch across a strip of faces (e.g. a lofted cylinder/skirt)."""
        fkeys = []
        for vkeys in face_vkeys_list:
            fk = f"f{self._f_idx}"
            self._f_idx += 1
            self.faces[fk] = {
                "vertices": list(vkeys),
                "uv": {vk: [0, 0] for vk in vkeys},
                "texture": 0,
            }
            fkeys.append(fk)
        self.texture_jobs.append((fkeys, uv_norms_list, tex_w, tex_h, painter_fn))


class Cuboid:
    """Crisp cuboid element ('type': 'cube') for mechanical/sharp trim details."""

    def __init__(self, name, group_path, from_pos, to_pos, origin=None, rotation=None, face_painters=None):
        self.name = name
        self.group_path = (group_path,) if isinstance(group_path, str) else tuple(group_path)
        self.from_pos = [round(float(v), 3) for v in from_pos]
        self.to_pos = [round(float(v), 3) for v in to_pos]
        self.origin = [round(float(v), 3) for v in (origin if origin else from_pos)]
        self.rotation = [round(float(v), 3) for v in (rotation if rotation else [0, 0, 0])]
        self.face_painters = face_painters if face_painters else {}
        self.uuid = str(uuid.uuid4())
        self.face_uvs = {}

    @property
    def dx(self):
        return max(0.1, abs(self.to_pos[0] - self.from_pos[0]))

    @property
    def dy(self):
        return max(0.1, abs(self.to_pos[1] - self.from_pos[1]))

    @property
    def dz(self):
        return max(0.1, abs(self.to_pos[2] - self.from_pos[2]))


# ---------------------------------------------------------------------------
# Procedural Mesh Builders
# ---------------------------------------------------------------------------
def build_lofted_mesh(
    name,
    group_path,
    rings,
    origin,
    rotation=None,
    side_painter=None,
    cap_top_painter=None,
    cap_bot_painter=None,
    tex_scale=6,
    max_tex=128,
):
    """
    Lofts a smooth closed polygonal mesh through a list of rings from bottom to top.
    Each ring is a list of (wx, wy, wz) points in CCW order looking from +Y down.
    """
    mesh = PolyMesh(name, group_path, origin=origin, rotation=rotation)
    n_rings = len(rings)
    n_pts = len(rings[0])

    ring_vkeys = []
    for r in rings:
        ring_vkeys.append([mesh.add_vertex_world(pt[0], pt[1], pt[2]) for pt in r])

    # Estimate perimeter & height for texture resolution
    perim = 0.0
    mid_ring = rings[n_rings // 2]
    for i in range(n_pts):
        p0 = mid_ring[i]
        p1 = mid_ring[(i + 1) % n_pts]
        perim += math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 + (p1[2] - p0[2]) ** 2)
    height = 0.0
    for r_idx in range(n_rings - 1):
        p0 = rings[r_idx][0]
        p1 = rings[r_idx + 1][0]
        height += math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 + (p1[2] - p0[2]) ** 2)

    sw = max(8, min(max_tex, int(round(perim * tex_scale))))
    sh = max(6, min(max_tex, int(round(height * tex_scale))))

    strip_faces = []
    strip_uvs = []
    for r_idx in range(n_rings - 1):
        v0 = r_idx / max(1, n_rings - 1)
        v1 = (r_idx + 1) / max(1, n_rings - 1)
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            u0 = i / n_pts
            u1 = (i + 1) / n_pts
            fk_verts = [
                ring_vkeys[r_idx][i],
                ring_vkeys[r_idx][ni],
                ring_vkeys[r_idx + 1][ni],
                ring_vkeys[r_idx + 1][i],
            ]
            strip_faces.append(fk_verts)
            strip_uvs.append([(u0, 1.0 - v0), (u1, 1.0 - v0), (u1, 1.0 - v1), (u0, 1.0 - v1)])

    if side_painter:
        mesh.add_strip_faces(strip_faces, strip_uvs, sw, sh, side_painter)

    # Top & Bottom caps
    if cap_top_painter and n_pts >= 3:
        top_r = rings[-1]
        cx = sum(p[0] for p in top_r) / n_pts
        cy = sum(p[1] for p in top_r) / n_pts
        cz = sum(p[2] for p in top_r) / n_pts
        c_vk = mesh.add_vertex_world(cx, cy, cz)
        cap_faces = []
        cap_uvs = []
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            cap_faces.append([c_vk, ring_vkeys[-1][i], ring_vkeys[-1][ni]])
            a0 = 2 * math.pi * i / n_pts
            a1 = 2 * math.pi * (i + 1) / n_pts
            cap_uvs.append([
                (0.5, 0.5),
                (0.5 + 0.45 * math.cos(a0), 0.5 + 0.45 * math.sin(a0)),
                (0.5 + 0.45 * math.cos(a1), 0.5 + 0.45 * math.sin(a1)),
            ])
        mesh.add_strip_faces(cap_faces, cap_uvs, max(6, sw // 2), max(6, sw // 2), cap_top_painter)

    if cap_bot_painter and n_pts >= 3:
        bot_r = rings[0]
        cx = sum(p[0] for p in bot_r) / n_pts
        cy = sum(p[1] for p in bot_r) / n_pts
        cz = sum(p[2] for p in bot_r) / n_pts
        c_vk = mesh.add_vertex_world(cx, cy, cz)
        cap_faces = []
        cap_uvs = []
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            cap_faces.append([c_vk, ring_vkeys[0][ni], ring_vkeys[0][i]])
            a0 = 2 * math.pi * i / n_pts
            a1 = 2 * math.pi * (i + 1) / n_pts
            cap_uvs.append([
                (0.5, 0.5),
                (0.5 + 0.45 * math.cos(a1), 0.5 + 0.45 * math.sin(a1)),
                (0.5 + 0.45 * math.cos(a0), 0.5 + 0.45 * math.sin(a0)),
            ])
        mesh.add_strip_faces(cap_faces, cap_uvs, max(6, sw // 2), max(6, sw // 2), cap_bot_painter)

    return mesh


def make_ellipse_ring(cx, y, cz, rx, rz, n_pts=8, angle_offset=0.0):
    """Generates a horizontal elliptical ring in CCW order (looking from +Y down) for outward normals."""
    pts = []
    for i in range(n_pts):
        ang = angle_offset + 2.0 * math.pi * i / n_pts
        pts.append((cx + rx * math.cos(ang), y, cz - rz * math.sin(ang)))
    return pts


def build_sculpted_head_mesh(
    name,
    group_path,
    origin,
    y_bot,
    y_top,
    width,
    depth,
    face_painter,
    hair_painter,
    skin_painter,
):
    """
    Builds an 8-sided sculpted anime/stylized head with:
      - A clean, flat front-facing quad (-Z) mapped 1:1 to a dedicated 64x64 face_painter!
      - Angled cheek/jaw bevels, tapered chin, and rounded cranium!
    """
    mesh = PolyMesh(name, group_path, origin=origin)
    hw = width * 0.5
    hd = depth * 0.5
    h = y_top - y_bot

    # 5 vertical rings: chin, jaw, cheeks/eyes, forehead, crown
    # Points in CCW order looking from +Y down, starting at front-left (-X, -Z) -> front-right (+X, -Z)
    # Wait: looking from +Y down (+X right, +Z down, -Z up):
    # From (-X, -Z) to (+X, -Z) is +X. Going up (+Y) is cross (+X)x(+Y) = +Z (inward)!
    # So for OUTWARD (-Z) normal on the front face, bottom edge must go (+X, -Z) -> (-X, -Z)!
    def head_ring(yy, sx, sz, z_shift=0.0):
        rx = hw * sx
        rz = hd * sz
        fx = rx * 0.78  # Clean wide front face
        sx_side = rx * 0.98
        return [
            ( fx, yy, -rz + z_shift),               # 0: Front-Right (-Z)
            (-fx, yy, -rz + z_shift),               # 1: Front-Left  (-Z)
            (-sx_side, yy, -rz * 0.50 + z_shift),   # 2: Cheek-Left
            (-sx_side, yy,  rz * 0.45 + z_shift),   # 3: Temple-Left
            (-fx * 0.85, yy,  rz + z_shift),        # 4: Back-Left (+Z)
            ( fx * 0.85, yy,  rz + z_shift),        # 5: Back-Right (+Z)
            ( sx_side, yy,  rz * 0.45 + z_shift),   # 6: Temple-Right
            ( sx_side, yy, -rz * 0.50 + z_shift),   # 7: Cheek-Right
        ]

    rings = [
        head_ring(y_bot,               0.72, 0.74, z_shift=-hd * 0.04),  # Clean chiseled chin
        head_ring(y_bot + h * 0.16,    0.88, 0.89, z_shift=-hd * 0.02),  # Lower jawline
        head_ring(y_bot + h * 0.35,    0.96, 0.96, z_shift=-hd * 0.005), # Upper jaw / cheek
        head_ring(y_bot + h * 0.56,    1.00, 1.00, z_shift=0.0),         # Cheekbones / Eyes
        head_ring(y_bot + h * 0.80,    0.98, 1.00, z_shift=0.01),        # Forehead / Temple
        head_ring(y_top,               0.84, 0.88, z_shift=0.03),        # Smooth crown
    ]

    ring_vkeys = [[mesh.add_vertex_world(*pt) for pt in r] for r in rings]
    n_rings = len(rings)
    n_pts = 8

    # 1) Dedicated high-res 64x64 Front Face Quad strip (index 0 -> 1)
    front_faces = []
    front_uvs = []
    for r_idx in range(n_rings - 1):
        v0 = r_idx / (n_rings - 1)
        v1 = (r_idx + 1) / (n_rings - 1)
        # Vertex 1 is Left (-X), Vertex 0 is Right (+X)
        front_faces.append([
            ring_vkeys[r_idx][0],
            ring_vkeys[r_idx][1],
            ring_vkeys[r_idx + 1][1],
            ring_vkeys[r_idx + 1][0],
        ])
        # Map Left (-X, idx 1) to u=0, Right (+X, idx 0) to u=1 (or mirror for viewer)
        front_uvs.append([(1.0, 1.0 - v0), (0.0, 1.0 - v0), (0.0, 1.0 - v1), (1.0, 1.0 - v1)])
    mesh.add_strip_faces(front_faces, front_uvs, 64, 64, face_painter)

    # 2) Cheek bevels (indices 1->2 and 7->0): lower jaw/cheek = skin, upper temple/forehead = hair!
    cheek_skin_faces, cheek_skin_uvs = [], []
    cheek_hair_faces, cheek_hair_uvs = [], []
    for r_idx in range(n_rings - 1):
        for i in [1, 7]:
            ni = (i + 1) % n_pts
            f_verts = [
                ring_vkeys[r_idx][i],
                ring_vkeys[r_idx][ni],
                ring_vkeys[r_idx + 1][ni],
                ring_vkeys[r_idx + 1][i],
            ]
            f_uv = [(0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]
            if r_idx >= n_rings - 2:  # Upper temple / forehead level -> hair color (zero bald spots)!
                cheek_hair_faces.append(f_verts)
                cheek_hair_uvs.append(f_uv)
            else:
                cheek_skin_faces.append(f_verts)
                cheek_skin_uvs.append(f_uv)
    if cheek_skin_faces:
        mesh.add_strip_faces(cheek_skin_faces, cheek_skin_uvs, 12, 16, skin_painter)
    if cheek_hair_faces:
        mesh.add_strip_faces(cheek_hair_faces, cheek_hair_uvs, 12, 16, hair_painter)

    # 3) Sides & Back of head (indices 2..6) mapped to hair
    back_faces = []
    back_uvs = []
    for r_idx in range(n_rings - 1):
        v0 = r_idx / (n_rings - 1)
        v1 = (r_idx + 1) / (n_rings - 1)
        for idx_pos, i in enumerate([2, 3, 4, 5, 6]):
            ni = (i + 1) % n_pts
            u0 = idx_pos / 5.0
            u1 = (idx_pos + 1) / 5.0
            back_faces.append([
                ring_vkeys[r_idx][i],
                ring_vkeys[r_idx][ni],
                ring_vkeys[r_idx + 1][ni],
                ring_vkeys[r_idx + 1][i],
            ])
            back_uvs.append([(u0, 1.0 - v0), (u1, 1.0 - v0), (u1, 1.0 - v1), (u0, 1.0 - v1)])
    mesh.add_strip_faces(back_faces, back_uvs, 32, 24, hair_painter)

    # 4) Top & Bottom Caps
    top_c = mesh.add_vertex_world(0, y_top, 0.05)
    bot_c = mesh.add_vertex_world(0, y_bot, -hd * 0.12)
    top_faces, top_uvs = [], []
    bot_faces, bot_uvs = [], []
    for i in range(n_pts):
        ni = (i + 1) % n_pts
        top_faces.append([top_c, ring_vkeys[-1][i], ring_vkeys[-1][ni]])
        top_uvs.append([(0.5, 0.5), (0.0, 1.0), (1.0, 1.0)])
        bot_faces.append([bot_c, ring_vkeys[0][ni], ring_vkeys[0][i]])
        bot_uvs.append([(0.5, 0.5), (1.0, 0.0), (0.0, 0.0)])
    mesh.add_strip_faces(top_faces, top_uvs, 16, 16, hair_painter)
    mesh.add_strip_faces(bot_faces, bot_uvs, 12, 12, skin_painter)

    return mesh


def build_open_coat_arc_mesh(
    name,
    group_path,
    origin,
    levels,
    outer_painter,
    inner_painter,
    trim_painter,
    thickness=0.14,
    open_half_deg=26.0,
    n_arc=11,
):
    """
    Builds a hollow, open-front flared coat/skirt mesh (NO closed bottom disc!).
    levels: list of (y, rx, rz, z_shift, open_scale) from bottom to top.
    Arc runs CCW from front-left (-Z, -X) around back (+Z) to front-right (-Z, +X).
    """
    mesh = PolyMesh(name, group_path, origin=origin)
    n_levels = len(levels)

    # Front (-Z) is at angle +90 deg in (cos(a), -sin(a)) space!
    # Going CCW (+a) from 90 + open_deg -> 180 (-X) -> 270 (+Z back) -> 360 (+X) -> 450 - open_deg (front-right)
    outer_rings = []
    inner_rings = []
    for (yy, rx, rz, z_shift, open_sc) in levels:
        half_rad = math.radians(open_half_deg * open_sc)
        a_start = math.pi * 0.5 + half_rad
        a_end = math.pi * 2.5 - half_rad
        o_pts, i_pts = [], []
        for k in range(n_arc):
            t = k / (n_arc - 1)
            ang = a_start + t * (a_end - a_start)
            ca, sa = math.cos(ang), -math.sin(ang)
            ox, oz = rx * ca, rz * sa + z_shift
            ix, iz = max(0.2, rx - thickness) * ca, max(0.2, rz - thickness) * sa + z_shift
            o_pts.append(mesh.add_vertex_world(ox, yy, oz))
            i_pts.append(mesh.add_vertex_world(ix, yy, iz))
        outer_rings.append(o_pts)
        inner_rings.append(i_pts)

    # Outer surface (outward normals)
    o_faces, o_uvs = [], []
    i_faces, i_uvs = [], []
    for r in range(n_levels - 1):
        v0 = 1.0 - r / (n_levels - 1)
        v1 = 1.0 - (r + 1) / (n_levels - 1)
        for k in range(n_arc - 1):
            u0 = k / (n_arc - 1)
            u1 = (k + 1) / (n_arc - 1)
            o_faces.append([outer_rings[r][k], outer_rings[r][k + 1], outer_rings[r + 1][k + 1], outer_rings[r + 1][k]])
            o_uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
            # Inner lining (inward normals -> reversed winding)
            i_faces.append([inner_rings[r][k + 1], inner_rings[r][k], inner_rings[r + 1][k], inner_rings[r + 1][k + 1]])
            i_uvs.append([(u1, v0), (u0, v0), (u0, v1), (u1, v1)])

    mesh.add_strip_faces(o_faces, o_uvs, 48, 32, outer_painter)
    mesh.add_strip_faces(i_faces, i_uvs, 16, 16, inner_painter)

    # Thickness rims: bottom hem rim + front-left vertical edge + front-right vertical edge
    rim_faces, rim_uvs = [], []
    for k in range(n_arc - 1):
        rim_faces.append([inner_rings[0][k], inner_rings[0][k + 1], outer_rings[0][k + 1], outer_rings[0][k]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
    for r in range(n_levels - 1):
        # Front-left edge (k = 0)
        rim_faces.append([inner_rings[r][0], outer_rings[r][0], outer_rings[r + 1][0], inner_rings[r + 1][0]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
        # Front-right edge (k = n_arc - 1)
        ke = n_arc - 1
        rim_faces.append([outer_rings[r][ke], inner_rings[r][ke], inner_rings[r + 1][ke], outer_rings[r + 1][ke]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
    mesh.add_strip_faces(rim_faces, rim_uvs, 16, 8, trim_painter)

    return mesh


def build_hair_strand_mesh(
    name,
    group_path,
    origin,
    rotation,
    width,
    depth,
    length,
    tip_offset=(0.0, 0.0),
    mid_bulge=1.1,
    painter=None,
    n_sides=6,
    n_rings=4,
    curve_z=0.0,
):
    """
    Creates a smooth multi-segment 3D pointed, tapering hair strand (PolyMesh) hanging downward (-Y) from origin.
    Wide at root, gently curved/bulging along its length, tapering to a sharp 3D point at the tip.
    """
    mesh = PolyMesh(name, group_path, origin=origin, rotation=rotation)
    hw = width * 0.5
    hd = depth * 0.5
    n_sides = max(4, int(n_sides))
    n_rings = max(2, int(n_rings))

    ring_vkeys = []
    for r_idx in range(n_rings):
        t = r_idx / float(n_rings)
        scale = max(0.12, (1.0 - (t ** 1.55)) * (1.0 + (mid_bulge - 1.0) * math.sin(math.pi * t)))
        rx = hw * scale
        rz = hd * scale
        yy = -length * t
        cx = tip_offset[0] * (t ** 1.45)
        cz = tip_offset[1] * (t ** 1.45) + curve_z * math.sin(math.pi * t)
        ring = []
        for i in range(n_sides):
            ang = 2.0 * math.pi * i / n_sides
            ring.append(mesh.add_vertex_local(cx + rx * math.cos(ang), yy, cz - rz * math.sin(ang)))
        ring_vkeys.append(ring)

    tip = mesh.add_vertex_local(tip_offset[0], -length, tip_offset[1])
    root_c = mesh.add_vertex_local(0.0, 0.0, 0.0)

    tw = max(4, min(32, int(round(width * 8))))
    th = max(8, min(48, int(round(length * 8))))

    faces = []
    uvs = []
    for r_idx in range(n_rings - 1):
        v0 = r_idx / float(n_rings)
        v1 = (r_idx + 1) / float(n_rings)
        for i in range(n_sides):
            ni = (i + 1) % n_sides
            u0 = i / float(n_sides)
            u1 = (i + 1) / float(n_sides)
            faces.append([ring_vkeys[r_idx][ni], ring_vkeys[r_idx][i], ring_vkeys[r_idx + 1][i], ring_vkeys[r_idx + 1][ni]])
            uvs.append([(u1, v0), (u0, v0), (u0, v1), (u1, v1)])

    v_last = (n_rings - 1) / float(n_rings)
    last_r = ring_vkeys[-1]
    for i in range(n_sides):
        ni = (i + 1) % n_sides
        u0 = i / float(n_sides)
        u1 = (i + 1) / float(n_sides)
        faces.append([last_r[ni], last_r[i], tip])
        uvs.append([(u1, v_last), (u0, v_last), (0.5 * (u0 + u1), 1.0)])

    for i in range(n_sides):
        ni = (i + 1) % n_sides
        faces.append([root_c, ring_vkeys[0][i], ring_vkeys[0][ni]])
        uvs.append([(0.5, 0.1), (0.0, 0.0), (1.0, 0.0)])

    mesh.add_strip_faces(faces, uvs, tw, th, painter)
    return mesh


def build_multi_strand_hair_layer(
    name_prefix,
    group_path,
    base_origin,
    strand_specs,
    painter=None,
    n_sides=6,
    n_rings=4,
):
    """
    Builds a list of layered 3D hair strand PolyMeshes around base_origin.
    strand_specs: iterable of dicts or tuples:
      (sub_name, offset_xyz, rotation, width, depth, length, tip_offset, mid_bulge[, curve_z])
    """
    meshes = []
    bx, by, bz = base_origin
    for idx, spec in enumerate(strand_specs):
        if isinstance(spec, dict):
            sub_name = spec.get("name", f"{name_prefix}_{idx}")
            off = spec.get("offset", (0.0, 0.0, 0.0))
            rot = spec.get("rotation", (0.0, 0.0, 0.0))
            w = spec["width"]
            d = spec["depth"]
            l = spec["length"]
            tip_off = spec.get("tip_offset", (0.0, 0.0))
            bulge = spec.get("mid_bulge", 1.1)
            cz = spec.get("curve_z", 0.0)
            p_fn = spec.get("painter", painter)
        else:
            sub_name = spec[0]
            off, rot, w, d, l, tip_off, bulge = spec[1:8]
            cz = spec[8] if len(spec) > 8 else 0.0
            p_fn = painter
        origin = [bx + off[0], by + off[1], bz + off[2]]
        meshes.append(
            build_hair_strand_mesh(
                f"{name_prefix}_{sub_name}" if not str(sub_name).startswith(name_prefix) else sub_name,
                group_path,
                origin=origin,
                rotation=rot,
                width=w,
                depth=d,
                length=l,
                tip_offset=tip_off,
                mid_bulge=bulge,
                painter=p_fn,
                n_sides=n_sides,
                n_rings=n_rings,
                curve_z=cz,
            )
        )
    return meshes


def build_beveled_box_mesh(
    name,
    group_path,
    x0, y0, z0,
    x1, y1, z1,
    bevel=0.18,
    origin=None,
    rotation=None,
    painter=None,
):
    """
    Creates a chamfered/beveled 3D box (octagonal cross-section with beveled top/bottom)
    eliminating harsh 90-degree Minecraft edges.
    """
    cx = (x0 + x1) * 0.5
    cy = (y0 + y1) * 0.5
    cz = (z0 + z1) * 0.5
    orig = origin if origin else [cx, cy, cz]

    w = abs(x1 - x0)
    h = abs(y1 - y0)
    d = abs(z1 - z0)
    bx = min(bevel, w * 0.28)
    by = min(bevel, h * 0.25)
    bz = min(bevel, d * 0.28)

    def oct_ring(yy, inset_x=0.0, inset_z=0.0):
        ix0, ix1 = x0 + inset_x, x1 - inset_x
        iz0, iz1 = z0 + inset_z, z1 - inset_z
        # CCW order looking from +Y down for outward-facing normals
        return [
            (ix0 + bx, yy, iz0),
            (ix0, yy, iz0 + bz),
            (ix0, yy, iz1 - bz),
            (ix0 + bx, yy, iz1),
            (ix1 - bx, yy, iz1),
            (ix1, yy, iz1 - bz),
            (ix1, yy, iz0 + bz),
            (ix1 - bx, yy, iz0),
        ]

    rings = [
        oct_ring(y0, bx * 0.7, bz * 0.7),
        oct_ring(y0 + by, 0.0, 0.0),
        oct_ring(y1 - by, 0.0, 0.0),
        oct_ring(y1, bx * 0.7, bz * 0.7),
    ]
    return build_lofted_mesh(
        name, group_path, rings, orig, rotation=rotation,
        side_painter=painter, cap_top_painter=painter, cap_bot_painter=painter,
        tex_scale=4,
    )


def build_tapered_cylinder(
    name,
    group_path,
    origin,
    r_bottom,
    r_top,
    height,
    n_sides=12,
    n_rings=4,
    axis="y",
    rotation=None,
    bulge=1.0,
    side_painter=None,
    cap_top_painter=None,
    cap_bot_painter=None,
    tex_scale=6,
    max_tex=128,
):
    """
    Builds a smooth tapered cylinder / cone-frustum along 'y', 'z', or 'x' centered at origin.
    Great for gun barrels, suppressors, gas mask filters, canisters, scopes, hilts, and boots.
    """
    cx, cy, cz = origin
    n_sides = max(6, int(n_sides))
    n_rings = max(2, int(n_rings))
    half_h = height * 0.5
    r_b = max(0.01, float(r_bottom))
    r_t = max(0.01, float(r_top))

    rings = []
    for r_idx in range(n_rings):
        t = r_idx / float(n_rings - 1)
        pos = -half_h + t * height
        rad = (r_b + (r_t - r_b) * t) * (1.0 + (bulge - 1.0) * math.sin(math.pi * t))
        pts = []
        for i in range(n_sides):
            ang = 2.0 * math.pi * i / n_sides
            ca, sa = math.cos(ang), math.sin(ang)
            if axis == "z":
                pts.append((cx + rad * ca, cy + rad * sa, cz + pos))
            elif axis == "x":
                pts.append((cx + pos, cy + rad * ca, cz + rad * sa))
            else:  # 'y'
                pts.append((cx + rad * ca, cy + pos, cz - rad * sa))
        rings.append(pts)

    return build_lofted_mesh(
        name,
        group_path,
        rings,
        origin=origin,
        rotation=rotation,
        side_painter=side_painter,
        cap_top_painter=cap_top_painter if cap_top_painter is not None else side_painter,
        cap_bot_painter=cap_bot_painter if cap_bot_painter is not None else side_painter,
        tex_scale=tex_scale,
        max_tex=max_tex,
    )


def build_cylinder_mesh(
    name,
    group_path,
    origin,
    radius,
    height,
    n_sides=12,
    axis="y",
    rotation=None,
    side_painter=None,
    cap_top_painter=None,
    cap_bot_painter=None,
    tex_scale=6,
    max_tex=128,
):
    """Builds a smooth uniform cylinder along 'y', 'z', or 'x' centered at origin."""
    return build_tapered_cylinder(
        name=name,
        group_path=group_path,
        origin=origin,
        r_bottom=radius,
        r_top=radius,
        height=height,
        n_sides=n_sides,
        n_rings=2,
        axis=axis,
        rotation=rotation,
        bulge=1.0,
        side_painter=side_painter,
        cap_top_painter=cap_top_painter,
        cap_bot_painter=cap_bot_painter,
        tex_scale=tex_scale,
        max_tex=max_tex,
    )


def build_armor_plate(
    name,
    group_path,
    origin,
    width,
    height,
    thickness=0.28,
    curve_z=0.35,
    bevel=0.10,
    rotation=None,
    painter=None,
    trim_painter=None,
    n_cols=5,
    n_rows=4,
):
    """
    Builds a curved, beveled 3D armor plate / pauldron / chest plate / knee pad centered at origin.
    Faces -Z (front) and curves backward (+Z) toward left/right edges.
    """
    mesh = PolyMesh(name, group_path, origin=origin, rotation=rotation)
    hw = width * 0.5
    hh = height * 0.5
    n_cols = max(3, int(n_cols))
    n_rows = max(3, int(n_rows))
    bx = min(bevel, width * 0.18)
    by = min(bevel, height * 0.18)

    outer_grid = []
    inner_grid = []
    for r in range(n_rows):
        v = r / float(n_rows - 1)
        sy = -hh + v * height
        edge_y = 1.0 if (0 < r < n_rows - 1) else 0.92
        o_row, i_row = [], []
        for c in range(n_cols):
            u = (c / float(n_cols - 1)) * 2.0 - 1.0  # [-1..1]
            sx = u * hw * edge_y
            # Parabolic wrap along +Z
            sz = curve_z * (u * u)
            # Slight bevel inset on perimeter
            is_edge = (r == 0 or r == n_rows - 1 or c == 0 or c == n_cols - 1)
            z_off = (thickness * 0.35) if is_edge else 0.0
            o_row.append(mesh.add_vertex_local(sx, sy, sz - thickness * 0.5 + z_off))
            i_row.append(mesh.add_vertex_local(sx * 0.96, sy * 0.96, sz + thickness * 0.5))
        outer_grid.append(o_row)
        inner_grid.append(i_row)

    o_faces, o_uvs = [], []
    i_faces, i_uvs = [], []
    for r in range(n_rows - 1):
        v0 = 1.0 - r / float(n_rows - 1)
        v1 = 1.0 - (r + 1) / float(n_rows - 1)
        for c in range(n_cols - 1):
            u0 = c / float(n_cols - 1)
            u1 = (c + 1) / float(n_cols - 1)
            # Outer front (-Z) normal: (+X) x (+Y) = +Z, so (-X) x (+Y) = -Z
            o_faces.append([outer_grid[r][c + 1], outer_grid[r][c], outer_grid[r + 1][c], outer_grid[r + 1][c + 1]])
            o_uvs.append([(u1, v0), (u0, v0), (u0, v1), (u1, v1)])
            i_faces.append([inner_grid[r][c], inner_grid[r][c + 1], inner_grid[r + 1][c + 1], inner_grid[r + 1][c]])
            i_uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

    tw = max(8, min(64, int(round(width * 6))))
    th = max(8, min(64, int(round(height * 6))))
    mesh.add_strip_faces(o_faces, o_uvs, tw, th, painter)
    mesh.add_strip_faces(i_faces, i_uvs, max(6, tw // 2), max(6, th // 2), trim_painter or painter)

    # Perimeter rim stitching outer & inner
    rim_faces, rim_uvs = [], []
    for c in range(n_cols - 1):
        # Bottom rim
        rim_faces.append([inner_grid[0][c + 1], inner_grid[0][c], outer_grid[0][c], outer_grid[0][c + 1]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
        # Top rim
        rim_faces.append([outer_grid[-1][c + 1], outer_grid[-1][c], inner_grid[-1][c], inner_grid[-1][c + 1]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
    for r in range(n_rows - 1):
        # Left rim (c=0)
        rim_faces.append([outer_grid[r][0], inner_grid[r][0], inner_grid[r + 1][0], outer_grid[r + 1][0]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
        # Right rim (c=n_cols-1)
        ce = n_cols - 1
        rim_faces.append([inner_grid[r][ce], outer_grid[r][ce], outer_grid[r + 1][ce], inner_grid[r + 1][ce]])
        rim_uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
    mesh.add_strip_faces(rim_faces, rim_uvs, 12, 8, trim_painter or painter)
    return mesh


def build_buckle_assembly(
    name_prefix,
    group_path,
    origin,
    width=1.1,
    height=0.85,
    depth=0.28,
    rotation=None,
    frame_painter=None,
    pin_painter=None,
):
    """
    Builds a 3D metallic belt/boot buckle assembly (4 beveled frame bars + center prong pin).
    Returns a list[PolyMesh].
    """
    ox, oy, oz = origin
    hw, hh, hd = width * 0.5, height * 0.5, depth * 0.5
    bar = min(width, height) * 0.20
    bev = min(0.05, bar * 0.25)

    parts = [
        build_beveled_box_mesh(
            f"{name_prefix}_top", group_path,
            ox - hw, oy + hh - bar, oz - hd,
            ox + hw, oy + hh, oz + hd,
            bevel=bev, origin=origin, rotation=rotation, painter=frame_painter,
        ),
        build_beveled_box_mesh(
            f"{name_prefix}_bot", group_path,
            ox - hw, oy - hh, oz - hd,
            ox + hw, oy - hh + bar, oz + hd,
            bevel=bev, origin=origin, rotation=rotation, painter=frame_painter,
        ),
        build_beveled_box_mesh(
            f"{name_prefix}_left", group_path,
            ox - hw, oy - hh + bar * 0.5, oz - hd,
            ox - hw + bar, oy + hh - bar * 0.5, oz + hd,
            bevel=bev, origin=origin, rotation=rotation, painter=frame_painter,
        ),
        build_beveled_box_mesh(
            f"{name_prefix}_right", group_path,
            ox + hw - bar, oy - hh + bar * 0.5, oz - hd,
            ox + hw, oy + hh - bar * 0.5, oz + hd,
            bevel=bev, origin=origin, rotation=rotation, painter=frame_painter,
        ),
        build_beveled_box_mesh(
            f"{name_prefix}_pin", group_path,
            ox - bar * 0.35, oy - bar * 0.4, oz - hd * 1.15,
            ox + hw * 0.45, oy + bar * 0.4, oz + hd * 0.4,
            bevel=bev * 0.5, origin=origin, rotation=rotation, painter=pin_painter or frame_painter,
        ),
    ]
    return parts


def build_pouch_mesh(
    name,
    group_path,
    origin,
    width=1.0,
    height=1.3,
    depth=0.65,
    rotation=None,
    body_painter=None,
    flap_painter=None,
    buckle_painter=None,
):
    """
    Builds a detailed tactical pouch PolyMesh (beveled pouch body + overhanging top flap + front clasp)
    with separate material patches for body, flap, and clasp.
    """
    mesh = PolyMesh(name, group_path, origin=origin, rotation=rotation)
    hw, hh, hd = width * 0.5, height * 0.5, depth * 0.5
    bev = min(0.10, width * 0.14, depth * 0.18)

    def add_beveled_subbox(x0, y0, z0, x1, y1, z1, b, painter, tw=16, th=16):
        bx = min(b, abs(x1 - x0) * 0.25)
        by = min(b, abs(y1 - y0) * 0.25)
        bz = min(b, abs(z1 - z0) * 0.25)

        def oct_ring(yy, ix=0.0, iz=0.0):
            ax0, ax1 = x0 + ix, x1 - ix
            az0, az1 = z0 + iz, z1 - iz
            pts = [
                (ax0 + bx, yy, az0), (ax0, yy, az0 + bz),
                (ax0, yy, az1 - bz), (ax0 + bx, yy, az1),
                (ax1 - bx, yy, az1), (ax1, yy, az1 - bz),
                (ax1, yy, az0 + bz), (ax1 - bx, yy, az0),
            ]
            return [mesh.add_vertex_local(px, py, pz) for (px, py, pz) in pts]

        rings = [
            oct_ring(y0, bx * 0.6, bz * 0.6),
            oct_ring(y0 + by, 0.0, 0.0),
            oct_ring(y1 - by, 0.0, 0.0),
            oct_ring(y1, bx * 0.6, bz * 0.6),
        ]
        s_faces, s_uvs = [], []
        n_pts = 8
        for r_idx in range(len(rings) - 1):
            v0 = 1.0 - r_idx / float(len(rings) - 1)
            v1 = 1.0 - (r_idx + 1) / float(len(rings) - 1)
            for i in range(n_pts):
                ni = (i + 1) % n_pts
                u0, u1 = i / float(n_pts), (i + 1) / float(n_pts)
                s_faces.append([rings[r_idx][i], rings[r_idx][ni], rings[r_idx + 1][ni], rings[r_idx + 1][i]])
                s_uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
        # Top & bottom caps
        cx, cz = (x0 + x1) * 0.5, (z0 + z1) * 0.5
        tc = mesh.add_vertex_local(cx, y1, cz)
        bc = mesh.add_vertex_local(cx, y0, cz)
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            s_faces.append([tc, rings[-1][i], rings[-1][ni]])
            s_uvs.append([(0.5, 0.5), (0.0, 1.0), (1.0, 1.0)])
            s_faces.append([bc, rings[0][ni], rings[0][i]])
            s_uvs.append([(0.5, 0.5), (1.0, 0.0), (0.0, 0.0)])
        mesh.add_strip_faces(s_faces, s_uvs, tw, th, painter)

    # Main pouch body
    add_beveled_subbox(-hw, -hh, -hd, hw, hh * 0.82, hd, bev, body_painter, tw=24, th=24)
    # Overhanging top flap
    add_beveled_subbox(
        -hw * 1.04, hh * 0.25, -hd * 1.12,
        hw * 1.04, hh, hd * 1.05,
        bev * 0.8, flap_painter or body_painter, tw=20, th=16,
    )
    # Front snap/clasp tab
    add_beveled_subbox(
        -hw * 0.26, hh * 0.08, -hd * 1.22,
        hw * 0.26, hh * 0.42, -hd * 0.95,
        bev * 0.4, buckle_painter or flap_painter or body_painter, tw=8, th=8,
    )
    return mesh


def build_sculpted_bust_mesh(
    name,
    group_path,
    origin,
    chest_y_bot,
    chest_y_top,
    bust_z_front,
    width,
    painter,
    cleavage_depth=0.18,
):
    """
    Builds a smooth, feminine, multi-ring anatomical bust mesh (no boxy cubes)
    with a gentle upper slope from the collarbone down to rounded fullness,
    subtle center cleavage contour, and clean under-bust curve.
    Vertices are ordered CCW looking from +Y down for outward-facing normals.
    """
    ox = float(origin[0])
    oz = float(origin[2])
    hw = max(0.4, float(width) * 0.5)
    h = max(0.4, float(chest_y_top) - float(chest_y_bot))

    # Anchor back of bust slightly inside the torso front wall without poking out the back
    z_base = min(oz + 0.45, float(bust_z_front) + max(1.1, float(width) * 0.24))
    max_proj = max(0.35, z_base - float(bust_z_front))
    cleav_max = min(float(cleavage_depth), max_proj * 0.65)

    # (t_y, width_scale, forward_proj_scale, cleavage_scale) from bottom to top
    profile = [
        (0.00, 0.80, 0.14, 0.05),  # Under-bust tuck
        (0.22, 0.96, 0.72, 0.65),  # Lower rounded fullness
        (0.45, 1.00, 1.00, 1.00),  # Bust apex / peak fullness
        (0.68, 0.95, 0.76, 0.55),  # Upper-mid slope
        (0.86, 0.88, 0.36, 0.20),  # Upper chest slope
        (1.00, 0.76, 0.06, 0.00),  # Collarbone / sternum blend
    ]

    rings = []
    for t_y, w_sc, p_sc, c_sc in profile:
        yy = float(chest_y_bot) + h * t_y
        rw = hw * w_sc
        d_front = max_proj * p_sc
        cleav = cleav_max * c_sc
        z_cleav = z_base - max(0.04, d_front - cleav)

        # 12-point anatomical contour in CCW order looking from +Y down (-Z is front)
        rings.append([
            (ox + rw * 0.98, yy, z_base),                    # 0: Right side seam
            (ox + rw * 0.92, yy, z_base - d_front * 0.46),   # 1: Right outer curve
            (ox + rw * 0.70, yy, z_base - d_front * 0.88),   # 2: Right outer fullness
            (ox + rw * 0.44, yy, z_base - d_front * 1.00),   # 3: Right apex
            (ox + rw * 0.19, yy, z_base - d_front * 0.84),   # 4: Right inner slope
            (ox,             yy, z_cleav),                   # 5: Center cleavage contour
            (ox - rw * 0.19, yy, z_base - d_front * 0.84),   # 6: Left inner slope
            (ox - rw * 0.44, yy, z_base - d_front * 1.00),   # 7: Left apex
            (ox - rw * 0.70, yy, z_base - d_front * 0.88),   # 8: Left outer fullness
            (ox - rw * 0.92, yy, z_base - d_front * 0.46),   # 9: Left outer curve
            (ox - rw * 0.98, yy, z_base),                    # 10: Left side seam
            (ox,             yy, z_base + 0.18),             # 11: Back anchor (inside torso)
        ])

    return build_lofted_mesh(
        name=name,
        group_path=group_path,
        rings=rings,
        origin=origin,
        side_painter=painter,
        cap_top_painter=painter,
        cap_bot_painter=painter,
        tex_scale=6,
        max_tex=128,
    )


def _resolve_limb_radii(radii, keys, defaults):
    """Normalizes dict, sequence, or scalar radii into a keyed dict of floats."""
    if isinstance(radii, dict):
        return {k: max(0.12, float(radii.get(k, d))) for k, d in zip(keys, defaults)}
    if isinstance(radii, (list, tuple)):
        vals = list(radii)
        return {
            k: max(0.12, float(vals[i] if i < len(vals) else d))
            for i, (k, d) in enumerate(zip(keys, defaults))
        }
    val = max(0.12, float(radii))
    return {k: val * (d / defaults[0]) for k, d in zip(keys, defaults)}


def build_muscular_limb_mesh(
    name,
    group_path,
    origin,
    ring_specs,
    n_sides=10,
    rotation=None,
    side_painter=None,
    cap_top_painter=None,
    cap_bot_painter=None,
    tex_scale=6,
    max_tex=128,
):
    """
    Lofts a smooth, multi-ring elliptical limb segment from ring_specs:
      each item is (cx, cy, cz, rx, rz) or (cx, cy, cz, rx, rz, angle_offset).
    Automatically orders rings bottom-to-top (+Y) so normals face outward.
    """
    ordered = sorted(ring_specs, key=lambda r: r[1])
    rings = []
    for spec in ordered:
        cx, cy, cz, rx, rz = spec[:5]
        ang_off = spec[5] if len(spec) > 5 else 0.0
        rings.append(make_ellipse_ring(cx, cy, cz, rx, rz, n_pts=n_sides, angle_offset=ang_off))

    return build_lofted_mesh(
        name=name,
        group_path=group_path,
        rings=rings,
        origin=origin,
        rotation=rotation,
        side_painter=side_painter,
        cap_top_painter=cap_top_painter if cap_top_painter is not None else side_painter,
        cap_bot_painter=cap_bot_painter if cap_bot_painter is not None else side_painter,
        tex_scale=tex_scale,
        max_tex=max_tex,
    )


def _lerp_pt(p0, p1, t):
    return (
        p0[0] + (p1[0] - p0[0]) * t,
        p0[1] + (p1[1] - p0[1]) * t,
        p0[2] + (p1[2] - p0[2]) * t,
    )


def build_anatomical_arm_parts(
    side,
    sign,
    arm_grp,
    shoulder_pos,
    elbow_pos,
    wrist_pos,
    radii,
    sleeve_painter,
    skin_painter,
    glove_painter,
):
    """
    Builds a high-detail anatomical arm assembly (no straight stick limbs):
      - Sculpted deltoid shoulder cap overlapping torso by >= 0.45u (zero gap)
      - Multi-ring upper arm with deltoid-to-bicep curve & elbow taper
      - Multi-ring forearm with muscle swell & wrist taper
      - Beveled wrist cuff
      - Articulated multi-part hand: palm + angled thumb + curved finger block
    Returns a list of PolyMesh elements.
    """
    r = _resolve_limb_radii(
        radii,
        ["shoulder", "bicep", "elbow", "forearm", "wrist"],
        [1.15, 1.02, 0.82, 0.88, 0.68],
    )
    upper_p = sleeve_painter or skin_painter
    lower_p = skin_painter or sleeve_painter
    hand_p = glove_painter or skin_painter or sleeve_painter
    cuff_p = glove_painter or sleeve_painter or skin_painter

    sx, sy, sz = shoulder_pos
    ex, ey, ez = elbow_pos
    wx, wy, wz = wrist_pos
    parts = []

    # 1. Sculpted deltoid shoulder cap overlapping torso inward by >= 0.45u
    inward_shift = -sign * 0.48
    cap_specs = [
        (sx + inward_shift * 0.35, sy - r["shoulder"] * 0.55, sz, r["shoulder"] * 0.96, r["shoulder"] * 0.92),
        (sx + inward_shift * 0.55, sy - r["shoulder"] * 0.05, sz, r["shoulder"] * 1.12, r["shoulder"] * 1.04),
        (sx + inward_shift * 0.65, sy + r["shoulder"] * 0.42, sz, r["shoulder"] * 0.96, r["shoulder"] * 0.90),
        (sx + inward_shift * 0.72, sy + r["shoulder"] * 0.74, sz, r["shoulder"] * 0.58, r["shoulder"] * 0.55),
    ]
    parts.append(build_muscular_limb_mesh(
        f"ShoulderCap_{side}", arm_grp, shoulder_pos, cap_specs, n_sides=10, side_painter=upper_p,
    ))

    # 2. Upper arm: elbow taper -> bicep curve -> deltoid root
    upper_specs = []
    for t, rad, z_off in [
        (0.00, r["elbow"] * 0.95, 0.00),
        (0.28, r["bicep"] * 0.94, -0.05),
        (0.58, r["bicep"] * 1.06, -0.08),
        (0.84, r["shoulder"] * 0.98, -0.03),
        (1.00, r["shoulder"] * 1.02, 0.00),
    ]:
        px, py, pz = _lerp_pt(elbow_pos, shoulder_pos, t)
        upper_specs.append((px, py, pz + z_off, rad * 0.96, rad * 1.04))
    parts.append(build_muscular_limb_mesh(
        f"UpperArm_{side}", arm_grp, shoulder_pos, upper_specs, n_sides=10, side_painter=upper_p,
    ))

    # 3. Forearm: wrist taper -> forearm muscle curve -> elbow joint
    forearm_specs = []
    for t, rad, z_off in [
        (0.00, r["wrist"] * 0.96, 0.00),
        (0.32, r["wrist"] * 1.08, -0.03),
        (0.68, r["forearm"] * 1.05, -0.07),
        (1.00, r["elbow"] * 0.98, 0.00),
    ]:
        px, py, pz = _lerp_pt(wrist_pos, elbow_pos, t)
        forearm_specs.append((px, py, pz + z_off, rad * 0.95, rad * 1.05))
    parts.append(build_muscular_limb_mesh(
        f"Forearm_{side}", arm_grp, elbow_pos, forearm_specs, n_sides=10, side_painter=lower_p,
    ))

    # 4. Wrist cuff
    cuff_h = max(0.45, r["wrist"] * 0.75)
    cuff_specs = [
        (wx, wy - cuff_h * 0.35, wz, r["wrist"] * 1.08, r["wrist"] * 1.12),
        (wx, wy + cuff_h * 0.15, wz, r["wrist"] * 1.18, r["wrist"] * 1.22),
        (wx, wy + cuff_h * 0.65, wz, r["wrist"] * 1.12, r["wrist"] * 1.16),
    ]
    parts.append(build_muscular_limb_mesh(
        f"WristCuff_{side}", arm_grp, wrist_pos, cuff_specs, n_sides=10, side_painter=cuff_p,
    ))

    # 5. Articulated multi-part hand: palm + thumb + finger block
    palm_w = r["wrist"] * 0.78
    palm_h = max(0.85, r["wrist"] * 1.45)
    palm_d = r["wrist"] * 1.15
    palm_y1 = wy - cuff_h * 0.20
    palm_y0 = palm_y1 - palm_h
    parts.append(build_beveled_box_mesh(
        f"HandPalm_{side}",
        arm_grp,
        wx - palm_w, palm_y0, wz - palm_d,
        wx + palm_w, palm_y1, wz + palm_d,
        bevel=min(0.16, palm_w * 0.28),
        origin=wrist_pos,
        painter=hand_p,
    ))

    # Angled thumb on the front/inner side (-Z, -sign * X)
    thumb_len = palm_h * 0.72
    thumb_r = max(0.18, r["wrist"] * 0.32)
    thumb_origin = [wx - sign * palm_w * 0.78, palm_y1 - palm_h * 0.42, wz - palm_d * 0.62]
    parts.append(build_tapered_cylinder(
        f"HandThumb_{side}",
        arm_grp,
        origin=thumb_origin,
        r_bottom=thumb_r * 0.78,
        r_top=thumb_r,
        height=thumb_len,
        n_sides=8,
        n_rings=3,
        rotation=[-24, 0, sign * 22],
        side_painter=hand_p,
    ))

    # Articulated finger block extending below the palm with slight forward curl
    finger_h = palm_h * 0.85
    finger_origin = [wx, palm_y0 + 0.08, wz - palm_d * 0.08]
    parts.append(build_beveled_box_mesh(
        f"HandFingers_{side}",
        arm_grp,
        wx - palm_w * 0.92, palm_y0 - finger_h, wz - palm_d * 0.88,
        wx + palm_w * 0.92, palm_y0 + 0.12, wz + palm_d * 0.72,
        bevel=min(0.15, palm_w * 0.25),
        origin=finger_origin,
        rotation=[12, 0, 0],
        painter=hand_p,
    ))

    return parts


def build_anatomical_leg_parts(
    side,
    sign,
    leg_grp,
    hip_pos,
    knee_pos,
    ankle_pos,
    radii,
    pants_painter,
    boot_painter,
    knee_painter=None,
):
    """
    Builds a high-detail anatomical leg assembly (no straight stick limbs):
      - Multi-ring sculpted thigh with hip overlap, quad/hamstring fullness, and knee taper
      - Sculpted knee cap / patella joint
      - Multi-ring lower leg with gastrocnemius calf muscle curve and ankle taper
    Returns a list of PolyMesh elements.
    """
    r = _resolve_limb_radii(
        radii,
        ["hip", "thigh", "knee", "calf", "ankle"],
        [1.55, 1.48, 1.12, 1.24, 0.88],
    )
    upper_p = pants_painter or boot_painter
    lower_p = boot_painter or pants_painter
    patella_p = knee_painter or upper_p

    kx, ky, kz = knee_pos
    parts = []

    # 1. Thigh: knee taper -> quad/hamstring fullness -> hip overlap (+0.45u)
    thigh_specs = []
    for t, rx_sc, rz_sc, z_off in [
        (0.00, r["knee"] * 0.96, r["knee"] * 1.00, 0.00),
        (0.28, r["thigh"] * 0.88, r["thigh"] * 0.92, -0.06),
        (0.60, r["thigh"] * 1.02, r["thigh"] * 1.06, -0.08),
        (0.92, r["hip"] * 1.00, r["hip"] * 1.04, 0.00),
        (1.08, r["hip"] * 1.04, r["hip"] * 1.06, 0.02),  # Overlap into pelvis
    ]:
        px, py, pz = _lerp_pt(knee_pos, hip_pos, t)
        thigh_specs.append((px - sign * (0.12 if t > 0.8 else 0.0), py, pz + z_off, rx_sc, rz_sc))
    parts.append(build_muscular_limb_mesh(
        f"Thigh_{side}", leg_grp, hip_pos, thigh_specs, n_sides=10, side_painter=upper_p,
    ))

    # 2. Sculpted knee cap / joint (slightly proud on -Z front)
    kr = r["knee"]
    knee_specs = [
        (kx, ky - kr * 0.52, kz - kr * 0.08, kr * 0.96, kr * 1.04),
        (kx, ky,             kz - kr * 0.16, kr * 1.06, kr * 1.16),
        (kx, ky + kr * 0.52, kz - kr * 0.08, kr * 0.96, kr * 1.04),
    ]
    parts.append(build_muscular_limb_mesh(
        f"KneeJoint_{side}", leg_grp, knee_pos, knee_specs, n_sides=10, side_painter=patella_p,
    ))

    # 3. Lower leg: ankle taper -> gastrocnemius calf curve (+Z) -> knee joint
    calf_specs = []
    for t, rad, z_off in [
        (0.00, r["ankle"] * 0.96, 0.00),
        (0.25, r["ankle"] * 1.08, 0.05),
        (0.64, r["calf"] * 1.06, 0.18),   # Calf muscle curve toward +Z back
        (0.86, r["calf"] * 0.98, 0.08),
        (1.00, r["knee"] * 0.98, 0.00),
    ]:
        px, py, pz = _lerp_pt(ankle_pos, knee_pos, t)
        calf_specs.append((px, py, pz + z_off, rad * 0.95, rad * 1.06))
    parts.append(build_muscular_limb_mesh(
        f"Calf_{side}", leg_grp, knee_pos, calf_specs, n_sides=10, side_painter=lower_p,
    ))

    return parts


# ---------------------------------------------------------------------------
# Height Scaling & Validation Helpers
# ---------------------------------------------------------------------------
def _rotate_euler_xyz(x, y, z, rot_deg):
    rx, ry, rz = [math.radians(a) for a in rot_deg]
    if rx:
        cy, sy = math.cos(rx), math.sin(rx)
        y, z = y * cy - z * sy, y * sy + z * cy
    if ry:
        cx, sx = math.cos(ry), math.sin(ry)
        x, z = x * cx + z * sx, -x * sx + z * cx
    if rz:
        cz, sz = math.cos(rz), math.sin(rz)
        x, y = x * cz - y * sz, x * sz + y * cz
    return x, y, z


def scale_elements_to_height(elements, group_origins, target_height):
    """
    Uniformly scales all elements (vertices, from_pos, to_pos, origin) and group_origins
    around Y=0 so the character's exact top Y matches target_height (preserving ground contact Y=0).
    Returns the applied uniform scale factor.
    """
    max_y = 0.0
    for el in elements:
        if isinstance(el, PolyMesh):
            ox, oy, oz = el.origin
            has_rot = any(abs(a) > 1e-6 for a in el.rotation)
            for lx, ly, lz in el.vertices.values():
                if has_rot:
                    _, ry, _ = _rotate_euler_xyz(lx, ly, lz, el.rotation)
                    wy = oy + ry
                else:
                    wy = oy + ly
                if wy > max_y:
                    max_y = wy
        elif isinstance(el, Cuboid):
            has_rot = any(abs(a) > 1e-6 for a in el.rotation)
            if not has_rot:
                wy = max(el.from_pos[1], el.to_pos[1])
                if wy > max_y:
                    max_y = wy
            else:
                ox, oy, oz = el.origin
                xs = (el.from_pos[0], el.to_pos[0])
                ys = (el.from_pos[1], el.to_pos[1])
                zs = (el.from_pos[2], el.to_pos[2])
                for px in xs:
                    for py in ys:
                        for pz in zs:
                            _, ry, _ = _rotate_euler_xyz(px - ox, py - oy, pz - oz, el.rotation)
                            wy = oy + ry
                            if wy > max_y:
                                max_y = wy

    if max_y <= 1e-6:
        return 1.0

    s = float(target_height) / max_y
    for el in elements:
        if isinstance(el, PolyMesh):
            el.origin = [round(v * s, 4) for v in el.origin]
            for vk, pos in el.vertices.items():
                el.vertices[vk] = [round(c * s, 4) for c in pos]
        elif isinstance(el, Cuboid):
            el.from_pos = [round(v * s, 4) for v in el.from_pos]
            el.to_pos = [round(v * s, 4) for v in el.to_pos]
            el.origin = [round(v * s, 4) for v in el.origin]

    if group_origins:
        for k, orig in list(group_origins.items()):
            group_origins[k] = [round(float(v) * s, 4) for v in orig]

    return s


# ---------------------------------------------------------------------------
# Atlas Baking & BBModel Export
# ---------------------------------------------------------------------------
def bake_elements_atlas(elements, atlas_size=512, default_color=(24, 24, 28, 255), max_face_size=128):
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))
    packer = ShelfBinPacker(atlas_size, atlas_size, padding=2)

    def solid_fallback(w, h):
        return Image.new("RGBA", (w, h), default_color)

    face_dim_fns = {
        "north": lambda c: (int(round(c.dx * 5)), int(round(c.dy * 5))),
        "south": lambda c: (int(round(c.dx * 5)), int(round(c.dy * 5))),
        "east": lambda c: (int(round(c.dz * 5)), int(round(c.dy * 5))),
        "west": lambda c: (int(round(c.dz * 5)), int(round(c.dy * 5))),
        "up": lambda c: (int(round(c.dx * 5)), int(round(c.dz * 5))),
        "down": lambda c: (int(round(c.dx * 5)), int(round(c.dz * 5))),
    }

    for el in elements:
        if isinstance(el, Cuboid):
            for fname, dim_fn in face_dim_fns.items():
                fw, fh = dim_fn(el)
                fw = max(2, min(fw, max_face_size))
                fh = max(2, min(fh, max_face_size))
                u1, v1, u2, v2 = packer.pack(fw, fh)
                el.face_uvs[fname] = [u1, v1, u2, v2]
                painter = el.face_painters.get(fname, solid_fallback)
                patch = painter(fw, fh)
                if patch.size != (fw, fh):
                    patch = patch.resize((fw, fh), Image.Resampling.NEAREST)
                atlas.paste(patch, (u1, v1))
        elif isinstance(el, PolyMesh):
            for fkeys, uv_norms_list, tw, th, painter_fn in el.texture_jobs:
                tw = max(2, min(int(tw), max_face_size))
                th = max(2, min(int(th), max_face_size))
                u1, v1, u2, v2 = packer.pack(tw, th)
                p_fn = painter_fn if painter_fn else solid_fallback
                patch = p_fn(tw, th)
                if patch.size != (tw, th):
                    patch = patch.resize((tw, th), Image.Resampling.NEAREST)
                atlas.paste(patch, (u1, v1))
                for fk, uv_norms in zip(fkeys, uv_norms_list):
                    face = el.faces[fk]
                    for vk, (nx, ny) in zip(face["vertices"], uv_norms):
                        face["uv"][vk] = [
                            round(u1 + nx * (u2 - u1), 2),
                            round(v1 + ny * (v2 - v1), 2),
                        ]

    return atlas


def export_bbmodel(elements, atlas_image, model_name, output_paths, group_origins=None):
    buf = BytesIO()
    atlas_image.save(buf, format="PNG")
    atlas_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    textures = [{
        "name": f"{model_name}_texture",
        "folder": "",
        "namespace": "",
        "id": "0",
        "particle": False,
        "render_mode": "default",
        "visible": True,
        "mode": "bitmap",
        "saved": True,
        "uuid": str(uuid.uuid4()),
        "source": atlas_b64,
        "width": atlas_image.width,
        "height": atlas_image.height,
    }]

    bb_elements = []
    for el in elements:
        if isinstance(el, Cuboid):
            faces_dict = {
                fname: {"uv": el.face_uvs[fname], "texture": 0}
                for fname in ["north", "south", "east", "west", "up", "down"]
            }
            bb_elements.append({
                "name": el.name,
                "box_uv": False,
                "rescale": False,
                "locked": False,
                "from": el.from_pos,
                "to": el.to_pos,
                "autouv": 0,
                "color": 0,
                "origin": el.origin,
                "faces": faces_dict,
                "type": "cube",
                "uuid": el.uuid,
                "rotation": el.rotation,
            })
        elif isinstance(el, PolyMesh):
            bb_elements.append({
                "name": el.name,
                "color": 0,
                "origin": el.origin,
                "rotation": el.rotation,
                "vertices": el.vertices,
                "faces": el.faces,
                "type": "mesh",
                "uuid": el.uuid,
            })

    # Hierarchical Outliner Tree with custom bone origins
    group_origins = group_origins or {}
    group_map = {}

    def get_or_create_group(path):
        if isinstance(path, str):
            path = (path,)
        curr_map = group_map
        curr_children = None
        for idx, seg in enumerate(path):
            full_key = "/".join(path[: idx + 1])
            if seg not in curr_map:
                orig = group_origins.get(full_key, group_origins.get(seg, [0, 0, 0]))
                curr_map[seg] = {
                    "name": seg,
                    "origin": [round(float(v), 3) for v in orig],
                    "rotation": [0, 0, 0],
                    "color": 0,
                    "uuid": str(uuid.uuid4()),
                    "export": True,
                    "isOpen": True,
                    "locked": False,
                    "visibility": True,
                    "autouv": 0,
                    "children": [],
                    "_submap": {},
                }
            node = curr_map[seg]
            curr_map = node["_submap"]
            curr_children = node["children"]
        return curr_children

    for el in elements:
        get_or_create_group(el.group_path).append(el.uuid)

    def clean_outliner(nodes_dict):
        res = []
        for _, node in nodes_dict.items():
            submap = node.pop("_submap")
            if submap:
                node["children"] = clean_outliner(submap) + node["children"]
            res.append(node)
        return res

    bbmodel = {
        "meta": {
            "format_version": "4.9",
            "creation_time": 1700000000,
            "model_format": "generic_model",
            "box_uv": False,
        },
        "name": model_name,
        "geometry_name": model_name,
        "visible_box": [1, 1, 0],
        "variable_placeholders": "",
        "resolution": {"width": atlas_image.width, "height": atlas_image.height},
        "elements": bb_elements,
        "outliner": clean_outliner(group_map),
        "textures": textures,
    }

    for p in output_paths:
        os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(bbmodel, f, separators=(",", ":"), ensure_ascii=False)

    return bbmodel


def _compact_bbmodel_json(bbmodel_dict):
    compact = {
        "name": bbmodel_dict["name"],
        "resolution": bbmodel_dict["resolution"],
        "textures": [
            {
                "id": t["id"],
                "name": t["name"],
                "source": t["source"],
                "uuid": t["uuid"],
            }
            for t in bbmodel_dict["textures"]
        ],
        "elements": bbmodel_dict["elements"],
        "outliner": bbmodel_dict["outliner"],
    }
    return json.dumps(compact, separators=(",", ":"), ensure_ascii=False)


def _find_js_object_span(content, start_brace_idx):
    """Finds the matching '}' index for '{' at start_brace_idx, respecting JSON strings."""
    depth = 0
    in_str = False
    esc = False
    n = len(content)
    for i in range(start_brace_idx, n):
        ch = content[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return i
    raise RuntimeError("Unbalanced braces while parsing JS object in builtinBBModels.js")


def _upsert_bbmodel_in_content(content, key_name, compact_json):
    import re
    pattern = re.compile(rf'(^[ \t]*{re.escape(key_name)}\s*:\s*)\{{', re.M)
    match = pattern.search(content)
    if match:
        brace_start = match.end() - 1
        brace_end = _find_js_object_span(content, brace_start)
        return content[:match.start()] + f"{key_name}: " + compact_json + content[brace_end + 1:]

    # Key not found -> insert cleanly before closing `};` of BUILTIN_BBMODELS
    close_match = re.search(r'\n\s*\};\s*$', content)
    if not close_match:
        raise RuntimeError("Could not locate closing '};' in builtinBBModels.js")
    insert_pos = close_match.start()
    before = content[:insert_pos].rstrip()
    needs_comma = not before.endswith(",") and not before.endswith("{")
    prefix = ",\n" if needs_comma else "\n"
    return before + prefix + f"{key_name}: " + compact_json + "\n};\n"


def update_builtin_bbmodels_js(js_path, key_name, bbmodel_dict):
    """Updates or inserts a key (e.g., 'wesker', 'leon', 'hunk') inside client/src/3d/builtinBBModels.js."""
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    compact_json = _compact_bbmodel_json(bbmodel_dict)
    new_content = _upsert_bbmodel_in_content(content, key_name, compact_json)
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def register_builtin_bbmodels_bulk(js_path, models_dict):
    """
    Bulk-registers or updates multiple {key_name: bbmodel_dict} entries in client/src/3d/builtinBBModels.js.
    Creates or updates keys cleanly in a single read/write pass.
    """
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    for key_name, bbmodel_dict in models_dict.items():
        compact_json = _compact_bbmodel_json(bbmodel_dict)
        content = _upsert_bbmodel_in_content(content, key_name, compact_json)
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(content)
