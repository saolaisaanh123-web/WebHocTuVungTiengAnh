"""Corpus regressions from the learning audit; no network or extra packages."""

import hashlib
import json
from copy import deepcopy
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from corpus_io import read_records
from corpus_policy import (
    KNOWN_FREQUENCY_CONFLATIONS,
    REVIEWED_SPELLING_VARIANTS,
    apply_reviewed_spelling_variants,
)


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
SOURCE_UPDATE = runpy.run_path(str(ROOT / "scripts/apply-source-update.py"))
FULL_REVIEW = runpy.run_path(str(ROOT / "scripts/apply-full-review.py"))


class CorpusQualityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = read_records(DATA / "vocabulary.txt")
        cls.by_word = {}
        for row in cls.rows:
            cls.by_word.setdefault(row["word"], row)
        cls.by_id = {row["id"]: row for row in cls.rows}
        cls.metadata = json.loads((DATA / "oxford-provenance.json").read_text())
        cls.facts = {row["sourceFactIndex"]: row for row in cls.metadata["entries"] + cls.metadata["additionalFacts"]}
        cls.source_update = SOURCE_UPDATE["load_source_update"](required=False)
        cls.full_review = FULL_REVIEW["load_full_review"](required=False)
        cls.full_fields = {
            row["id"]: FULL_REVIEW["reviewed_fields"](cls.full_review, row)
            for row in cls.full_review["entries"]
        } if cls.full_review else {}

    def test_coverage_and_original_ids_survive(self):
        additions = self.source_update.get("additions", []) if self.source_update else []
        essential = SOURCE_UPDATE["ESSENTIAL_SENSES"]["load_essential_senses"]()
        senses = [entry["word"] for entry in essential["entries"]]
        self.assertEqual(len(self.rows), 5162 + len(additions) + len(senses))
        self.assertEqual(len(self.by_id), 5162 + len(additions) + len(senses))
        if self.source_update:
            self.assertEqual(self.source_update["baseline"]["entryCount"], 5162)
            self.assertEqual(SOURCE_UPDATE["ids_digest"](self.rows[:5162]), self.source_update["baseline"]["idsSha256"])
            self.assertEqual([row["id"] for row in self.rows[5162:]], [row["id"] for row in additions + senses])
        self.assertEqual(sum("oxford-" in row.get("collections", "") for row in self.rows), 4955)
        self.assertEqual(sum("phrasal-verbs" in row.get("collections", "").split(",") for row in self.rows), 100 + sum("phrasal-verbs" in row["collections"].split(",") for row in additions))
        self.assertEqual(sum("slang" in row.get("collections", "").split(",") for row in self.rows), 107 + sum("slang" in row["collections"].split(",") for row in additions))
        for original in read_records(DATA / "reviewed-vocabulary.txt"):
            self.assertEqual(self.by_id[original["id"]]["word"], original["word"])

    def test_only_reviewed_bilingual_content_enters_learning(self):
        for row in self.rows:
            ready = row["learning_status"] == "ready"
            self.assertEqual(ready, row["content_status"] == "reviewed", row["word"])
            if ready:
                self.assertTrue(any(char.isalpha() for char in row["meaning_vi"]), row["word"])
                self.assertTrue(row.get("example_en") and row.get("example_vi"), row["word"])
            else:
                self.assertEqual(row["learning_status"], "lookup")
                self.assertTrue(row["learning_note"])

    def test_curated_overlay_and_sense_source_are_reproducible(self):
        overlay = read_records(ROOT / "data/authoring/content-review-2026-10.txt")
        self.assertEqual(len(overlay), 38)
        newer_corrections = {row["id"]: row for row in (self.source_update or {}).get("corrections", [])}
        for reviewed in overlay:
            actual = self.by_id[reviewed["id"]]
            for key, value in reviewed.items():
                expected = self.full_fields.get(reviewed["id"], {}).get(key, newer_corrections.get(reviewed["id"], {}).get(key, value))
                self.assertEqual(actual[key], expected, (actual["word"], key))
            fact = self.facts[int(actual["source_fact_index"])]
            self.assertEqual(fact["word"], actual["word"])
            self.assertEqual(fact["cefr"], actual["level"])
            self.assertIn(actual["word"].casefold(), actual["example_en"].casefold())

    def test_lie_homograph_is_not_given_the_other_meanings_cefr(self):
        lie = self.by_word["lie"]
        self.assertEqual(lie["source_fact_index"], "2175")
        self.assertEqual(lie["level"], "B1")
        self.assertEqual(self.facts[2175]["sense"], "tell a lie")
        self.assertEqual(self.facts[433]["cefr"], "A1")
        self.assertEqual(self.facts[433]["homograph"], "lie1")
        self.assertEqual(len(self.facts), 5323)

    def test_known_bad_source_contexts_cannot_reappear(self):
        self.assertIn("nên", self.by_word["should"]["meaning_vi"])
        self.assertIn("sáng hôm qua", self.by_word["yesterday"]["example_vi"])
        self.assertIn("will send", self.by_word["will"]["example_en"])
        self.assertIn("six weekly lessons", self.by_word["consist"]["example_en"])
        self.assertIn("characterize the climate", self.by_word["characterize"]["example_en"])
        self.assertIn("cite the original study", self.by_word["cite"]["example_en"])
        self.assertIn("nhà tù", self.by_word["jail"]["meaning_vi"])

    def test_reviewed_spelling_variants_are_explicit_and_pos_specific(self):
        for entry_id, (headword, part_of_speech, alternatives) in REVIEWED_SPELLING_VARIANTS.items():
            row = self.by_id[entry_id]
            self.assertEqual(row["word"], headword)
            self.assertEqual(row["part_of_speech"], part_of_speech)
            self.assertEqual(row["learning_status"], "ready")
            self.assertEqual(row["accepted_answers"], headword)
            self.assertEqual(row["spelling_variants"].split("|"), list(alternatives))
        # UK/US verb forms are interchangeable here; UK practise is never a noun.
        self.assertIn("practice", self.by_word["practise"]["spelling_variants"].split("|"))
        self.assertEqual(self.by_word["practice"]["accepted_answers"], "practice")
        self.assertFalse(self.by_word["practice"].get("spelling_variants"))
        # Misspellings and different words must not become spelling variants;
        # this whitelist makes no blanket judgment about synonyms in context.
        invalid = {
            "neighbour": ["neigbour", "neighbourhood"],
            "practise": ["practize", "exercise"],
            "characterize": ["characterice", "characterization"],
            "well-being": ["wellness"],
            "healthcare": ["healthy care"],
            "coordination": ["cooperation"],
            "film-maker": ["filmmaking"],
            "fundraising": ["fundraise"],
            "no one": ["noone", "nobody"],
            "non-profit": ["profitable", "charitable"],
        }
        for headword, rejected in invalid.items():
            for answer in rejected:
                row = self.by_word[headword]
                self.assertNotIn(answer, [*row["accepted_answers"].split("|"), *row["spelling_variants"].split("|")])

    def test_spelling_overlay_is_additive_idempotent_and_rejects_changed_senses(self):
        records = [dict(row) for row in self.rows]
        original = [dict(row) for row in records]
        apply_reviewed_spelling_variants(records)
        apply_reviewed_spelling_variants(records)
        self.assertEqual(records, original)
        # Existing canonical/manual alternatives must not disappear on review.
        edited = next(row for row in records if row["id"] == "neighbour-01")
        edited["spelling_variants"] += "|manual spelling"
        apply_reviewed_spelling_variants(records)
        self.assertIn("manual spelling", edited["spelling_variants"])
        changed = next(row for row in records if row["id"] == "practise-01")
        changed["part_of_speech"] = "noun"
        with self.assertRaises(ValueError):
            apply_reviewed_spelling_variants(records)

    def test_known_frequency_conflations_remain_unscored(self):
        for word in KNOWN_FREQUENCY_CONFLATIONS:
            self.assertFalse(self.by_word[word]["frequency_zipf"], word)
            self.assertFalse(self.by_word[word]["frequency_source"], word)
            self.assertTrue(self.by_word[word]["frequency_note"], word)
        frequency = json.loads((DATA / "frequency-provenance.json").read_text())
        self.assertEqual(frequency["coverage"]["scored"], sum(bool(row.get("frequency_zipf")) for row in self.rows))
        self.assertEqual(frequency["coverage"]["unscored"], sum(not row.get("frequency_zipf") for row in self.rows))

    def test_frequency_attachment_cannot_replace_reviewed_content(self):
        # The attachment helper has no need to load the optional pinned package;
        # corpus preservation must still be testable in the ordinary CI image.
        with patch.dict(sys.modules, {"wordfreq": SimpleNamespace()}):
            exporter = runpy.run_path(str(ROOT / "scripts/add-frequency.py"))
        values = {
            row["id"]: {key: row.get(key, "") for key in ("frequency_zipf", "frequency_source", "frequency_note")}
            for row in self.rows
        }
        text = (DATA / "vocabulary.txt").read_text(encoding="utf-8")
        self.assertEqual(exporter["attach_frequency"](text, values), text)

    def test_metadata_counts_and_hashes_match_canonical_corpus(self):
        coverage = self.metadata["coverage"]
        for status in ["reviewed", "dictionary", "reference"]:
            self.assertEqual(coverage[status], sum(row["content_status"] == status for row in self.rows))
        self.assertEqual(coverage["learningReady"], sum(row["learning_status"] == "ready" for row in self.rows))
        digest = hashlib.sha256((DATA / "vocabulary.txt").read_bytes()).hexdigest()
        self.assertEqual(self.metadata["contentReview"]["canonicalVocabularySha256"], digest)
        self.assertEqual(json.loads((DATA / "content-review-provenance.json").read_text())["canonicalVocabularySha256"], digest)
        self.assertEqual(json.loads((DATA / "frequency-provenance.json").read_text())["currentCanonicalVocabulary"]["sha256"], digest)
        if self.source_update:
            for filename in ("oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json"):
                self.assertEqual(json.loads((DATA / filename).read_text())["sourceUpdateCanonicalHash"], digest)

    def test_content_preview_is_idempotent_and_does_not_write_canonical(self):
        original = (DATA / "vocabulary.txt").read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "preview.txt"
            subprocess.run([sys.executable, str(ROOT / "scripts/apply-content-review.py"), "--output", str(output)], check=True, capture_output=True)
            self.assertEqual(output.read_bytes(), original)
        self.assertEqual((DATA / "vocabulary.txt").read_bytes(), original)

    def test_reference_conflict_is_not_guessed(self):
        diplomatic = self.by_word["diplomatic"]
        if diplomatic["id"] in self.full_fields:
            reviewed = next(row for row in self.full_review["entries"] if row["id"] == diplomatic["id"])
            self.assertEqual(reviewed.get("previous_part_of_speech"), "noun")
            self.assertEqual(diplomatic["part_of_speech"], "adjective")
            self.assertEqual(diplomatic["content_status"], "reviewed")
            self.assertTrue(diplomatic["meaning_vi"])
            self.assertEqual(self.facts[int(diplomatic["source_fact_index"])]["pos"], "n.")
            self.assertTrue(any(item.get("status") == 200 for item in FULL_REVIEW["evidence_for"](self.full_review, reviewed)))
        else:
            self.assertEqual(diplomatic["content_status"], "reference")
            self.assertEqual(diplomatic["learning_status"], "lookup")
            self.assertFalse(diplomatic["meaning_vi"])

    def test_source_update_is_exact_additive_and_replayable(self):
        if not self.source_update:
            self.skipTest("No additive source review is authored yet")
        apply = SOURCE_UPDATE["apply_source_update"]
        self.assertEqual(apply(self.rows, self.source_update), self.rows)
        edited = deepcopy(self.rows)
        edited[0]["manual_unmentioned_field"] = "preserve this field"
        self.assertEqual(apply(edited, self.source_update), edited)
        for correction in self.source_update.get("corrections", []):
            for key, value in correction.items():
                self.assertEqual(self.by_id[correction["id"]][key], self.full_fields.get(correction["id"], {}).get(key, value))
        for spelling in self.source_update.get("americanSpellings", []):
            self.assertEqual(self.by_id[spelling["id"]]["preferred_us_spelling"], spelling["preferred_us_spelling"])
        for group in ("americanMembership", "opalMembership"):
            for membership in self.source_update.get(group, []):
                row = self.by_id[membership["id"]]
                self.assertEqual(row["word"], membership["word"])
                if membership["id"] == "ox-76658a7ce8e611-01" and membership["id"] in self.full_fields:
                    reviewed = next(item for item in self.full_review["entries"] if item["id"] == membership["id"])
                    self.assertEqual((membership["word"], membership["part_of_speech"]), ("diplomatic", "noun"))
                    self.assertEqual((reviewed.get("previous_part_of_speech"), reviewed["part_of_speech"]), ("noun", "adjective"))
                    self.assertEqual(row["part_of_speech"], "adjective")
                else:
                    self.assertEqual(row["part_of_speech"], membership["part_of_speech"])
                self.assertTrue(set(membership["collections"]) <= set(row["collections"].split(",")))

    def test_source_update_provenance_matches_authored_input(self):
        if not self.source_update:
            self.skipTest("No additive source review is authored yet")
        provenance = json.loads((DATA / "source-update-provenance.json").read_text())
        self.assertEqual(provenance["baseline"], self.source_update["baseline"])
        self.assertEqual(provenance["canonicalVocabularySha256"], hashlib.sha256((DATA / "vocabulary.txt").read_bytes()).hexdigest())
        self.assertEqual(provenance["overlaySha256"], hashlib.sha256(SOURCE_UPDATE["UPDATE"].read_bytes()).hexdigest())
        self.assertEqual(provenance["sources"], self.source_update["sources"])
        for field, collection in [("addedEntries", "additions"), ("americanSpellings", "americanSpellings"), ("meaningCorrections", "corrections"), ("americanMembership", "americanMembership"), ("opalMembership", "opalMembership")]:
            self.assertEqual(provenance["counts"][field], len(self.source_update.get(collection, [])))
        self.assertEqual(provenance["counts"]["canonicalEntries"], len(self.rows))
        frequency = json.loads((DATA / "frequency-provenance.json").read_text())
        unscored = {row["id"]: row for row in frequency["unscoredEntries"]}
        for addition in self.source_update.get("additions", []):
            if not addition.get("frequency_zipf"):
                self.assertEqual(unscored[addition["id"]]["reason"], "new_source_entry_not_measured_in_pinned_frequency_table")

    def test_source_preview_is_idempotent_and_read_only(self):
        if not self.source_update:
            self.skipTest("No additive source review is authored yet")
        original = (DATA / "vocabulary.txt").read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "preview.txt"
            subprocess.run([sys.executable, str(ROOT / "scripts/apply-source-update.py"), "--output", str(output)], check=True, capture_output=True)
            self.assertEqual(output.read_bytes(), original)
        self.assertEqual((DATA / "vocabulary.txt").read_bytes(), original)


