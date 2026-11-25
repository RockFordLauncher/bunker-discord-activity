# -*- coding: utf-8 -*-
from card_generators.common import build_pack

def make_100_unique(handcrafted, templates=None, fallback_prefix="Предмет"):
    seen = set()
    result = []
    for item in handcrafted:
        item = item.strip()
        if item and item not in seen:
            seen.add(item)
            result.append(item)
            if len(result) == 100:
                return result
    
    if templates:
        for t in templates:
            t = t.strip()
            if t and t not in seen:
                seen.add(t)
                result.append(t)
                if len(result) == 100:
                    return result

    idx = 1
    while len(result) < 100:
        candidate = f"{fallback_prefix} #{idx}"
        if candidate not in seen:
            seen.add(candidate)
            result.append(candidate)
        idx += 1
        
    return result[:100]

def make_thematic_specials(special_templates, count=100):
    specials = []
    for i in range(count):
        base_name, action, desc = special_templates[i % len(special_templates)]
        rank = (i // len(special_templates)) + 1
        suffix = f" (Ранг {rank})" if rank > 1 else ""
        specials.append({
            "text": f"{base_name}{suffix}",
            "action": action,
            "description": desc
        })
    return specials

def make_thematic_catastrophes(base_cats, theme_name, count=100):
    cats = list(base_cats)
    idx = len(cats) + 1
    while len(cats) < count:
        cats.append({
            "text": f"Катаклизм вселенной {theme_name} #{idx}",
            "description": f"Глобальная катастрофа #{idx} уничтожила привычный мир {theme_name}. Выживание возможно только внутри защищенного сектора."
        })
        idx += 1
    return cats[:count]

def make_thematic_bunkers(base_bunkers, theme_name, count=100):
    bunks = list(base_bunkers)
    idx = len(bunks) + 1
    while len(bunks) < count:
        bunks.append({
            "text": f"Защищенный сектор {theme_name} #{idx}",
            "capacity": 2,
            "description": f"Автономное герметичное убежище #{idx} мира {theme_name} с фильтрацией воздуха, запасом провизии и замкнутым контуром."
        })
        idx += 1
    return bunks[:count]
