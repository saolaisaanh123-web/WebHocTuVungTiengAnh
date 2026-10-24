"""Apply a pinned, additive source review without rebuilding existing vocabulary.

The canonical TXT is editable. A preview is written to /tmp by default; --write
is required to replace it and its metadata. The input contains facts and original
editorial content, never downloaded publisher article bodies.
"""

import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import runpy
from urllib.parse import urlparse

from corpus_io import read_records, serialize_records


ROOT = Path(__file__).resolve().parents[1]
UPDATE = ROOT / "data/authoring/source-update-2026-10.json"
VOCABULARY = ROOT / "public/data/vocabulary.txt"
DATA = VOCABULARY.parent
IDENTITY = ("id", "word", "part_of_speech")
MEMBERSHIP_GROUPS = {
    "americanMembership": {"american-3000", "american-5000"},
    "opalMembership": {"opal-written", "opal-spoken"},
}
FULL_REVIEW = runpy.run_path(str(ROOT / "scripts/apply-full-review.py"))
ESSENTIAL_SENSES = runpy.run_path(str(ROOT / "scripts/apply-essential-senses.py"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def ids_digest(records):
    """Hash newline-joined stable IDs, deliberately without a trailing newline."""
    return digest("\n".join(row["id"] for row in records).encode("utf-8"))


def _single_line_fields(row, label):
    if not isinstance(row, dict) or not row:
        raise ValueError(f"{label} must be a nonempty object")
    for key, value in row.items():
        if not isinstance(key, str) or not isinstance(value, str) or "\n" in value or "\r" in value:
            raise ValueError(f"{label} requires single-line string TXT fields: {key!r}")
        if not key or ":" in key or key.strip() != key or value.strip() != value:
            raise ValueError(f"{label} contains a noncanonical TXT field: {key!r}")


def load_source_update(path=UPDATE, required=True):
    path = Path(path)
    if not path.exists() and not required:
        return None
    update = json.loads(path.read_text(encoding="utf-8"))
    validate_source_update(update)
    return update


def validate_source_update(update):
    if not isinstance(update, dict) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", update.get("date", "")):
        raise ValueError("Source review needs an ISO date")
    baseline = update.get("baseline", {})
    if not isinstance(baseline.get("entryCount"), int) or baseline["entryCount"] < 1:
        raise ValueError("Source review needs a positive pinned baseline entryCount")
    for field in ("idsSha256", "vocabularySha256"):
        if not re.fullmatch(r"[0-9a-f]{64}", baseline.get(field, "")):
            raise ValueError(f"Source review needs a pinned baseline {field}")
    sources = update.get("sources", [])
    if not isinstance(sources, list) or not sources:
        raise ValueError("Source review needs directly checked source metadata")
    urls = set()
    for source in sources:
        parsed = urlparse(source.get("url", ""))
        if parsed.scheme != "https" or not parsed.netloc or source["url"] in urls:
            raise ValueError("Source URLs must be unique, absolute HTTPS URLs")
        if source.get("status") != 200 or not source.get("title") or not source.get("scope"):
            raise ValueError(f"Source lacks a successful check, title or scope: {source.get('url')}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", source.get("checkedAt", "")) or not re.fullmatch(r"[0-9a-f]{64}", source.get("sha256", "")):
            raise ValueError(f"Source lacks a checked date or content digest: {source.get('url')}")
        urls.add(source["url"])
    for name in ("americanSpellings", "corrections", "additions", *MEMBERSHIP_GROUPS):
        if not isinstance(update.get(name, []), list):
            raise ValueError(f"{name} must be an array")
        seen = set()
        for row in update.get(name, []):
            if not isinstance(row, dict) or any(not isinstance(row.get(key), str) or not row[key] for key in IDENTITY):
                raise ValueError(f"{name} entries require ID, headword and part of speech")
            if row["id"] in seen:
                raise ValueError(f"Duplicate {name} ID: {row['id']}")
            seen.add(row["id"])
            if name in ("corrections", "additions"):
                _single_line_fields(row, f"{name}:{row['id']}")
            if name == "americanSpellings":
                spelling = row.get("preferred_us_spelling")
                if not isinstance(spelling, str) or not spelling.strip() or spelling.strip() != spelling or any(c in spelling for c in "\n\r|"):
                    raise ValueError(f"Invalid American spelling: {row['id']}")
                if row.get("sourceURL") not in urls:
                    raise ValueError(f"American spelling needs an explicitly checked source: {row['id']}")
            if name in MEMBERSHIP_GROUPS:
                collections = row.get("collections")
                if not isinstance(collections, list) or not collections or len(collections) != len(set(collections)) or not set(collections) <= MEMBERSHIP_GROUPS[name]:
                    raise ValueError(f"Invalid collection membership: {name}:{row['id']}")
    for row in update.get("additions", []):
        for field in ("meaning_vi", "definition_en", "collections", "accepted_answers", "source", "content_status", "learning_status", "learning_note"):
            if not row.get(field):
                raise ValueError(f"Addition needs {field}: {row['id']}")
        # OPAL and modern-language articles do not necessarily supply CEFR.
        # Keep that absence explicit instead of inventing a learner level.
        if row.get("level", "") not in ("", "A1", "A2", "B1", "B2", "C1", "C2"):
            raise ValueError(f"Addition has an invalid supplied CEFR level: {row['id']}")
        if any(value.startswith("oxford-") for value in _collections(row)):
            raise ValueError("New sources must not alter the pinned British Oxford collection proof")
        _validate_learning(row)


def _collections(row):
    return [value.strip() for value in row.get("collections", "").split(",") if value.strip()]


def _validate_learning(row):
    ready = row.get("learning_status") == "ready"
    if ready != (row.get("content_status") == "reviewed") or row.get("learning_status") not in ("ready", "lookup"):
        raise ValueError(f"Source review cannot bypass the reviewed learning gate: {row['id']}")
    if ready and not all(row.get(field) for field in ("meaning_vi", "definition_en", "example_en", "example_vi")):
        raise ValueError(f"Learning-ready content needs original bilingual context: {row['id']}")


def _matching_row(by_id, mapping, name, newer=None):
    row = by_id.get(mapping["id"])
    identity = dict(row or {})
    latest = (newer or {}).get(mapping["id"])
    if latest and latest.get("previous_part_of_speech") == mapping["part_of_speech"] and identity.get("part_of_speech") == latest["part_of_speech"]:
        identity["part_of_speech"] = latest["previous_part_of_speech"]
    if row is None or any(identity.get(key) != mapping[key] for key in IDENTITY):
        raise ValueError(f"{name} cannot create, rename or change the POS of an ID: {mapping['id']}")
    return row


def apply_source_update(records, update):
    """Return an additive, deterministic copy, failing on changed IDs or senses.

    Only explicit correction fields may replace current fields. Spelling review
    sets one optional display field; membership only appends collection tags.
    Unmentioned manual fields and the complete original ID order survive.
    """
    validate_source_update(update)
    # The historical source update owns only its pinned prefix and additions.
    # A newer declared tail is validated separately, then replayed last.
    records, _essential_tail = ESSENTIAL_SENSES["separate_essential_senses"](records)
    latest_review = FULL_REVIEW["applicable_full_review"](records)
    newer = {row["id"]: row for row in latest_review["entries"]} if latest_review else {}
    newer_fields = {entry_id: FULL_REVIEW["reviewed_fields"](latest_review, row) for entry_id, row in newer.items()}
    records = deepcopy(records)
    baseline = update["baseline"]
    size = baseline["entryCount"]
    if len(records) < size or ids_digest(records[:size]) != baseline["idsSha256"]:
        raise ValueError("The original stable-ID prefix no longer matches the pinned baseline")
    additions = update.get("additions", [])
    expected_ids = [row["id"] for row in additions]
    current_ids = [row["id"] for row in records]
    if len(set(current_ids)) != len(current_ids) or set(current_ids[:size]) & set(expected_ids):
        raise ValueError("An addition conflicts with an original stable ID")
    if current_ids[size:] != expected_ids[:len(records) - size] or len(records) > size + len(additions):
        raise ValueError("Unexpected additions or changed addition order; update the authored overlay explicitly")
    by_id = {row["id"]: row for row in records}
    # Compute the final declared fields for replay validation, including explicit
    # corrections. Extra hand-written fields on an existing addition survive.
    corrected = {row["id"]: row for row in update.get("corrections", [])}
    for addition in additions:
        existing = by_id.get(addition["id"])
        if existing is not None:
            expected = {**addition, **corrected.get(addition["id"], {})}
            for key, value in expected.items():
                if key == "collections":
                    matches = set(_collections(expected)) <= set(_collections(existing))
                else:
                    matches = existing.get(key) == value
                if not matches and key in newer_fields.get(addition["id"], {}):
                    matches = existing.get(key) == newer_fields[addition["id"]][key]
                if not matches:
                    raise ValueError(f"Conflicting addition fields: {addition['id']}:{key}; update the authored overlay explicitly")
        else:
            row = dict(addition)
            records.append(row)
            by_id[row["id"]] = row
    for correction in update.get("corrections", []):
        row = _matching_row(by_id, correction, "Correction", newer)
        if "source_fact_index" in correction and correction["source_fact_index"] != row.get("source_fact_index"):
            raise ValueError("Supplemental source corrections must preserve the existing pinned Oxford fact")
        if "collections" in correction:
            before = set(_collections(row))
            after = set(_collections(correction))
            if not before <= after or {item for item in before if item.startswith("oxford-")} != {item for item in after if item.startswith("oxford-")}:
                raise ValueError("Corrections must preserve existing collection membership and British source proof")
        row.update(correction)
        _validate_learning(row)
    for spelling in update.get("americanSpellings", []):
        row = _matching_row(by_id, spelling, "American spelling review", newer)
        row["preferred_us_spelling"] = spelling["preferred_us_spelling"]
    for name in MEMBERSHIP_GROUPS:
        for membership in update.get(name, []):
            row = _matching_row(by_id, membership, name, newer)
            extra = ["academic", *membership["collections"]] if name == "opalMembership" else membership["collections"]
            row["collections"] = ",".join(dict.fromkeys([*_collections(row), *extra]))
    if [row["id"] for row in records] != [*current_ids[:size], *expected_ids]:
        raise ValueError("Source update changed the stable vocabulary ID order")
    records = FULL_REVIEW["apply_full_review"](records, latest_review) if latest_review else records
    return ESSENTIAL_SENSES["apply_essential_senses"](records + _essential_tail)


def corpus_coverage(records, previous):
    coverage = deepcopy(previous)
    statuses = Counter(row["content_status"] for row in records)
    for key in ("reviewed", "dictionary", "reference"):
        coverage[key] = statuses.get(key, 0)
    coverage.update({
        "entryCount": len(records),
        "phrasalSenses": sum("phrasal-verbs" in _collections(row) for row in records),
        "slangSenses": sum("slang" in _collections(row) for row in records),
        "withBilingualContext": sum(bool(row.get("example_en")) and bool(row.get("example_vi")) for row in records),
        "missingContext": sum(not row.get("example_en") or not row.get("example_vi") for row in records),
        "learningReady": sum(row["learning_status"] == "ready" for row in records),
        "lookupOnly": sum(row["learning_status"] == "lookup" for row in records),
    })
    return coverage


def update_provenance(records, text, update, metadata, frequency, review, overlay_path=UPDATE):
    """Update current counts/hashes, retaining all pinned historical source facts."""
    metadata, frequency, review = map(deepcopy, (metadata, frequency, review))
    canonical_hash = digest(text.encode("utf-8"))
    overlay_path = Path(overlay_path)
    try:
        overlay_name = str(overlay_path.relative_to(ROOT))
    except ValueError:
        overlay_name = overlay_path.name
    supplemental = {
        "date": update["date"],
        "overlay": overlay_name,
        "canonicalVocabularySha256": canonical_hash,
        "scope": "Additive source-checked American spelling and list membership, targeted original meaning corrections and selected new senses; not a verification of every historical definition or publisher certification.",
    }
    coverage = corpus_coverage(records, metadata["coverage"])
    metadata["coverage"] = coverage
    metadata.setdefault("contentReview", {})["canonicalVocabularySha256"] = canonical_hash
    metadata["contentReview"]["supplementalSourceReview"] = supplemental
    review["canonicalVocabularySha256"] = canonical_hash
    review["coverage"] = coverage
    review["supplementalSourceReview"] = supplemental
    for document in (metadata, frequency, review):
        document["sourceUpdateCanonicalHash"] = canonical_hash
    old_unscored = {item["id"]: item for item in frequency["unscoredEntries"]}
    unscored = []
    for row in records:
        if not row.get("frequency_zipf"):
            unscored.append(old_unscored.get(row["id"], {
                "id": row["id"], "word": row["word"],
                "reason": "new_source_entry_not_measured_in_pinned_frequency_table",
                "note": "No frequency estimate was invented for an additive source-review entry.",
            }))
    frequency["unscoredEntries"] = unscored
    frequency["coverage"].update({
        "records": len(records),
        "scored": sum(bool(row.get("frequency_zipf")) for row in records),
        "unscored": len(unscored),
        "unscoredByReason": dict(Counter(item["reason"] for item in unscored)),
    })
    frequency["currentCanonicalVocabulary"] = {"filename": "vocabulary.txt", "sha256": canonical_hash}
    frequency["supplementalSourceReview"] = supplemental
    provenance = {
        "reviewId": "2026-10-source-priority-american-english",
        "date": update["date"],
        "overlay": overlay_name,
        "overlaySha256": digest(overlay_path.read_bytes()),
        "canonicalVocabularySha256": canonical_hash,
        "baseline": deepcopy(update["baseline"]),
        "counts": {
            "baselineEntries": update["baseline"]["entryCount"],
            "addedEntries": len(update.get("additions", [])),
            "americanSpellings": len(update.get("americanSpellings", [])),
            "meaningCorrections": len(update.get("corrections", [])),
            "americanMembership": len(update.get("americanMembership", [])),
            "opalMembership": len(update.get("opalMembership", [])),
            "sourcePages": len(update["sources"]),
            "canonicalEntries": len(records),
        },
        "coverage": coverage,
        "collectionCounts": dict(Counter(value for row in records for value in _collections(row))),
        "sources": deepcopy(update["sources"]),
        "coverageNotes": deepcopy(update.get("coverageNotes", [])),
        "method": "Existing IDs and their order are preserved. Only explicit corrections replace content. American display spellings and same-POS list membership do not assert validation of every existing meaning. Definitions and examples for additions/corrections are original editorial content, not copied publisher entries.",
    }
    documents = {
        "oxford-provenance.json": metadata,
        "frequency-provenance.json": frequency,
        "content-review-provenance.json": review,
        "source-update-provenance.json": provenance,
    }
    latest_review = FULL_REVIEW["applicable_full_review"](records)
    documents = FULL_REVIEW["update_documents"](records, text, latest_review, documents) if latest_review else documents
    return ESSENTIAL_SENSES["add_provenance"](documents, records, text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=UPDATE)
    parser.add_argument("--output", type=Path, default=Path("/tmp/jeongyeon-source-update.preview.txt"))
    parser.add_argument("--write", action="store_true", help="Explicitly update canonical TXT and current metadata")
    args = parser.parse_args()
    if args.output.resolve() == VOCABULARY.resolve() and not args.write:
        parser.error("Updating canonical vocabulary.txt requires --write")
    original = VOCABULARY.read_bytes()
    update = load_source_update(args.input)
    records = apply_source_update(read_records(VOCABULARY), update)
    text = serialize_records(records)
    documents = update_provenance(records, text, update, *[
        json.loads((DATA / filename).read_text(encoding="utf-8"))
        for filename in ("oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json")
    ], overlay_path=args.input)
    if args.write:
        if VOCABULARY.read_bytes() != original:
            raise RuntimeError("Canonical TXT changed during review; rerun against the latest file")
        VOCABULARY.write_text(text, encoding="utf-8", newline="\n")
        for filename, value in documents.items():
            (DATA / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (DATA / "vocabulary-version.json").write_text(json.dumps({"version": digest(text.encode()), "entryCount": len(records), "bytes": len(text.encode())}, indent=2) + "\n", encoding="utf-8")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8", newline="\n")
        args.output.with_suffix(".json").write_text(json.dumps(documents["source-update-provenance.json"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"mode": "write" if args.write else "preview", "output": str(VOCABULARY if args.write else args.output), "counts": documents["source-update-provenance.json"]["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