class SourceOverlaySafetyTests(unittest.TestCase):
    def setUp(self):
        self.records = [{
            "id": "stable-01", "word": "colour", "part_of_speech": "noun",
            "meaning_vi": "màu sắc", "definition_en": "a visual quality", "level": "A1",
            "collections": "foundation,oxford-3000", "accepted_answers": "colour",
            "source": "historical pinned source", "content_status": "dictionary",
            "learning_status": "lookup", "learning_note": "Not reviewed for practice.",
            "source_fact_index": "1", "manual": "keep me",
        }]
        self.update = {
            "date": "2026-10-20",
            "baseline": {"entryCount": 1, "idsSha256": SOURCE_UPDATE["ids_digest"](self.records), "vocabularySha256": "a" * 64},
            "sources": [{"url": "https://example.com/source", "title": "Pinned source", "status": 200, "checkedAt": "2026-10-20", "sha256": "b" * 64, "scope": "Spelling and membership only"}],
            "americanSpellings": [{"id": "stable-01", "word": "colour", "part_of_speech": "noun", "preferred_us_spelling": "color", "sourceURL": "https://example.com/source"}],
            "americanMembership": [{"id": "stable-01", "word": "colour", "part_of_speech": "noun", "collections": ["american-3000"]}],
            "opalMembership": [{"id": "stable-01", "word": "colour", "part_of_speech": "noun", "collections": ["opal-written"]}],
            "corrections": [], "additions": [],
        }

    def test_membership_and_display_spelling_cannot_change_content_or_readiness(self):
        actual = SOURCE_UPDATE["apply_source_update"](self.records, self.update)
        self.assertEqual(self.records[0]["collections"], "foundation,oxford-3000")
        for key, value in self.records[0].items():
            if key != "collections":
                self.assertEqual(actual[0][key], value, key)
        self.assertEqual(actual[0]["preferred_us_spelling"], "color")
        self.assertEqual(actual[0]["collections"], "foundation,oxford-3000,american-3000,academic,opal-written")
        self.assertEqual(SOURCE_UPDATE["apply_source_update"](actual, self.update), actual)

    def test_changed_identity_pos_and_duplicate_or_foreign_membership_fail_closed(self):
        for field, value in [("id", "renamed-01"), ("word", "different"), ("part_of_speech", "verb")]:
            changed = deepcopy(self.records)
            changed[0][field] = value
            with self.assertRaises(ValueError, msg=field):
                SOURCE_UPDATE["apply_source_update"](changed, self.update)
        for field in ("americanSpellings", "americanMembership", "opalMembership"):
            duplicate = deepcopy(self.update)
            duplicate[field] *= 2
            with self.assertRaises(ValueError, msg=field):
                SOURCE_UPDATE["apply_source_update"](self.records, duplicate)
        incorrect = deepcopy(self.update)
        incorrect["americanMembership"][0]["collections"] = ["oxford-3000"]
        with self.assertRaises(ValueError):
            SOURCE_UPDATE["apply_source_update"](self.records, incorrect)

    def test_additions_reject_collisions_and_conflicting_fields_without_deleting_manual_data(self):
        addition = {**self.records[0], "id": "new-01", "word": "colorful", "part_of_speech": "adjective", "collections": "american-3000"}
        update = deepcopy(self.update)
        update["additions"] = [addition]
        result = SOURCE_UPDATE["apply_source_update"](self.records, update)
        self.assertEqual([row["id"] for row in result], ["stable-01", "new-01"])
        result[-1]["extra_manual_field"] = "preserved"
        self.assertEqual(SOURCE_UPDATE["apply_source_update"](result, update), result)
        conflicting = deepcopy(result)
        conflicting[-1]["meaning_vi"] = "conflicting meaning"
        with self.assertRaises(ValueError):
            SOURCE_UPDATE["apply_source_update"](conflicting, update)
        update["additions"][0]["id"] = "stable-01"
        with self.assertRaises(ValueError):
            SOURCE_UPDATE["apply_source_update"](self.records, update)

    def test_corrections_preserve_unmentioned_fields_and_pinned_source_identity(self):
        update = deepcopy(self.update)
        update["corrections"] = [{"id": "stable-01", "word": "colour", "part_of_speech": "noun", "meaning_vi": "màu sắc của vật"}]
        result = SOURCE_UPDATE["apply_source_update"](self.records, update)
        self.assertEqual(result[0]["meaning_vi"], "màu sắc của vật")
        self.assertEqual(result[0]["manual"], "keep me")
        self.assertEqual(result[0]["source_fact_index"], "1")
        update["corrections"][0]["source_fact_index"] = "2"
        with self.assertRaises(ValueError):
            SOURCE_UPDATE["apply_source_update"](self.records, update)

    def test_unknown_cefr_is_preserved_without_weakening_reviewed_context_checks(self):
        update = deepcopy(self.update)
        addition = {
            **self.records[0], "id": "academic-01", "word": "finding", "level": "",
            "collections": "academic,opal-written", "content_status": "reviewed",
            "learning_status": "ready", "example_en": "We compared the findings.",
            "example_vi": "Chúng tôi so sánh các kết quả nghiên cứu.",
        }
        update["additions"] = [addition]
        self.assertEqual(SOURCE_UPDATE["apply_source_update"](self.records, update)[-1]["level"], "")
        update["additions"][0]["example_vi"] = ""
        with self.assertRaises(ValueError):
            SOURCE_UPDATE["apply_source_update"](self.records, update)


