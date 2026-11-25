# -*- coding: utf-8 -*-
import json
import os
import sys

# Ensure server dir is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from card_generators.pirates import get_pack as get_pirates
from card_generators.harry_potter import get_pack as get_hp
from card_generators.fallout import get_pack as get_fallout
from card_generators.stalker import get_pack as get_stalker
from card_generators.ancient import get_pack as get_ancient
from card_generators.lotr import get_pack as get_lotr
from card_generators.jurassic import get_pack as get_jurassic
from card_generators.fantasy import get_pack as get_fantasy
from card_generators.kids import get_pack as get_kids
from card_generators.adult import get_pack as get_adult
from card_generators.anime import (
    get_pack_sao,
    get_pack_rezero,
    get_pack_kny,
    get_pack_mahou,
    get_pack_anime,
)
from card_generators.base_and_extended import (
    get_pack_base,
    get_pack_extended,
)

REQUIRED_CATEGORIES = [
    'professions',
    'baggage',
    'health',
    'hobbies',
    'facts',
    'biology',
    'specials',
    'catastrophes',
    'bunkers'
]

VALID_SPECIAL_ACTIONS = {
    'immunity',
    'reveal',
    'swap',
    'peek',
    'skip_vote',
    'double_vote',
    'revive',
    'poison'
}

def main():
    print("Compiling all packs...")
    packs = {}
    
    packs['base'] = get_pack_base()
    packs['extended'] = get_pack_extended()
    packs['fantasy'] = get_fantasy()
    packs['kids'] = get_kids()
    packs['harry_potter'] = get_hp()
    packs['fallout'] = get_fallout()
    packs['ancient'] = get_ancient()
    packs['adult'] = get_adult()
    packs['lotr'] = get_lotr()
    packs['stalker'] = get_stalker()
    packs['jurassic'] = get_jurassic()
    packs['pirates'] = get_pirates()
    packs['anime_sao'] = get_pack_sao()
    packs['anime_rezero'] = get_pack_rezero()
    packs['anime_kny'] = get_pack_kny()
    packs['anime_mahou'] = get_pack_mahou()
    packs['anime'] = get_pack_anime()

    print(f"Loaded {len(packs)} packs. Running rigorous verification...")

    for pack_id, pack in packs.items():
        for cat in REQUIRED_CATEGORIES:
            items = pack.get(cat, [])
            if len(items) != 100:
                raise ValueError(f"Pack '{pack_id}' category '{cat}' has {len(items)} items, expected exactly 100!")
            
            texts = [it['text'] for it in items]
            unique_texts = set(texts)
            if len(unique_texts) != 100:
                raise ValueError(f"Pack '{pack_id}' category '{cat}' has duplicate texts! Unique: {len(unique_texts)}")
            
            # Check IDs
            for idx, it in enumerate(items, 1):
                if it['id'] != idx:
                    raise ValueError(f"Pack '{pack_id}' category '{cat}' item {idx} has wrong id: {it['id']}")
            
            # Category-specific validation
            if cat == 'specials':
                for it in items:
                    if it['action'] not in VALID_SPECIAL_ACTIONS:
                        raise ValueError(f"Pack '{pack_id}' special '{it['text']}' has invalid action '{it['action']}'")
                    if not it.get('description'):
                        raise ValueError(f"Pack '{pack_id}' special '{it['text']}' is missing description")
            elif cat in ('catastrophes', 'bunkers'):
                for it in items:
                    if not it.get('description'):
                        raise ValueError(f"Pack '{pack_id}' {cat} '{it['text']}' is missing description")

    print("All verification checks PASSED!")

    # Output file
    output_path = os.path.join(BASE_DIR, 'data', 'cards.json')
    data = {
        **packs['base'],
        "packs": packs
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"Successfully compiled {output_path} ({file_size_kb:.1f} KB)")
    print(f"Total cards across all packs: {len(packs)} packs * 9 categories * 100 cards = {len(packs) * 900} cards!")

if __name__ == '__main__':
    main()
