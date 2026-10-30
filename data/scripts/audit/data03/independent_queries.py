"""Independent DATA-03 expected values: stdlib only, no production helpers.

Reads released DATA-01/02 artifacts; does not download, normalize or alter them.
Run from the module: python -X utf8 scripts/audit/data03/independent_queries.py
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


MODULE = Path(__file__).resolve().parents[3]
OUTPUT = MODULE / "data/ccpc/processed/audit-data03/expected-results.json"
COUNT_FIELDS = ("nominalList", "voted", "didNotVote", "unspecified")
EXPECTED_ANCHOR_SHA = "24b8f676d2a8ed7a05d32c1abdfcfc277f38edfc47c42e86220efc711b4fcdec"
YEARS = (2009, 2012, 2015, 2018, 2021, 2024)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def metrics(counts):
    nominal = counts["nominalList"]
    classified = counts["voted"] + counts["didNotVote"]
    result = {"classified": classified}
    for field, numerator in (("participation", "voted"), ("abstention", "didNotVote"), ("unspecified", "unspecified")):
        rate = counts[numerator] / nominal if nominal else None
        result[field + "Rate"] = rate
        result[field + "Pct"] = rate * 100 if rate is not None else None
    result["ccpcParticipationPct"] = counts["voted"] * 100 / classified if classified else None
    result["ccpcAbstentionPct"] = counts["didNotVote"] * 100 / classified if classified else None
    return result


def selected(records, **filters):
    return [row for row in records if all(row[key] == value for key, value in filters.items())]


def summary(records, **filters):
    rows = selected(records, **filters)
    counts = {key: sum(row[key] for row in rows) for key in COUNT_FIELDS}
    assert counts["nominalList"] == counts["voted"] + counts["didNotVote"] + counts["unspecified"]
    return {"filters": filters, "recordCount": len(rows), "sourceRows": sum(row["sourceRows"] for row in rows),
            "sourceIds": sorted({row["sourceId"] for row in rows}), "counts": counts, "metrics": metrics(counts)}


def breakdown(records, year, dimension):
    rows = selected(records, year=year)
    categories = ("hombre", "mujer", "no_binario") if dimension == "sex" else ("urbana", "mixta", "rural")
    result = {"year": year, "dimension": dimension, "groups": []}
    for value in categories:
        if any(row[dimension] == value for row in rows):
            result["groups"].append({"value": value, **summary(rows, **{dimension: value})})
    national = summary(rows)
    for key in COUNT_FIELDS:
        assert sum(bucket["counts"][key] for bucket in result["groups"]) == national["counts"][key]
    return result


def verify_artifact(path):
    data = load(path)
    manifest_path = path.with_name("manifest.json")
    manifest = load(manifest_path)
    assert sha(path) == manifest["datasetSha256"]
    assert len(data["records"]) == manifest["recordCount"]
    assert len(data["sources"]) == manifest["sourceCount"]
    assert sum(source["rawRows"] for source in data["sources"]) == manifest["rawRowCount"]
    assert data["years"] == manifest["years"] == list(YEARS)
    for line in path.with_name("checksums.sha256").read_text(encoding="utf-8").splitlines():
        digest, name = line.split("  ")
        assert sha(path.with_name(name)) == digest
    anchors_path = MODULE / "data/ccpc/source-anchors.json"
    assert sha(anchors_path) == EXPECTED_ANCHOR_SHA
    anchors = load(anchors_path)
    pins = {source["id"]: source for source in anchors["sources"]}
    catalog = {entry["year"]: entry for entry in load(MODULE / "data/ccpc/sources.json")["sources"]}
    for source in data["sources"]:
        assert {key: value for key, value in source.items() if key != "downloadedAt"} == pins[source["id"]]
        assert source["archiveSha256"] == catalog[source["year"]]["sha256"]
        assert source["url"] == catalog[source["year"]]["url"]
    seen = set()
    for row in data["records"]:
        key = tuple(row[field] for field in ("year", "entityCode", "sex", "ageGroup", "sectionType"))
        assert key not in seen
        seen.add(key)
        assert row["sourceId"] in pins
        assert row["sourceRows"] > 0
        for field in COUNT_FIELDS:
            assert type(row[field]) is int and 0 <= row[field] <= 2**53 - 1
        assert row["nominalList"] == row["voted"] + row["didNotVote"] + row["unspecified"]
        for field, expected in metrics(row).items():
            actual = row[field]
            assert actual is None if expected is None else actual is not None and math.isclose(actual, expected, abs_tol=2e-14, rel_tol=1e-14), (key, field, actual, expected)
    return data, {"path": path.relative_to(MODULE).as_posix(), "sha256": sha(path),
                  "manifestSha256": sha(manifest_path), "kind": data["kind"],
                  "recordCount": len(data["records"]), "sourceCount": len(data["sources"]),
                  "rawRowCount": manifest["rawRowCount"], "sourceAnchorsSha256": sha(anchors_path)}


def main():
    fixture, fixture_evidence = verify_artifact(MODULE / "data/ccpc/sample/data02/participation.json")
    full_path = MODULE / "data/ccpc/processed/data02/participation.json"
    full, full_evidence = verify_artifact(full_path) if full_path.exists() else (None, None)
    data = full if full is not None else fixture
    rows = data["records"]
    s2018 = summary(rows, year=2018)
    s2024 = summary(rows, year=2024)
    p2018 = s2018["metrics"]["participationPct"]
    p2024 = s2024["metrics"]["participationPct"]
    c2018 = s2018["metrics"]["ccpcParticipationPct"]
    c2024 = s2024["metrics"]["ccpcParticipationPct"]
    support = selected(rows, year=2024, entityCode="01", sex="hombre", ageGroup="18-19", sectionType="urbana")
    output = {
        "computation": "Python standard library; counts aggregated before percentages; no production imports",
        "scope": "complete entity-level cut" if full is not None else "development fixture only; not national estimates",
        "verifiedArtifacts": {"full": full_evidence, "fixture": fixture_evidence},
        "summaries": {"national2018": s2018, "national2024": s2024, "colima2024": summary(rows, year=2024, entityCode="06")},
        "comparison2018To2024": {"baselineYear": 2018, "targetYear": 2024,
            "participationDifferencePercentagePoints": p2024 - p2018,
            "ccpcParticipationDifferencePercentagePoints": c2024 - c2018,
            "relativeParticipationChangeRatio": (p2024 - p2018) / p2018 if p2018 else None,
            "relativeParticipationChangePercent": (p2024 - p2018) / p2018 * 100 if p2018 else None},
        "breakdowns": {"sex2024": breakdown(rows, 2024, "sex"), "sectionType2024": breakdown(rows, 2024, "sectionType")},
        "supportingRecords": {"filters": {"year": 2024, "entityCode": "01", "sex": "hombre", "ageGroup": "18-19", "sectionType": "urbana"},
                              "records": support, "sources": [source for source in data["sources"] if source["id"] in {row["sourceId"] for row in support}]},
        "fixture": {"summariesByYear": [summary(fixture["records"], year=year) for year in YEARS],
                    "supportingRecords": selected(fixture["records"], year=2024, entityCode="01", sex="hombre", ageGroup="18-19", sectionType="urbana")},
        "qualityFacts": {"lowFrequencyLn1ByYear": {str(year): sum(row["year"] == year and row["nominalList"] == 1 for row in rows) for year in YEARS},
                         "nonBinaryYearsObserved": sorted({row["year"] for row in rows if row["sex"] == "no_binario"}),
                         "entity09NamesByYear": {str(year): sorted({row["entityName"] for row in rows if row["year"] == year and row["entityCode"] == "09"}) for year in YEARS}},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"output": str(OUTPUT), "sha256": sha(OUTPUT), "full": full_evidence, "fixture": fixture_evidence,
                      "national2024": s2024["counts"], "colima2024": output["summaries"]["colima2024"]["counts"], "comparison": output["comparison2018To2024"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