class UsageSourceIdentityTests(unittest.TestCase):
    def test_british_secondary_source_keeps_strict_header_and_dictionary_identity(self):
        api = runpy.run_path(str(ROOT / "scripts/check-usage-sources.py"))
        article = api["ArticleInfo"]()
        article.feed('<title>buy verb - Definition, pictures, pronunciation and usage notes | Oxford Advanced Learner&apos;s Dictionary at OxfordLearnersDictionaries.com</title><div id="entryContent" class="oald"><h1 class="headword">buy</h1><span class="pos">verb</span><span class="def">A real definition body.</span></div>')
        self.assertEqual(article.text("headword"), "buy")
        self.assertEqual(api["title_identity"](article.text("title")), {"headword": "buy", "pos": "verb"})
        receipt = {
            "url": "https://www.oxfordlearnersdictionaries.com/definition/english/buy_1",
            "title": article.text("title"), "checkedAt": "2026-10-25", "sha256": "a" * 64,
        }
        self.assertEqual(api["validate_receipt"](receipt), receipt["url"])
        with self.assertRaises(ValueError):
            api["validate_receipt"]({**receipt, "url": receipt["url"].replace("/english/", "/american_english/")})
        for suffix in ("?token=private", "?utm_source=test"):
            with self.assertRaises(ValueError):
                api["valid_url"](receipt["url"] + suffix)


if __name__ == "__main__":
    unittest.main()
