# -*- coding: utf-8 -*-
import random

VALID_SPECIAL_ACTIONS = [
    'immunity',
    'reveal',
    'swap',
    'peek',
    'skip_vote',
    'double_vote',
    'revive',
    'poison'
]

VALID_QUALITIES = ('good', 'neutral', 'bad')

def make_list(raw_items, target=100):
    """
    Takes a list of strings or dicts, ensures uniqueness, and formats as
    [{"id": i+1, "text": item, "quality": "good" | "neutral" | "bad"}].
    If quality is omitted on a dict or item is a string, defaults to "neutral".
    If target is specified, ensures at least target items.
    """
    seen = set()
    cleaned = []
    for it in raw_items:
        if isinstance(it, dict):
            text = str(it["text"]).strip()
            raw_q = it.get("quality")
            quality = (str(raw_q).strip().lower() if raw_q is not None else "neutral") or "neutral"
            if quality not in VALID_QUALITIES:
                raise ValueError(f"Invalid quality '{quality}' for item '{text}'. Must be one of {VALID_QUALITIES}.")
        else:
            text = str(it).strip()
            quality = "neutral"

        if text and text not in seen:
            seen.add(text)
            cleaned.append({"text": text, "quality": quality})
    
    if len(cleaned) < target:
        raise ValueError(f"Expected at least {target} items, but got {len(cleaned)}!")
    
    # Take first target items
    res = []
    for idx, item in enumerate(cleaned[:target], 1):
        res.append({"id": idx, "text": item["text"], "quality": item["quality"]})
    return res

def make_specials(raw_specials, target=100):
    """
    Takes a list of dicts with {"text": ..., "action": ..., "description": ...}.
    Ensures valid action and at least target items.
    """
    seen = set()
    res = []
    for it in raw_specials:
        text = it["text"].strip()
        action = it["action"].strip()
        desc = it["description"].strip()
        if action not in VALID_SPECIAL_ACTIONS:
            raise ValueError(f"Invalid special action: {action}")
        if text not in seen:
            seen.add(text)
            res.append({
                "id": len(res) + 1,
                "text": text,
                "action": action,
                "description": desc
            })
            if len(res) == target:
                break
    
    if len(res) < target:
        raise ValueError(f"Expected {target} specials, got {len(res)}!")
    return res

def make_catastrophes(raw_cats, target=100):
    seen = set()
    res = []
    for it in raw_cats:
        text = it["text"].strip()
        desc = it["description"].strip()
        if text not in seen:
            seen.add(text)
            res.append({
                "id": len(res) + 1,
                "text": text,
                "description": desc
            })
            if len(res) == target:
                break
    if len(res) < target:
        raise ValueError(f"Expected {target} catastrophes, got {len(res)}!")
    return res

def make_bunkers(raw_bunks, target=100):
    seen = set()
    res = []
    for it in raw_bunks:
        text = it["text"].strip()
        desc = it["description"].strip()
        cap = it.get("capacity", 2)
        if text not in seen:
            seen.add(text)
            res.append({
                "id": len(res) + 1,
                "text": text,
                "capacity": cap,
                "description": desc
            })
            if len(res) == target:
                break
    if len(res) < target:
        raise ValueError(f"Expected {target} bunkers, got {len(res)}!")
    return res

def build_pack(profs, bags, health, hobbies, facts, biology, specials, catastrophes, bunkers):
    return {
        "professions": make_list(profs, 100),
        "baggage": make_list(bags, 100),
        "health": make_list(health, 100),
        "hobbies": make_list(hobbies, 100),
        "facts": make_list(facts, 100),
        "biology": make_list(biology, 100),
        "specials": make_specials(specials, 100),
        "catastrophes": make_catastrophes(catastrophes, 100),
        "bunkers": make_bunkers(bunkers, 100)
    }
