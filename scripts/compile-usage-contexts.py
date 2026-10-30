#!/usr/bin/env python3
"""Compile individually authored + independently reviewed second contexts.

No sentence generation occurs here. A lexical definition receipt is not proof
of an authored grammar rule. Missing reviews remain gaps, never ready content.
The canonical TXT, IDs, learner state and old usage supplements are read-only.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit
from corpus_io import read_records

ROOT = Path(__file__).resolve().parents[1]
AUTHOR_KEYS = ('wordId', 'en', 'vi', 'phrase', 'phraseExplanation', 'note', 'sourceId', 'authorId')
PUBLISHERS = {
    'www.oxfordlearnersdictionaries.com': 'Oxford Learner’s Dictionaries',
    'www.merriam-webster.com': 'Merriam-Webster',
    'dictionaryblog.cambridge.org': 'Cambridge Dictionary Blog',
    'www.collinsdictionary.com': 'Collins Dictionary',
    'www.ahdictionary.com': 'American Heritage Dictionary',
    'raw.githubusercontent.com': 'Open English WordNet — selected sense',
}

def digest(row):
    authored = {key: row[key] for key in AUTHOR_KEYS if key in row}
    return hashlib.sha256(json.dumps(authored, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def forms(word):
    return [word['word'], *re.split(r'[|;]', word.get('accepted_answers', '')),
            *re.split(r'[|;]', word.get('spelling_variants', '')),
            word.get('preferred_us_spelling', '')]


def validate_text(row, word):
    for key in ('wordId', 'en', 'vi', 'phrase', 'phraseExplanation', 'sourceId', 'authorId'):
        assert isinstance(row.get(key), str) and row[key].strip(), (word['id'], key)
    assert row['en'].strip() != word.get('example_en', '').strip(), (word['id'], 'original context repeated')
    assert row['vi'].strip() != word.get('example_vi', '').strip(), (word['id'], 'translation repeated')
    assert row['phrase'].casefold() in row['en'].casefold(), (word['id'], 'phrase not in context')
    assert word.get('example_type') == 'no-cloze' or any(form and re.search(r'(?<!\w)' + re.escape(form.strip()) + r'(?!\w)',
                                 row['en'], re.I) for form in forms(word)), (word['id'], 'no literal answer form')
    assert len(row['en'].split()) >= 4 and len(row['en']) < 650, (word['id'], 'context length')
    assert re.search('[à-ỹÀ-ỸđĐ]', row['vi']), (word['id'], 'Vietnamese translation missing')
    assert not any(k not in AUTHOR_KEYS + ('reviewerId','reviewedAt','contentSha256') for k in row), (word['id'], 'unknown fields')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authors', type=Path, required=True)
    parser.add_argument('--reviews', type=Path, required=True)
    parser.add_argument('--packets', type=Path, required=True)
    parser.add_argument('--require-complete', action='store_true')
    parser.add_argument('--write', action='store_true', help='Default is read-only preview')
    args = parser.parse_args()
    words = {w['id']: w for w in read_records(ROOT/'public/data/vocabulary.txt')}
    legacy_ids = {row['wordId'] for p in (ROOT/'data/usage').glob('group-*.json') for row in json.loads(p.read_text())}
    expected = set(words) - legacy_ids
    registry = json.loads((args.packets/'source-registry.json').read_text())
    packets = {p['id']: p for f in args.packets.glob('range-*/batch-*.jsonl') for p in read_jsonl(f)}
    reviews = {}
    for path in args.reviews.glob('range-*.jsonl'):
        if not re.fullmatch(r'range-\d+\.jsonl', path.name):
            continue
        for row in read_jsonl(path):
            assert row['wordId'] not in reviews, ('duplicate review', row['wordId'])
            reviews[row['wordId']] = row
    receipts, senses, seen, sentences = {}, {}, set(), set()
    batches, gaps, cached, historical = {}, [], 0, 0
    body_hashes = {}
    for path in sorted(args.authors.glob('range-*.jsonl')):
        if not re.fullmatch(r'range-\d+\.jsonl', path.name):
            continue
        batch = []
        for row in read_jsonl(path):
            ident = row['wordId']
            assert ident in expected and ident not in seen, ('unknown/duplicate ID', ident)
            seen.add(ident)
            word = words[ident]
            validate_text(row, word)
            assert row['en'].casefold() not in sentences, ('duplicate sentence', ident)
            sentences.add(row['en'].casefold())
            packet = packets[ident]
            assert packet['headword'] == word['word'] and packet['meaningVi'] == word['meaning_vi'] and packet['partOfSpeech'] == word.get('part_of_speech',''), ('stale packet', ident)
            evidence = registry.get(row['sourceId'])
            assert evidence and evidence['wordId'] == ident, ('wrong source binding', ident)
            review = reviews.get(ident)
            if not review or review.get('verdict') != 'approved':
                gaps.append({'wordId': ident, 'reason': 'independent review missing'})
                continue
            assert review['contentSha256'] == digest(row), ('review does not bind authored content', ident)
            assert review['reviewerId'] != row['authorId'] and review['reviewerId'].strip(), ('self review', ident)
            datetime.fromisoformat(review['reviewedAt'].replace('Z','+00:00'))
            receipt = evidence['receipt']
            host = urlsplit(receipt['url']).hostname
            assert host in PUBLISHERS and receipt['status'] == 200, ('untrusted source', ident)
            assert re.fullmatch('[a-f0-9]{64}', receipt['sha256']), ('invalid hash', ident)
            datetime.fromisoformat(receipt['checkedAt'].replace('Z','+00:00'))
            if host == 'raw.githubusercontent.com':
                assert re.match(r'https://raw.githubusercontent.com/globalwordnet/english-wordnet/[a-f0-9]{40}/src/yaml/', receipt['url']), ('unpinned WordNet', ident)
                assert evidence.get('sourceIdentity'), ('missing sense binding', ident)
            verified_body = False
            available_body = False
            for body_path in evidence.get('cachedBodyPaths', []):
                body = Path(body_path)
                if not body.is_file():
                    continue
                available_body = True
                if body_path not in body_hashes:
                    body_hashes[body_path] = hashlib.sha256(body.read_bytes()).hexdigest()
                if body_hashes[body_path] == receipt['sha256']:
                    verified_body = True
                    break
            assert not available_body or verified_body, ('cached source hash mismatch', ident)
            cached += verified_body
            historical += not verified_body
            receipt_id = 'r-' + hashlib.sha256((receipt['url']+'\n'+receipt['sha256']+'\n'+receipt['checkedAt']).encode()).hexdigest()[:20]
            metadata = {
                'url': receipt['url'], 'title': PUBLISHERS[host], 'status': 200,
                'checkedAt': receipt['checkedAt'], 'sha256': receipt['sha256'],
                'scope': 'lexical-meaning-only',
                'verification': 'cached-body-hash' if verified_body else 'historical-receipt',
            }
            if host == 'raw.githubusercontent.com':
                metadata['license'] = {'name':'CC BY 4.0; Princeton WordNet license where applicable',
                    'url':'https://creativecommons.org/licenses/by/4.0/',
                    'attribution':'Open English WordNet, Global WordNet Association; underlying Princeton WordNet. Reference for the selected meaning, not the author of these bilingual examples.'}
            receipts[receipt_id] = metadata
            senses[row['sourceId']] = {'wordId': ident, 'headword': word['word'],
                'partOfSpeech': word.get('part_of_speech',''), 'meaningVi': word['meaning_vi'],
                'receiptId': receipt_id, 'senseId': evidence.get('sourceIdentity','')}
            batch.append({**row, 'reviewerId':review['reviewerId'], 'reviewedAt':review['reviewedAt'],
                          'contentSha256':review['contentSha256']})
        batches[path.stem+'.json'] = batch
    missing = sorted(expected - {row['wordId'] for rows in batches.values() for row in rows})
    report = {'total':len(words), 'preservedLegacy':len(legacy_ids), 'authored':len(seen),
              'peerReviewedReady':sum(map(len,batches.values())), 'missing':len(missing),
              'sourceReceipts':len(receipts), 'cachedHashVerified':cached,
              'historicalSourceReceipts':historical, 'missingIds':missing,
              'unreviewed':gaps,
              'scope':'All current selected ID/POS/meanings; not every sense or every grammar pattern of each headword.'}
    print(json.dumps({k:v for k,v in report.items() if k not in ('missingIds','unreviewed')}, ensure_ascii=False, indent=2))
    if args.require_complete:
        assert not missing, f'{len(missing)} entries lack independently reviewed content'
    if args.write:
        destination = ROOT/'data/usage-contexts'
        destination.mkdir(exist_ok=True)
        for name, rows in batches.items():
            (destination/name).write_text('[\n' + ',\n'.join('  ' + json.dumps(row, ensure_ascii=False, separators=(',',':')) for row in rows) + '\n]\n')
        groups = []
        for name, mapping in [('receipts', receipts), ('senses', senses)]:
            lines = ',\n'.join('    ' + json.dumps(key) + ':' + json.dumps(value, ensure_ascii=False, separators=(',',':')) for key, value in mapping.items())
            groups.append('  ' + json.dumps(name) + ':{\n' + lines + '\n  }')
        (destination/'evidence.json').write_text('{\n' + ',\n'.join(groups) + '\n}\n')
        (destination/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    main()
