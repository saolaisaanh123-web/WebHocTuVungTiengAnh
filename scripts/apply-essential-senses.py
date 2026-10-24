"""Append explicitly reviewed core senses; preview is read-only by default.

This is a separate, additive layer after the historical source/full review.
Pinned authoring documents and the original 5,558 records are not rewritten.
"""

import argparse
from copy import deepcopy
from datetime import date, datetime
import hashlib
import json
from pathlib import Path
import re
import runpy
from urllib.parse import urlparse

from corpus_io import read_records, serialize_records

ROOT = Path(__file__).resolve().parents[1]
UPDATE = ROOT / "data/authoring/essential-senses-2026-10-22.json"
VOCABULARY = ROOT / "public/data/vocabulary.txt"


def digest(value):
    return hashlib.sha256(value).hexdigest()


def ids_digest(records):
    return digest("\n".join(row["id"] for row in records).encode())


def _validate_review(review, facts):
    if not isinstance(review, dict) or not review.get("reviewId") or not review.get("scope"):
        raise ValueError("Essential senses require an explicit review ID and scope")
    try:
        date.fromisoformat(review.get("date", ""))
    except (TypeError, ValueError):
        raise ValueError("Essential senses require an actual ISO review date") from None
    baseline = review.get("baseline", {})
    if type(baseline.get("entryCount")) is not int or baseline["entryCount"] < 1:
        raise ValueError("Essential senses require a stable baseline")
    for key in ("idsSha256", "vocabularySha256"):
        if not re.fullmatch(r"[a-f0-9]{64}", baseline.get(key, "")):
            raise ValueError("Essential senses require a pinned baseline hash")
    seen = set()
    if not isinstance(review.get("entries"), list):
        raise ValueError("Essential sense entries must be an explicit array")
    for entry in review.get("entries", []):
        if not isinstance(entry, dict) or any(not isinstance(entry.get(key), dict) for key in ("word", "source", "americanFact")):
            raise ValueError("Essential sense entries need explicit word, source and American fact objects")
        word, source, fact = entry.get("word", {}), entry.get("source", {}), entry.get("americanFact", {})
        if not isinstance(word.get("id"), str) or not word["id"] or word["id"] in seen or word["id"] in {"__proto__", "constructor", "prototype"}:
            raise ValueError("Essential senses need distinct explicit stable IDs")
        seen.add(word["id"])
        if any(not isinstance(key, str) or not key or ":" in key or key.strip() != key or
               not isinstance(value, str) or "\n" in value or "\r" in value or value.strip() != value
               for key, value in word.items()):
            raise ValueError("Essential sense TXT values must be single-line strings")
        for key in ("word", "part_of_speech", "meaning_vi", "definition_en", "example_en", "example_vi"):
            if not word.get(key, "").strip():
                raise ValueError("Essential senses cannot contain missing teaching content")
        if word.get("learning_status") != "ready" or word.get("content_status") != "reviewed":
            raise ValueError("Essential sense content must be explicitly reviewed")
        if not re.search(r"(?<!\w)" + re.escape(word["word"]) + r"(?!\w)", word["example_en"], re.I):
            raise ValueError("Essential sense context must contain the target answer")
        url = urlparse(source.get("url", ""))
        if (url.scheme != "https" or url.netloc != "www.oxfordlearnersdictionaries.com" or
                not url.path.startswith("/definition/american_english/") or url.username or url.password or
                source.get("status") != 200 or not source.get("title") or not source.get("scope") or
                not re.fullmatch(r"[a-f0-9]{64}", source.get("sha256", ""))):
            raise ValueError("Essential senses need directly read American dictionary evidence")
        try:
            checked = source.get("checkedAt", "")
            if len(checked) == 10:
                date.fromisoformat(checked)
            else:
                timestamp = datetime.fromisoformat(checked.replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    raise ValueError("Evidence timestamp needs a timezone")
        except (TypeError, ValueError):
            raise ValueError("Essential dictionary evidence requires an actual date or zoned receipt timestamp") from None
        if (fact.get("word") != word["word"] or fact.get("cefr") != word.get("level") or
                "v." not in re.split(r"\s*,\s*", fact.get("pos", "")) or word["part_of_speech"] != "verb"):
            raise ValueError("Essential sense/POS/CEFR must match the exact American list fact")
        index = entry.get("americanFactIndex")
        if type(index) is not int or index < 0 or index >= len(facts) or facts[index] != fact:
            raise ValueError("Essential sense must retain the exact pinned American fact, including homograph/sense")
    if not seen:
        raise ValueError("Essential sense additions cannot be implicit or empty")


def load_essential_senses(path=None, required=False):
    """Load one explicit manifest, or the ordered additive manifest series.

    Existing callers see the original baseline and a flat entries array. Batch
    checkpoints and receipts stay separate so a later review cannot rewrite the
    historical review or silently weaken its stable-prefix boundary.
    """
    paths = sorted((ROOT / "data/authoring").glob("essential-senses-*.json")) if path is None else [Path(path)]
    paths = [candidate for candidate in paths if candidate.exists()]
    if not paths:
        if required:
            raise FileNotFoundError(path or UPDATE)
        return None
    facts = json.loads((ROOT / "data/lexicons/american-oxford-2026-10.json").read_text(encoding="utf-8"))["facts"]
    batches, seen_ids, seen_reviews = [], set(), set()
    for candidate in paths:
        batch = json.loads(candidate.read_text(encoding="utf-8"))
        _validate_review(batch, facts)
        if batch["reviewId"] in seen_reviews:
            raise ValueError("Essential sense review IDs must be distinct")
        seen_reviews.add(batch["reviewId"])
        if batches:
            previous = batches[-1]
            if batch["date"] < previous["date"] or batch["baseline"]["entryCount"] != previous["baseline"]["entryCount"] + len(previous["entries"]):
                raise ValueError("Essential sense batches must extend the preceding pinned baseline in order")
        for entry in batch["entries"]:
            if entry["word"]["id"] in seen_ids:
                raise ValueError("Essential sense IDs must be distinct across all batches")
            seen_ids.add(entry["word"]["id"])
        try:
            relative = candidate.resolve().relative_to(ROOT)
        except ValueError:
            relative = candidate.resolve()
        batch["_file"] = {"path": str(relative), "sha256": digest(candidate.read_bytes())}
        batches.append(batch)
    combined = deepcopy(batches[0])
    combined["entries"] = [deepcopy(entry) for batch in batches for entry in batch["entries"]]
    combined["_batches"] = batches
    if len(batches) > 1:
        combined["reviewId"] = batches[-1]["reviewId"]
        combined["date"] = batches[-1]["date"]
        combined["scope"] = "Ordered additive essential-sense reviews; each batch retains its own baseline, source evidence and editorial scope."
    return combined


def _batches(review):
    return review.get("_batches", [review])


def _validate_checkpoints(base, review, tail=None):
    if review["entries"] != [entry for batch in _batches(review) for entry in batch["entries"]]:
        raise ValueError("Essential sense combined entries conflict with their source batches")
    prefix = deepcopy(base)
    existing = iter(tail or [])
    pending = len(tail or []) < len(review["entries"])
    seen = {row["id"] for row in prefix}
    if len(seen) != len(prefix):
        raise ValueError("Essential sense input has duplicate stable IDs")
    for batch in _batches(review):
        baseline = batch["baseline"]
        if len(prefix) != baseline["entryCount"] or ids_digest(prefix) != baseline["idsSha256"]:
            raise ValueError("Essential sense batch does not match its pinned stable-ID baseline")
        if pending and digest(serialize_records(prefix).encode()) != baseline["vocabularySha256"]:
            raise ValueError("Essential sense batch baseline vocabulary has drifted; previous records must remain byte-identical")
        for entry in batch["entries"]:
            if entry["word"]["id"] in seen:
                raise ValueError("Essential sense ID collides with an existing stable ID")
            seen.add(entry["word"]["id"])
            # Existing fields also count toward the next batch's byte guard.
            # Reconstruct only additions that have not been appended yet.
            prefix.append(deepcopy(next(existing, entry["word"])))


def applies_to(records, review):
    return bool(review and len(records) >= review["baseline"]["entryCount"] and
                ids_digest(records[:review["baseline"]["entryCount"]]) == review["baseline"]["idsSha256"])


def separate_essential_senses(records, review=None):
    """Allow older overlays to replay their prefix without silently losing a newer layer."""
    review = review or load_essential_senses()
    if not applies_to(records, review):
        if review and len(records) >= review["baseline"]["entryCount"]:
            raise ValueError("Essential sense stable-ID baseline has drifted")
        return deepcopy(records), []
    size = review["baseline"]["entryCount"]
    declared = [entry["word"] for entry in review["entries"]]
    tail = records[size:]
    if len(tail) > len(declared) or [r["id"] for r in tail] != [r["id"] for r in declared[:len(tail)]]:
        raise ValueError("Undeclared records or reordered essential senses after the stable baseline")
    for actual, expected in zip(tail, declared):
        if any(actual.get(key, "") != value for key, value in expected.items()):
            raise ValueError("An essential sense has conflicting declared fields; update its authoring record first")
        if serialize_records([actual]) != serialize_records([expected]):
            raise ValueError("An authored essential-sense row has changed bytes")
    return deepcopy(records[:size]), deepcopy(tail)


def apply_essential_senses(records, review=None):
    review = review or load_essential_senses()
    if not applies_to(records, review):
        if review and len(records) >= review["baseline"]["entryCount"]:
            raise ValueError("Essential sense stable-ID baseline has drifted")
        return deepcopy(records)
    base, tail = separate_essential_senses(records, review)
    # Older overlays may temporarily replace reviewed fields before replaying
    # the latest review. Check vocabulary bytes only when additions are pending;
    # completed replay still preserves unowned fields in the editable prefix.
    _validate_checkpoints(base, review, tail)
    by_id = {row["id"] for row in base}
    declared = [entry["word"] for entry in review["entries"]]
    if any(row["id"] in by_id for row in declared):
        raise ValueError("Essential sense ID collides with an existing stable ID")
    return base + tail + deepcopy(declared[len(tail):])


def add_provenance(documents, records, text, review=None):
    review = review or load_essential_senses()
    if not applies_to(records, review):
        return documents
    # Validate the declared series before describing it as applied evidence.
    base, tail = separate_essential_senses(records, review)
    _validate_checkpoints(base, review, tail)
    if len(tail) != len(review["entries"]):
        raise ValueError("Essential sense provenance requires every declared addition to be present")
    batches = [{
        "reviewId": batch["reviewId"], "date": batch["date"],
        "baseline": deepcopy(batch["baseline"]), "scope": batch["scope"],
        "addedEntries": len(batch["entries"]),
        **({"manifest": deepcopy(batch["_file"])} if "_file" in batch else {}),
    } for batch in _batches(review)]
    summary = {
        "reviewId": review["reviewId"], "date": review["date"],
        "canonicalVocabularySha256": digest(text.encode()),
        "addedEntries": len(review["entries"]),
        "scope": review["scope"],
        "reviewIds": [batch["reviewId"] for batch in batches],
        "reviews": batches,
    }
    for document in documents.values():
        if isinstance(document, dict):
            document["essentialSenses"] = deepcopy(summary)
    documents["essential-senses-provenance.json"] = {
        "reviewId": review["reviewId"], "date": review["date"],
        "baseline": deepcopy(review["baseline"]),
        "canonicalVocabularySha256": digest(text.encode()),
        "scope": review["scope"], "addedEntries": len(review["entries"]),
        "entries": deepcopy(review["entries"]),
        "reviews": [dict(batch, entries=deepcopy(authored["entries"]))
                    for batch, authored in zip(batches, _batches(review))],
    }
    return documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("/tmp/jeongyeon-essential-senses.preview.txt"))
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if args.output.resolve() == VOCABULARY.resolve() and not args.write:
        parser.error("Replacing canonical TXT requires --write")
    before = VOCABULARY.read_bytes()
    review = load_essential_senses(required=True)
    records = read_records(VOCABULARY)
    pending = len(records) < review["baseline"]["entryCount"] + len(review["entries"])
    if pending and serialize_records(records).encode() != before:
        raise ValueError("Canonical TXT has noncanonical bytes; refusing to normalize the existing prefix while appending")
    if not applies_to(records, review):
        raise ValueError("Essential senses cannot apply to an unrelated or shorter corpus")
    records = apply_essential_senses(records, review)
    text = serialize_records(records) if pending else before.decode("utf-8")
    source_update = runpy.run_path(str(ROOT / "scripts/apply-source-update.py"))
    update = source_update["load_source_update"]()
    names = ("oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json")
    documents = source_update["update_provenance"](records, text, update, *[
        json.loads((ROOT / "public/data" / name).read_text()) for name in names
    ])
    add_provenance(documents, records, text, review)
    destination = VOCABULARY if args.write else args.output
    destination.parent.mkdir(parents=True, exist_ok=True)
    if args.write and VOCABULARY.read_bytes() != before:
        raise RuntimeError("Canonical TXT changed while preparing additions; rerun against latest file")
    destination.write_text(text, encoding="utf-8")
    if args.write:
        for name, document in documents.items():
            (ROOT / "public/data" / name).write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest = {"version": digest(text.encode()), "entryCount": len(records), "bytes": len(text.encode())}
        (ROOT / "public/data/vocabulary-version.json").write_text(json.dumps(manifest, indent=2) + "\n")
    else:
        assert VOCABULARY.read_bytes() == before
    print(f"Essential senses: {len(review['entries'])} declared; {len(records)} canonical records; {'applied' if args.write else 'preview only'}")


if __name__ == "__main__":
    main()
