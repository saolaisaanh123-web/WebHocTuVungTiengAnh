"""Safety, provenance and deterministic replay checks for the complete review."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from corpus_io import read_records, serialize_records

ROOT = Path(__file__).resolve().parents[1]
FULL = runpy.run_path(str(ROOT / "scripts/apply-full-review.py"))
OLD = runpy.run_path(str(ROOT / "scripts/apply-source-update.py"))


class FullReviewTests(unittest.TestCase):
    def setUp(self):
        self.records = [{"id": "stable-01", "word": "bee", "part_of_speech": "noun", "meaning_vi": "nghĩa nguồn cũ sai", "definition_en": "", "example_en": "", "example_vi": "", "collections": "foundation,oxford-3000", "level": "B1", "source_fact_index": "1", "accepted_answers": "bee", "content_status": "dictionary", "learning_status": "lookup", "source": "Historical source", "note": "unreviewed", "learning_note": "unreviewed", "personal_extra": "preserve"}]
        self.row = {"id": "stable-01", "word": "bee", "part_of_speech": "noun", "meaning_vi": "con ong", "definition_en": "An insect that visits flowers.", "definition_source": "authored", "example_en": "A bee landed on the yellow flower.", "example_vi": "Một con ong đậu lên bông hoa màu vàng.", "source_evidence": [{"url": "https://www.oxfordlearnersdictionaries.com/definition/american_english/bee", "status": 200, "checkedAt": "2026-10-21", "sha256": "a" * 64, "scope": "selected insect sense and noun POS"}]}
        self.review = {"reviewId": "review-2026-10", "date": "2026-10-21", "baseline": {"entryCount": 1, "idsSha256": FULL["ids_digest"](self.records), "vocabularySha256": FULL["digest"](serialize_records(self.records).encode())}, "entries": [self.row]}

    def apply(self, records=None, review=None):
        return FULL["apply_full_review"](records or self.records, review or self.review)

    def test_explicit_original_content_preserves_ids_order_and_undeclared_data(self):
        original = deepcopy(self.records)
        result = self.apply()
        self.assertEqual(self.records, original)
        self.assertEqual([r["id"] for r in result], [r["id"] for r in original])
        for key in ("collections", "level", "source_fact_index", "accepted_answers", "personal_extra"):
            self.assertEqual(result[0][key], original[0][key])
        self.assertEqual(result[0]["meaning_vi"], "con ong")
        self.assertEqual(result[0]["content_status"], "reviewed")
        self.assertEqual(result[0]["learning_status"], "ready")
        self.assertEqual(result[0]["example_type"], "authored")
        self.assertNotIn("unreviewed", result[0]["note"])
        self.assertEqual(self.apply(result), result)

    def test_scope_is_explicit_and_does_not_change_unreviewed_or_new_personal_fields(self):
        records = deepcopy(self.records) + [{**self.records[0], "id": "second", "word": "other"}]
        result = self.apply(records)
        self.assertEqual(result[1], records[1])
        records[0]["custom_personal"] = "preserve even after a repeated review"
        self.assertEqual(self.apply(records)[0]["custom_personal"], records[0]["custom_personal"])

    def test_missing_or_bad_evidence_fails_closed(self):
        for changes in ({"status": 403}, {"sha256": "bad"}, {"url": "http://www.oxfordlearnersdictionaries.com/bee"}, {"url": "https://example.com/bee"}, {"url": "https://raw.githubusercontent.com/untrusted/repo/bee"}, {"scope": ""}):
            review = deepcopy(self.review)
            review["entries"][0]["source_evidence"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.apply(review=review)
        for evidence in ([], None, "no", {}):
            review = deepcopy(self.review)
            review["entries"][0]["source_evidence"] = evidence
            with self.subTest(evidence=evidence), self.assertRaises(ValueError):
                self.apply(review=review)

    def test_real_vietnamese_verbs_are_not_mistaken_for_dictionary_redirects(self):
        for meaning in ("xem xét và tìm cách xử lý một vấn đề", "xem như; coi là", "xem là một trường hợp đặc biệt", "xem lại; kiểm tra lại", "xem qua", "xem phim"):
            self.assertFalse(FULL["reference_only_meaning"](meaning), meaning)
        for meaning in ("xem bee", "Xem globalisation", "xem sudden", "xem mục bee", "xem thêm bee", "see bee", "→ bee"):
            self.assertTrue(FULL["reference_only_meaning"](meaning), meaning)

    def test_unrelated_ids_pos_changes_duplicates_and_status_bypass_fail_closed(self):
        for key, value in (("id", "renamed"), ("word", "wasp"), ("part_of_speech", "verb"), ("meaning_vi", "xem bee"), ("example_en", "An insect landed on a flower."), ("learning_status", "ready")):
            review = deepcopy(self.review)
            review["entries"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.apply(review=review)
        review = deepcopy(self.review)
        review["entries"] *= 2
        with self.assertRaises(ValueError):
            self.apply(review=review)
        changed = deepcopy(self.records)
        changed[0]["id"] = "tampered"
        with self.assertRaises(ValueError):
            self.apply(changed)

    def test_diplomatic_is_the_only_explicit_supported_pos_correction(self):
        records = [{**self.records[0], "id": "ox-76658a7ce8e611-01", "word": "diplomatic", "accepted_answers": "diplomatic", "part_of_speech": "noun"}]
        review = deepcopy(self.review)
        review["baseline"]["idsSha256"] = FULL["ids_digest"](records)
        review["entries"] = [{**self.row, "id": records[0]["id"], "word": "diplomatic", "part_of_speech": "adjective", "previous_part_of_speech": "noun", "example_en": "They used a diplomatic approach."}]
        review["entries"][0]["source_evidence"][0]["url"] = "https://www.oxfordlearnersdictionaries.com/definition/american_english/diplomatic"
        self.assertEqual(self.apply(records, review)[0]["part_of_speech"], "adjective")
        self.assertEqual(self.apply(self.apply(records, review), review)[0]["part_of_speech"], "adjective")
        del review["entries"][0]["previous_part_of_speech"]
        with self.assertRaises(ValueError):
            self.apply(records, review)

    def test_source_references_and_licensed_gloss_attribution_remain_distinct(self):
        review = deepcopy(self.review)
        evidence = review["entries"][0]["source_evidence"][0]
        evidence["url"] = "https://raw.githubusercontent.com/globalwordnet/english-wordnet/45fdb60396dc804526b85f21a23c59983c2c396a/src/yaml/noun.animal.yaml"
        evidence["sense_ref"] = "selected-synset"
        review["sources"] = {"oewn": evidence}
        review["entries"][0]["source_evidence"] = {"source_id": "oewn"}
        review["entries"][0]["definition_source"] = "oewn"
        result = self.apply(review=review)[0]
        self.assertIn("CC BY 4.0", result["source"])
        self.assertIn("Princeton", result["source"])
        self.assertIn("Nghĩa Việt và ví dụ", result["source"])
        self.assertEqual(result["definition_source"], "oewn")

    def test_sharded_loader_count_uniqueness_and_path_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {**self.review, "entries": [], "shards": ["part.json"], "expectedEntryCount": 1}
            (root / "part.json").write_text(json.dumps({"entries": [self.row]}))
            target = root / "review.json"
            target.write_text(json.dumps(manifest))
            loaded = FULL["load_full_review"](target)
            self.assertEqual(loaded["entries"], self.review["entries"])
            self.assertEqual(len(loaded["_files"]), 2)
            manifest["shards"] = ["../escape.json"]
            target.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                FULL["load_full_review"](target)

    def test_current_metadata_hashes_and_counts_update_without_mutating_pinned_facts(self):
        result = self.apply()
        text = serialize_records(result)
        documents = {"oxford-provenance.json": {"coverage": {"referenceWords": [{"word": "old"}]}, "entries": [{"sourceFactIndex": 1}], "contentReview": {"canonicalVocabularySha256": "old"}, "sourceUpdateCanonicalHash": "old"}, "content-review-provenance.json": {"coverage": {}, "canonicalVocabularySha256": "old"}, "frequency-provenance.json": {"coverage": {"scored": 1}, "currentCanonicalVocabulary": {"sha256": "old"}}, "source-update-provenance.json": {"coverage": {}, "canonicalVocabularySha256": "old"}}
        documents["oxford-provenance.json"]["contentReview"]["supplementalSourceReview"] = {"canonicalVocabularySha256": "old"}
        original = deepcopy(documents)
        updated = FULL["update_documents"](result, text, self.review, documents)
        self.assertEqual(documents, original)
        checksum = hashlib.sha256(text.encode()).hexdigest()
        self.assertEqual(updated["oxford-provenance.json"]["entries"], original["oxford-provenance.json"]["entries"])
        self.assertEqual(updated["oxford-provenance.json"]["coverage"]["learningReady"], 1)
        self.assertEqual(updated["oxford-provenance.json"]["contentReview"]["supplementalSourceReview"]["canonicalVocabularySha256"], checksum)
        self.assertEqual(updated["frequency-provenance.json"]["coverage"], {"scored": 1})
        self.assertEqual(updated["frequency-provenance.json"]["currentCanonicalVocabulary"]["sha256"], checksum)
        self.assertEqual(updated["content-review-provenance.json"]["canonicalVocabularySha256"], checksum)
        self.assertEqual(updated["full-review-provenance.json"]["canonicalVocabularySha256"], checksum)
        self.assertEqual(updated["full-review-provenance.json"]["sources"][0]["status"], 200)

    def test_older_addition_replay_accepts_only_exact_newer_declared_review(self):
        # Use a miniature older source update whose addition is now reviewed.
        base = [{**self.records[0], "id": "original-01", "word": "old"}]
        old_addition = deepcopy(self.records[0])
        old_addition["collections"] = "foundation"
        old_addition["definition_en"] = "Old incomplete source"
        old_addition["example_en"] = "Old source bee"
        old_addition["example_vi"] = "Câu nguồn cũ"
        old_addition["learning_note"] = "Historical lookup"
        old = {"date": "2026-10-20", "baseline": {"entryCount": 1, "idsSha256": OLD["ids_digest"](base), "vocabularySha256": "a" * 64}, "sources": [{"url": "https://www.oxfordlearnersdictionaries.com/definition/american_english/bee", "status": 200, "title": "Oxford", "checkedAt": "2026-10-20", "sha256": "b" * 64, "scope": "sense"}], "additions": [old_addition]}
        records = base + [old_addition]
        review = deepcopy(self.review)
        review["baseline"]["entryCount"] = 2
        review["baseline"]["idsSha256"] = FULL["ids_digest"](records)
        latest = self.apply(records, review)
        with patch.dict(OLD["FULL_REVIEW"], {"applicable_full_review": lambda rows: review}):
            self.assertEqual(OLD["apply_source_update"](latest, old), latest)
            bad = deepcopy(latest)
            bad[-1]["meaning_vi"] = "unexpected edit"
            with self.assertRaises(ValueError):
                OLD["apply_source_update"](bad, old)


class EssentialSenseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = OLD["ESSENTIAL_SENSES"]
        cls.review = cls.api["load_essential_senses"](required=True)
        cls.records = read_records(ROOT / "public/data/vocabulary.txt")
        cls.size = cls.review["baseline"]["entryCount"]
        cls.batches = cls.review["_batches"]

    def test_only_declared_senses_are_appended_without_changing_any_previous_byte(self):
        self.assertEqual(hashlib.sha256((ROOT / "data/authoring/essential-senses-2026-10-22.json").read_bytes()).hexdigest(), "85b802bb0f2c197358d98a0d8f5f82f99b53be332a871301900545f4af6e51d2")
        prefix = serialize_records(self.records[:self.size]).encode()
        self.assertEqual(hashlib.sha256(prefix).hexdigest(), self.review["baseline"]["vocabularySha256"])
        self.assertEqual(self.api["ids_digest"](self.records[:self.size]), self.review["baseline"]["idsSha256"])
        self.assertEqual(self.records[self.size:], [entry["word"] for entry in self.review["entries"]])
        self.assertEqual([row["id"] for row in self.records[self.size:self.size + 2]], ["like-verb-enjoy-01", "lie-horizontal-01"])
        # Check the actual TXT bytes at every batch boundary, including the
        # complete 5,560-record corpus that predates the 2026-10-24 additions.
        blocks = (ROOT / "public/data/vocabulary.txt").read_bytes().split(b"\n---\n")
        for batch in self.batches:
            size = batch["baseline"]["entryCount"]
            raw_prefix = b"\n---\n".join(blocks[:size]).rstrip(b"\n") + b"\n"
            self.assertEqual(hashlib.sha256(raw_prefix).hexdigest(), batch["baseline"]["vocabularySha256"])
            self.assertEqual(self.api["ids_digest"](self.records[:size]), batch["baseline"]["idsSha256"])
        if len(self.batches) > 1:
            self.assertEqual(self.batches[1]["baseline"]["entryCount"], 5560)
            self.assertEqual(self.batches[1]["baseline"]["vocabularySha256"], "10392288d69ba11cc6e5fc74e02e0cc3654bea50cda229254236848d2d3a87f4")

    def test_applying_additions_twice_preserves_input_and_same_spelling_existing_senses(self):
        prefix = deepcopy(self.records[:self.size])
        before = deepcopy(prefix)
        once = self.api["apply_essential_senses"](prefix, self.review)
        self.assertEqual(prefix, before)
        self.assertEqual(self.api["apply_essential_senses"](once, self.review), once)
        old_like = next(row for row in prefix if row["word"] == "like")
        old_lie = next(row for row in prefix if row["word"] == "lie")
        self.assertEqual(old_like["part_of_speech"], "preposition")
        self.assertEqual(old_lie["meaning_vi"], "nói dối; cố ý nói điều không đúng sự thật")
        for old in (old_like, old_lie):
            self.assertEqual(next(row for row in once if row["id"] == old["id"]), old)

    def test_later_batches_append_distinct_verbs_and_preserve_existing_nouns_and_adjectives(self):
        for batch in self.batches[1:]:
            size = batch["baseline"]["entryCount"]
            prefix = self.records[:size]
            old_ids = {row["id"] for row in prefix}
            declared = [entry["word"] for entry in batch["entries"]]
            new_words = {row["word"] for row in declared}
            self.assertTrue(old_ids.isdisjoint(row["id"] for row in declared))
            previous_senses = [row for row in prefix if row["word"] in new_words and row["part_of_speech"] in ("noun", "adjective")]
            self.assertTrue(previous_senses)
            self.assertTrue(all(row["part_of_speech"] == "verb" for row in declared))
            result = self.api["apply_essential_senses"](prefix, self.review)
            self.assertEqual(serialize_records(result[:size]), serialize_records(prefix))
            by_id = {row["id"]: row for row in result}
            for row in previous_senses:
                self.assertEqual(by_id[row["id"]], row)

    def test_pending_additions_require_every_pinned_prefix_checkpoint(self):
        for field, value in (("id", "renamed-existing-id"), ("part_of_speech", "verb"), ("meaning_vi", "undeclared prior-content edit")):
            changed = deepcopy(self.records[:self.batches[-1]["baseline"]["entryCount"]])
            target = next(row for row in changed[:self.size] if row["part_of_speech"] in ("noun", "adjective")) if field == "part_of_speech" else changed[0]
            target[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.api["apply_essential_senses"](changed, self.review)
        for field in ("idsSha256", "vocabularySha256"):
            changed = deepcopy(self.review)
            changed["_batches"][-1]["baseline"][field] = "0" * 64
            with self.subTest(checkpoint=field), self.assertRaises(ValueError):
                self.api["apply_essential_senses"](self.records[:self.size], changed)
        if len(self.batches) > 1:
            changed = deepcopy(self.records)
            changed[self.size]["undeclared_extra_field"] = "must affect the 5560-record checkpoint"
            with self.assertRaises(ValueError):
                self.api["apply_essential_senses"](changed, self.review)
            with self.assertRaises(ValueError):
                self.api["separate_essential_senses"](changed, self.review)

    def test_completed_replay_preserves_unowned_prefix_fields_but_keeps_ids_and_authored_tail_locked(self):
        changed = deepcopy(self.records)
        changed[0]["manual_unmentioned_field"] = "preserve this field"
        result = self.api["apply_essential_senses"](changed, self.review)
        self.assertEqual(result, changed)
        self.assertEqual(self.api["apply_essential_senses"](result, self.review), changed)
        self.assertEqual(OLD["apply_source_update"](changed, OLD["load_source_update"]()), changed)
        for position, field, value in ((0, "id", "renamed-existing-id"), (-1, "manual_extra_field", "undeclared essential edit")):
            bad = deepcopy(changed)
            bad[position][field] = value
            with self.subTest(position=position), self.assertRaises(ValueError):
                self.api["apply_essential_senses"](bad, self.review)
        pending = deepcopy(changed[:self.batches[-1]["baseline"]["entryCount"]])
        with self.assertRaises(ValueError):
            self.api["apply_essential_senses"](pending, self.review)

    def test_cli_preserves_complete_custom_bytes_and_the_existing_prefix_when_appending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            scripts.mkdir()
            for name in ("apply-essential-senses.py", "apply-source-update.py", "apply-full-review.py", "corpus_io.py"):
                shutil.copy2(ROOT / "scripts" / name, scripts / name)
            (root / "data").symlink_to(ROOT / "data", target_is_directory=True)
            data = root / "public/data"
            data.mkdir(parents=True)
            for name in ("oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json"):
                shutil.copy2(ROOT / "public/data" / name, data / name)
            changed = deepcopy(self.records)
            changed[0]["manual_unmentioned_field"] = "keep my custom note exactly"
            # A completed replay must preserve original bytes too, including an
            # existing line ending that the field parser normalizes in memory.
            original = serialize_records(changed).encode().replace(b"\n", b"\r\n", 1)
            vocabulary = data / "vocabulary.txt"
            vocabulary.write_bytes(original)
            output = root / "preview.txt"
            command = [sys.executable, str(scripts / "apply-essential-senses.py")]
            subprocess.run(command + ["--output", str(output)], cwd=root, check=True, capture_output=True)
            self.assertEqual(output.read_bytes(), original)
            self.assertEqual(vocabulary.read_bytes(), original)
            subprocess.run(command + ["--write"], cwd=root, check=True, capture_output=True)
            self.assertEqual(vocabulary.read_bytes(), original)
            self.assertEqual(json.loads((data / "vocabulary-version.json").read_text())["version"], hashlib.sha256(original).hexdigest())
            prefix_size = self.batches[-1]["baseline"]["entryCount"]
            prefix = serialize_records(self.records[:prefix_size]).encode()
            vocabulary.write_bytes(prefix)
            subprocess.run(command + ["--write"], cwd=root, check=True, capture_output=True)
            appended = vocabulary.read_bytes()
            self.assertEqual(appended, serialize_records(self.records).encode())
            self.assertEqual(appended[:len(prefix)], prefix)

    def test_a_new_verb_cannot_reuse_an_existing_noun_or_adjective_id(self):
        old = next(row for row in self.records[:self.size] if row["part_of_speech"] in ("noun", "adjective"))
        changed = deepcopy(self.review)
        changed["entries"][-1]["word"]["id"] = old["id"]
        changed["_batches"][-1]["entries"][-1]["word"]["id"] = old["id"]
        with self.assertRaises(ValueError):
            self.api["apply_essential_senses"](self.records[:self.size], changed)

    def test_growth_from_the_previous_manifest_is_idempotent(self):
        old = self.api["load_essential_senses"](ROOT / "data/authoring/essential-senses-2026-10-22.json", required=True)
        prior = self.api["apply_essential_senses"](self.records[:self.size], old)
        self.assertEqual(len(prior), self.size + 2)
        latest = self.api["apply_essential_senses"](prior, self.review)
        self.assertEqual(latest, self.records)
        self.assertEqual(self.api["apply_essential_senses"](latest, self.review), latest)
        self.assertEqual(serialize_records(latest[:len(prior)]), serialize_records(prior))

    def test_ordered_loader_rejects_duplicate_ids_and_disconnected_batch_baselines(self):
        original = deepcopy(self.batches[0])
        subsequent = deepcopy(original)
        subsequent.update(reviewId="essential-senses-2026-10-24", date="2026-10-24")
        prior = self.api["apply_essential_senses"](self.records[:self.size], original)
        subsequent["baseline"] = {"entryCount": len(prior), "idsSha256": self.api["ids_digest"](prior), "vocabularySha256": hashlib.sha256(serialize_records(prior).encode()).hexdigest()}
        subsequent["entries"] = [deepcopy(subsequent["entries"][0])]
        subsequent["entries"][0]["word"]["id"] = "fixture-distinct-verb"
        facts = ROOT / "data/lexicons/american-oxford-2026-10.json"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            authoring = root / "data/authoring"
            authoring.mkdir(parents=True)
            (root / "data/lexicons").mkdir()
            (root / "data/lexicons/american-oxford-2026-10.json").write_bytes(facts.read_bytes())
            first_path = authoring / "essential-senses-2026-10-22.json"
            next_path = authoring / "essential-senses-2026-10-24.json"
            first_path.write_text(json.dumps(original))
            with patch.dict(self.api["load_essential_senses"].__globals__, {"ROOT": root}):
                next_path.write_text(json.dumps(subsequent))
                combined = self.api["load_essential_senses"](required=True)
                self.assertEqual(len(combined["entries"]), 3)
                self.assertEqual(combined["baseline"], original["baseline"])
                self.assertEqual(len(self.api["apply_essential_senses"](prior, combined)), len(prior) + 1)
                for bad in (
                    {**subsequent, "entries": original["entries"][:1]},
                    {**subsequent, "baseline": {**subsequent["baseline"], "entryCount": len(prior) - 1}},
                ):
                    next_path.write_text(json.dumps(bad))
                    with self.assertRaises(ValueError):
                        self.api["load_essential_senses"](required=True)

    def test_tail_conflict_reordering_and_undeclared_records_fail_closed(self):
        for records in (
            self.records[:self.size] + list(reversed(self.records[self.size:])),
            self.records + [{**self.records[-1], "id": "unlisted-sense"}],
        ):
            with self.assertRaises(ValueError):
                self.api["apply_essential_senses"](records, self.review)
        changed = deepcopy(self.records)
        changed[-1]["meaning_vi"] = "unreviewed replacement"
        with self.assertRaises(ValueError):
            self.api["apply_essential_senses"](changed, self.review)

    def test_exact_american_fact_receipts_are_checked_without_british_fact_index_fabrication(self):
        facts = json.loads((ROOT / "data/lexicons/american-oxford-2026-10.json").read_text())["facts"]
        for entry in self.review["entries"]:
            self.assertEqual(facts[entry["americanFactIndex"]], entry["americanFact"])
            self.assertEqual(entry["americanFact"]["cefr"], entry["word"]["level"])
            self.assertIn("v.", re.split(r"\s*,\s*", entry["americanFact"]["pos"]))
            self.assertEqual(entry["word"]["part_of_speech"], "verb")
            self.assertEqual(entry["word"]["source_fact_index"], "")
            self.assertEqual(entry["source"]["status"], 200)
            self.assertRegex(entry["source"]["sha256"], r"^[a-f0-9]{64}$")
            self.assertTrue(entry["source"]["title"])
            self.assertTrue(entry["source"]["scope"])
            self.assertNotIn("definitions", entry["source"])
        for entry in self.batches[0]["entries"]:
            self.assertEqual(entry["americanFact"]["cefr"], "A1")

    def test_missing_evidence_or_wrong_homograph_fact_is_rejected(self):
        for mutate in (
            lambda review: review["entries"][0]["source"].update(status=403),
            lambda review: review["entries"][1]["americanFact"].update(homograph="2"),
            lambda review: review["entries"][0]["word"].update(level="C2"),
            lambda review: review["entries"][0]["word"].update(part_of_speech="noun"),
            lambda review: review["entries"][0]["source"].update(checkedAt="2026-99-99Tinvalid"),
            lambda review: review["entries"][0]["source"].update(sha256="not-a-receipt"),
            lambda review: review["entries"][0]["source"].update(title=""),
        ):
            review = deepcopy(self.review)
            mutate(review)
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "review.json"
                path.write_text(json.dumps(review, ensure_ascii=False))
                with self.assertRaises(ValueError):
                    self.api["load_essential_senses"](path, required=True)

    def test_historical_provenance_and_new_source_layer_cover_the_canonical_tail(self):
        data = ROOT / "public/data"
        checksum = hashlib.sha256((data / "vocabulary.txt").read_bytes()).hexdigest()
        historical = json.loads((data / "full-review-provenance.json").read_text())
        additional = json.loads((data / "essential-senses-provenance.json").read_text())
        self.assertEqual(historical["reviewedEntries"], self.size)
        self.assertEqual(len(historical["entries"]), self.size)
        self.assertEqual(additional["entries"], self.review["entries"])
        self.assertEqual([batch["reviewId"] for batch in additional["reviews"]], [batch["reviewId"] for batch in self.batches])
        for authored, recorded in zip(self.batches, additional["reviews"]):
            self.assertEqual(recorded["baseline"], authored["baseline"])
            self.assertEqual(recorded["entries"], authored["entries"])
            self.assertEqual(recorded["manifest"], authored["_file"])
        self.assertEqual(additional["canonicalVocabularySha256"], checksum)
        self.assertEqual(historical["coverage"]["entryCount"], len(self.records))
        for filename in ("oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json", "source-update-provenance.json", "full-review-provenance.json"):
            doc = json.loads((data / filename).read_text())
            self.assertEqual(doc["essentialSenses"]["canonicalVocabularySha256"], checksum)

    def test_generated_batch_provenance_preserves_historical_facts(self):
        original = {"entries": [{"id": "historical", "sourceFactIndex": 17}], "baseline": {"vocabularySha256": "a" * 64}}
        documents = {"historical.json": deepcopy(original)}
        records = self.api["apply_essential_senses"](self.records[:self.size], self.review)
        text = serialize_records(records)
        updated = self.api["add_provenance"](documents, records, text, self.review)
        self.assertEqual(updated["historical.json"]["entries"], original["entries"])
        self.assertEqual(updated["historical.json"]["baseline"], original["baseline"])
        current = updated["essential-senses-provenance.json"]
        self.assertEqual(current["canonicalVocabularySha256"], hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual(current["addedEntries"], sum(len(batch["entries"]) for batch in self.batches))
        self.assertEqual([batch["entries"] for batch in current["reviews"]], [batch["entries"] for batch in self.batches])
        with self.assertRaises(ValueError):
            self.api["add_provenance"]({}, records[:-1], serialize_records(records[:-1]), self.review)

    def test_every_older_preview_keeps_additions_and_canonical_metadata_unchanged(self):
        data = ROOT / "public/data"
        names = ["vocabulary.txt", "vocabulary-version.json", "oxford-provenance.json", "frequency-provenance.json", "content-review-provenance.json", "source-update-provenance.json", "full-review-provenance.json", "essential-senses-provenance.json"]
        before = {name: (data / name).read_bytes() for name in names}
        with tempfile.TemporaryDirectory() as folder:
            for script in ("apply-essential-senses.py", "apply-source-update.py", "apply-full-review.py", "apply-content-review.py"):
                output = Path(folder) / (script + ".txt")
                subprocess.run([sys.executable, str(ROOT / "scripts" / script), "--output", str(output)], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
                self.assertEqual(output.read_bytes(), before["vocabulary.txt"], script)
        self.assertEqual({name: (data / name).read_bytes() for name in names}, before)


if __name__ == "__main__":
    unittest.main()
