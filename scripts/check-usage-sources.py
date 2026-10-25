#!/usr/bin/env python3
"""Read-only checks for the exact Oxford American sources in usage supplements.

Examples:
  python3 scripts/check-usage-sources.py --offline
  python3 scripts/check-usage-sources.py --files data/usage/group-c.json \
      --report /tmp/usage-source-check.json

Live checks confirm an article's identity and readable dictionary content, not
the semantic correctness of an authored rule, translation, or example. Reviewers
must read the source. Fresh HTML hashes are reported separately from historical
authoring receipts: publisher HTML can change without a change in the entry.
The report contains metadata only; source HTML/text is never written to disk.
"""

import argparse
import concurrent.futures
import hashlib
import html
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from corpus_io import read_records

ROOT = Path(__file__).resolve().parents[1]
HOST = "www.oxfordlearnersdictionaries.com"
ARTICLE_PATHS = ("/definition/american_english/", "/definition/english/")
MAX_RESPONSE_BYTES = 3 * 1024 * 1024
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
TITLE_PATTERN = re.compile(
    r"^(?P<headword>.+?) (?P<pos>phrasal verb|modal verb|auxiliary verb|"
    r"verb|noun|adjective|adverb|preposition|pronoun|determiner|conjunction|"
    r"exclamation|number|prefix|suffix|abbreviation) - Definition,.*"
    r"Oxford Advanced (?:American Dictionary|Learner's Dictionary) at OxfordLearnersDictionaries\.com$",
    re.IGNORECASE,
)


def normalized(value):
    """Only presentation normalization, never fuzzy or synonym matching."""
    return " ".join(
        unicodedata.normalize("NFKC", html.unescape(value))
        .replace("’", "'").replace("‘", "'")
        .replace("‐", "-").replace("‑", "-").split()
    ).casefold()


def valid_url(url):
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme != "https" or parsed.hostname != HOST
        or parsed.username or parsed.password or parsed.port
        or not any(parsed.path.startswith(prefix) and len(parsed.path) > len(prefix) for prefix in ARTICLE_PATHS)
        or parsed.query
    ):
        raise ValueError("Expected an HTTPS Oxford dictionary article URL")
    return urllib.parse.urlunsplit(parsed._replace(fragment=""))


def title_identity(title):
    match = TITLE_PATTERN.fullmatch(" ".join(html.unescape(title).split()))
    if not match:
        raise ValueError("Receipt title does not identify an Oxford dictionary article")
    return {key: normalized(value) for key, value in match.groupdict().items()}


