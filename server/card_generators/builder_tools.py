# -*- coding: utf-8 -*-
from card_generators.common import build_pack

def make_100_unique(handcrafted, templates=None, fallback_prefix="Предмет"):
    """
    Collects 100 unique items (strings or dicts with 'text' and optional 'quality')
    from handcrafted and optional templates. Raises ValueError if fewer than 100
    unique items are provided (no lazy '#1/#2' fallback clones).
    """
    seen = set()
    result = []

    def add_item(item):
        if isinstance(item, dict):
            text = str(item.get("text", "")).strip()
            if text and text not in seen:
                seen.add(text)
                entry = dict(item)
                entry["text"] = text
                result.append(entry)
        else:
            text = str(item).strip()
            if text and text not in seen:
                seen.add(text)
                result.append(text)

    for item in handcrafted:
        add_item(item)
        if len(result) == 100:
            return result

    if templates:
        for t in templates:
            add_item(t)
            if len(result) == 100:
                return result

    raise ValueError(
        f"make_100_unique({fallback_prefix}): expected at least 100 unique items, got {len(result)}. "
        "Lazy '#1/#2' fallback clones are disabled."
    )

def make_thematic_specials(special_templates, count=100):
    """
    Builds `count` unique special cards from (text, action, description) tuples or dicts.
    Raises ValueError if fewer than `count` unique specials are provided (no '(Ранг N)' clones).
    """
    seen = set()
    specials = []
    for item in special_templates:
        if isinstance(item, dict):
            text = str(item["text"]).strip()
            action = str(item["action"]).strip()
            desc = str(item["description"]).strip()
        else:
            base_name, action, desc = item
            text = str(base_name).strip()
            action = str(action).strip()
            desc = str(desc).strip()
        if text and text not in seen:
            seen.add(text)
            specials.append({
                "text": text,
                "action": action,
                "description": desc
            })
            if len(specials) == count:
                return specials

    raise ValueError(
        f"make_thematic_specials: expected at least {count} unique specials, got {len(specials)}. "
        "'(Ранг N)' clones are disabled."
    )

def make_thematic_catastrophes(base_cats, theme_name, count=100):
    """
    Deduplicates `base_cats` and returns `count` catastrophes.
    Raises ValueError if fewer than `count` unique catastrophes are provided (no '#N' clones).
    """
    seen = set()
    cats = []
    for c in base_cats:
        text = str(c["text"]).strip()
        if text and text not in seen:
            seen.add(text)
            cats.append({
                "text": text,
                "description": str(c["description"]).strip()
            })
            if len(cats) == count:
                return cats

    raise ValueError(
        f"make_thematic_catastrophes({theme_name}): expected at least {count} unique catastrophes, got {len(cats)}. "
        "Lazy '#N' clones are disabled."
    )

def make_thematic_bunkers(base_bunkers, theme_name, count=100):
    """
    Deduplicates `base_bunkers` and returns `count` bunkers.
    Raises ValueError if fewer than `count` unique bunkers are provided (no '#N' clones).
    """
    seen = set()
    bunks = []
    for b in base_bunkers:
        text = str(b["text"]).strip()
        if text and text not in seen:
            seen.add(text)
            bunks.append({
                "text": text,
                "capacity": b.get("capacity", 2),
                "description": str(b["description"]).strip()
            })
            if len(bunks) == count:
                return bunks

    raise ValueError(
        f"make_thematic_bunkers({theme_name}): expected at least {count} unique bunkers, got {len(bunks)}. "
        "Lazy '#N' clones are disabled."
    )
