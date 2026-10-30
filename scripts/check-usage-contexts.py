#!/usr/bin/env python3
"""Audit packaged original contexts, review hashes and existing lexical receipts.

Offline metadata verification; not a fresh publisher visit or an automatic
judgment of natural English. Editorial review remains a separate recorded pass.
"""
import hashlib
import json
import re
import runpy
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit
from corpus_io import read_records

ROOT = Path(__file__).resolve().parents[1]
COMPILER = runpy.run_path(str(ROOT/'scripts/compile-usage-contexts.py'))
words = {w['id']:w for w in read_records(ROOT/'public/data/vocabulary.txt')}
legacy = [r for p in (ROOT/'data/usage').glob('group-*.json') for r in json.loads(p.read_text())]
ledger = {r['id']:r['evidence'] for r in json.loads((ROOT/'public/data/full-review-provenance.json').read_text())['entries']}
for path in (ROOT/'data/authoring').glob('essential-senses-*.json'):
    for row in json.loads(path.read_text())['entries']:
        ledger[row['word']['id']] = [row['source']]

evidence = json.loads((ROOT/'data/usage-contexts/evidence.json').read_text())
rows = [r for p in sorted((ROOT/'data/usage-contexts').glob('range-*.json')) for r in json.loads(p.read_text())]
ids = [r['wordId'] for r in rows]
assert len(ids) == len(set(ids)), 'Duplicate contextual entries'
assert set(ids).isdisjoint({r['wordId'] for r in legacy}), 'Original deep supplements replaced'
assert set(ids) | {r['wordId'] for r in legacy} == set(words), 'Incomplete coverage of current selected senses'
assert len({r['en'].casefold() for r in rows}) == len(rows), 'Duplicate original sentences'
for row in rows:
    ident = row['wordId']
    word = words[ident]
    COMPILER['validate_text'](row, word)
    assert row['contentSha256'] == COMPILER['digest'](row), ('review hash mismatch', ident)
    assert row['reviewerId'].strip() and row['reviewerId'] != row['authorId'], ('self review', ident)
    datetime.fromisoformat(row['reviewedAt'].replace('Z','+00:00'))
    sense = evidence['senses'][row['sourceId']]
    assert (sense['wordId'],sense['headword'],sense['partOfSpeech'],sense['meaningVi']) == (
        ident, word['word'],word.get('part_of_speech',''),word['meaning_vi']), ('stale sense binding', ident)
    receipt = evidence['receipts'][sense['receiptId']]
    url = urlsplit(receipt['url'])
    assert url.scheme == 'https' and not url.username and not url.password
    assert url.hostname in COMPILER['PUBLISHERS'] and receipt['status'] == 200
    assert receipt['scope'] == 'lexical-meaning-only'
    assert receipt['verification'] in ('cached-body-hash','historical-receipt')
    assert re.fullmatch('[a-f0-9]{64}', receipt['sha256'])
    datetime.fromisoformat(receipt['checkedAt'].replace('Z','+00:00'))
    assert any(old['url'] == receipt['url'] and old['sha256'] == receipt['sha256'] and
               old['checkedAt'] == receipt['checkedAt'] and
               (not old.get('sense_ref') or old['sense_ref'] == sense.get('senseId'))
               for old in ledger[ident]), ('receipt not grounded in original per-sense source ledger', ident)
    if url.hostname == 'raw.githubusercontent.com':
        assert re.match(r'https://raw.githubusercontent.com/globalwordnet/english-wordnet/[a-f0-9]{40}/src/yaml/', receipt['url'])
        assert sense.get('senseId') and receipt.get('license',{}).get('attribution')

coverage = json.loads((ROOT/'data/usage-contexts/coverage.json').read_text())
assert coverage['total'] == len(words) and coverage['peerReviewedReady'] == len(rows)
assert coverage['preservedLegacy'] == len(legacy) and coverage['missing'] == 0
assert coverage['missingIds'] == [] and coverage['unreviewed'] == []
print(f'PASS: {len(rows)} reviewed original contexts + {len(legacy)} preserved detailed supplements = {len(words)}/{len(words)} selected senses. Lexical evidence is not publisher certification of original examples.')