class ArticleInfo(HTMLParser):
    """Read the primary article header; related entries cannot prove identity."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.fields = {"title": [], "headword": [], "pos": []}
        self.captured = set()
        self.entry_found = False
        self.american_entry = False
        self.definition_count = 0
        self.article_characters = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        inside = any(frame["inside"] for frame in self.stack)
        if attrs.get("id") == "entryContent":
            inside = True
            self.entry_found = True
            self.american_entry = "oaad" in classes
        if inside and attrs.get("dict") == "oaad":
            self.american_entry = True
        field = None
        if tag == "title":
            field = "title"
        elif inside and tag in ("h1", "h2") and {"h", "headword"}.intersection(classes):
            field = "headword"
        elif inside and tag == "span" and "pos" in classes:
            field = "pos"
        if field in self.captured:
            field = None
        elif field:
            self.captured.add(field)
        if inside and "def" in classes:
            self.definition_count += 1
        if tag not in VOID_TAGS:
            self.stack.append({
                "tag": tag, "inside": inside, "field": field,
                "homograph_marker": tag == "sup" or bool(
                    {"hm", "homnum"}.intersection(classes)
                ),
            })

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tag"] == tag:
                del self.stack[index:]
                break

    def handle_data(self, value):
        if any(frame["tag"] in ("script", "style") for frame in self.stack):
            return
        if any(frame["inside"] for frame in self.stack):
            self.article_characters += len(value.strip())
        for field in self.fields:
            if any(frame["field"] == field for frame in self.stack):
                # Publisher homograph markers are not part of the headword.
                # Do not remove ordinary digits from real headword text.
                if field != "headword" or not any(
                    frame["homograph_marker"] for frame in self.stack
                ):
                    self.fields[field].append(value)

    def text(self, field):
        return " ".join("".join(self.fields[field]).split())


class SamePublisherRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        valid_url(new_url)
        return super().redirect_request(
            request, response, code, message, headers, new_url
        )


def validate_receipt(receipt):
    if not isinstance(receipt, dict):
        raise ValueError("Source receipt must be an object")
    for key in ("url", "title", "checkedAt", "sha256"):
        if not isinstance(receipt.get(key), str) or not receipt[key].strip():
            raise ValueError(f"Missing source receipt {key}")
    url = valid_url(receipt["url"])
    title_identity(receipt["title"])
    expected = "Oxford Advanced American Dictionary" if "/american_english/" in url else "Oxford Advanced Learner's Dictionary"
    if expected not in html.unescape(receipt["title"]):
        raise ValueError("Source receipt title disagrees with the dictionary URL")
    if not re.fullmatch(r"[a-f0-9]{64}", receipt["sha256"]):
        raise ValueError("Source receipt needs a lowercase SHA256")
    try:
        datetime.fromisoformat(receipt["checkedAt"].replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Source receipt needs an ISO date or timestamp") from error
    return url


def fetch_article(url, timeout):
    result = {
        "url": url,
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ok": False,
    }
    try:
        valid_url(url)
        opener = urllib.request.build_opener(SamePublisherRedirect)
        request = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html"}
        )
        with opener.open(request, timeout=timeout) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
            result.update(
                status=response.status, finalURL=response.url, bytes=len(body)
            )
            if len(body) > MAX_RESPONSE_BYTES:
                raise ValueError("Response exceeds the article-size safety limit")
            if response.status != 200:
                raise ValueError("Publisher did not return HTTP 200")
            if "html" not in response.headers.get("Content-Type", "").lower():
                raise ValueError("Publisher did not return HTML")
        valid_url(result["finalURL"])
        result["sha256"] = hashlib.sha256(body).hexdigest()
        article = ArticleInfo()
        article.feed(body.decode("utf-8", errors="replace"))
        title = article.text("title")
        result.update(
            title=title, headword=article.text("headword"),
            partOfSpeech=article.text("pos"),
            articleCharacters=article.article_characters,
            definitionCount=article.definition_count,
        )
        identity = title_identity(title)
        if not article.entry_found or ("/american_english/" in url and not article.american_entry):
            raise ValueError("No expected Oxford entryContent container")
        if article.definition_count < 1 or article.article_characters < 80:
            raise ValueError("No substantial dictionary definition body")
        if identity != {
            "headword": normalized(result["headword"]),
            "pos": normalized(result["partOfSpeech"]),
        }:
            raise ValueError("Primary article header disagrees with its title")
        result["ok"] = True
    except (OSError, ValueError, urllib.error.URLError) as error:
        result["error"] = str(error)
    return result


def load_entries(paths):
    corpus = {
        word["id"]: word
        for word in read_records(ROOT / "public/data/vocabulary.txt")
    }
    entries = []
    references = {}
    seen = set()
    for path in paths:
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, list) or not document:
            raise ValueError(f"{path}: expected a nonempty supplement array")
        for entry in document:
            if not isinstance(entry, dict) or entry.get("wordId") in seen:
                raise ValueError(f"{path}: duplicate or malformed supplement")
            word = corpus.get(entry.get("wordId"))
            if not word or any(
                entry.get(key) != word.get(field, "")
                for key, field in (
                    ("headword", "word"), ("partOfSpeech", "part_of_speech"),
                    ("meaningVi", "meaning_vi"),
                )
            ):
                raise ValueError(f"{path}: supplement does not match canonical sense/POS")
            seen.add(entry["wordId"])
            sources = entry.get("sources")
            if not isinstance(sources, list) or not sources:
                raise ValueError(f"{path}: no source receipts for {entry['wordId']}")
            for receipt in sources:
                url = validate_receipt(receipt)
                references.setdefault(url, []).append((entry["wordId"], receipt))
            aliases = {
                normalized(value) for value in (
                    [word["word"], word.get("preferred_us_spelling", "")]
                    + word.get("spelling_variants", "").split("|")
                ) if value
            }
            entries.append({
                "wordId": entry["wordId"], "headwords": aliases,
                "partOfSpeech": normalized(entry["partOfSpeech"]),
                "sources": sources,
            })
    return entries, references


def primary_matches(entry, identities):
    return any(
        identities[valid_url(source["url"])]["headword"] in entry["headwords"]
        and identities[valid_url(source["url"])]["pos"] == entry["partOfSpeech"]
        for source in entry["sources"]
        if valid_url(source["url"]) in identities
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--files", nargs="+", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument(
        "--offline", action="store_true",
        help="Validate metadata and source identity declarations only; do not fetch",
    )
    parser.add_argument("--timeout", type=float, default=25)
    args = parser.parse_args()
    paths = [
        (path if path.is_absolute() else ROOT / path).resolve()
        for path in (args.files or sorted((ROOT / "data/usage").glob("*.json")))
    ]
    if not paths or args.timeout <= 0:
        parser.error("Provide source files and a positive timeout")
    if args.report and args.report.resolve() in paths:
        parser.error("The read-only check cannot overwrite an input supplement")
    try:
        entries, references = load_entries(paths)
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(f"FAIL source metadata: {error}", file=sys.stderr)
        return 1
    report = {
        "mode": "offline-metadata" if args.offline else "live-article",
        "supplements": len(entries), "sourceCount": len(references),
        "metadataValidated": True,
        "scope": "Identity/body checks do not certify authored usage semantics.",
        "results": [], "entryIdentityFailures": [],
    }
    identities = {}
    if args.offline:
        for url, declarations in sorted(references.items()):
            declared = {normalized(receipt["title"]) for _, receipt in declarations}
            if len(declared) != 1:
                report["results"].append({
                    "url": url, "ok": False,
                    "error": "Conflicting declared article titles for the same URL",
                })
                continue
            identities[url] = title_identity(declarations[0][1]["title"])
            report["results"].append({
                "url": url, "ok": True,
                "validation": "metadata only; not fetched",
            })
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(
                lambda url: fetch_article(url, args.timeout), sorted(references)
            ))
        for result in results:
            declarations = references[result["url"]]
            result["referencedBy"] = sorted({word_id for word_id, _ in declarations})
            result["receiptHashes"] = sorted({r["sha256"] for _, r in declarations})
            if result["ok"] and any(
                normalized(receipt["title"]) != normalized(result["title"])
                for _, receipt in declarations
            ):
                result.update(ok=False, error="Fresh article title differs from its receipt")
            if result["ok"]:
                identities[result["url"]] = title_identity(result["title"])
        report["results"] = results
    for entry in entries:
        if not primary_matches(entry, identities):
            report["entryIdentityFailures"].append(entry["wordId"])
    report["passed"] = sum(result["ok"] for result in report["results"])
    report["ok"] = (
        report["passed"] == report["sourceCount"]
        and not report["entryIdentityFailures"]
    )
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    label = "Metadata only (no network verification)" if args.offline else "Live articles"
    print(
        f"{label}: {report['passed']}/{report['sourceCount']}; "
        f"supplements: {len(entries)}; "
        f"entry identity failures: {len(report['entryIdentityFailures'])}"
    )
    for result in report["results"]:
        if not result["ok"]:
            print(f"FAIL {result['url']}: {result['error']}")
    for word_id in report["entryIdentityFailures"]:
        print(f"FAIL {word_id}: no source for its exact headword/spelling and POS")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
