"""Verify a BuildingSchmidt whole-site data backup; optionally extract recovery files.
No network, credentials, database writes or live-site restore operations.
"""

import argparse, base64, hashlib, json, math, pathlib, shutil, tempfile

p = argparse.ArgumentParser()
p.add_argument("backup")
p.add_argument("--extract", type=pathlib.Path)
args = p.parse_args()
if args.extract and args.extract.exists():
    p.error("Extraction destination must not exist.")


def literal(v):
    if v is None:
        return "NULL"
    if isinstance(v, dict) and set(v) == {"blob"}:
        return "X'" + bytes(v["blob"]).hex() + "'"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def quote(v):
    return '"' + v.replace('"', '""') + '"'


def unique_json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON property: " + key)
        result[key] = value
    return result


with tempfile.TemporaryDirectory() as temp:
    root = pathlib.Path(temp)
    (root / "objects").mkdir()
    rows = 0
    objects = []
    schema = []
    current = None
    digest = ""
    complete = False
    manifest = False
    schema_seen = False
    verified = False
    database_hash = ""
    inventory_hash = ""
    tables = set()
    keys = set()
    object_phase = False
    with open(root / "rows.sql", "w", encoding="utf8") as sql, open(
        args.backup, "rb"
    ) as source:
        for raw in source:
            if complete:
                raise ValueError("Content after completion marker")
            if not raw.endswith(b"\n"):
                raise ValueError("Truncated backup line")
            line = raw[:-1]
            entry = json.loads(
                line,
                object_pairs_hook=unique_json_object,
                parse_constant=lambda value: (_ for _ in ()).throw(
                    ValueError("Non-finite JSON value")
                ),
            )
            if not isinstance(entry, dict) or not isinstance(entry.get("type"), str):
                raise ValueError("Backup records must have a type")
            kind = entry["type"]
            if not manifest and kind != "manifest":
                raise ValueError("Backup must start with its manifest")
            if verified and kind != "complete":
                raise ValueError("Only completion may follow verification")
            if kind == "complete":
                if not verified or entry.get("sha256") != digest or current is not None:
                    raise ValueError("Incomplete or corrupted backup")
                complete = True
                continue
            digest = hashlib.sha256(digest.encode() + line).hexdigest()
            if kind == "manifest":
                if (
                    manifest
                    or entry.get("format") != "building-schmidt-site-data"
                    or type(entry.get("version")) is not int
                    or entry["version"] != 1
                    or entry.get("database") != "WORKSHOP_DB"
                    or entry.get("bucket") != "PHOTOS"
                    or not isinstance(entry.get("createdAt"), str)
                ):
                    raise ValueError("Invalid or unsupported backup manifest")
                manifest = True
            elif kind == "schema":
                if (
                    schema_seen
                    or object_phase
                    or not isinstance(entry.get("objects"), list)
                ):
                    raise ValueError("Duplicate or misplaced schema")
                schema = entry["objects"]
                schema_seen = True
                names = set()
                for item in schema:
                    if (
                        not isinstance(item, dict)
                        or item.get("type") not in ("table", "index", "trigger", "view")
                        or not isinstance(item.get("name"), str)
                        or not item["name"]
                        or (item["type"], item["name"]) in names
                        or not isinstance(item.get("sql"), str)
                        or not item["sql"]
                    ):
                        raise ValueError("Invalid schema object")
                    names.add((item["type"], item["name"]))
                    if item["type"] == "table":
                        tables.add(item["name"])
                database_hash = hashlib.sha256(
                    database_hash.encode() + line
                ).hexdigest()
            elif kind == "row":
                if (
                    not schema_seen
                    or object_phase
                    or entry.get("table") not in tables
                    or not isinstance(entry.get("value"), dict)
                    or not entry["value"]
                ):
                    raise ValueError("Misplaced row or undeclared table")
                values = entry["value"]
                for name, value in values.items():
                    if not isinstance(name, str) or not name:
                        raise ValueError("Invalid column name")
                    if isinstance(value, float) and not math.isfinite(value):
                        raise ValueError("Non-finite database value")
                    if isinstance(value, (dict, list)) and not (
                        isinstance(value, dict)
                        and set(value) == {"blob"}
                        and isinstance(value["blob"], list)
                        and all(type(v) is int and 0 <= v <= 255 for v in value["blob"])
                    ):
                        raise ValueError("Invalid database value")
                database_hash = hashlib.sha256(
                    database_hash.encode() + line
                ).hexdigest()
                sql.write(
                    "INSERT INTO "
                    + quote(entry["table"])
                    + "("
                    + ",".join(map(quote, values))
                    + ") VALUES("
                    + ",".join(literal(v) for v in values.values())
                    + ");\n"
                )
                rows += 1
            elif kind == "object":
                if not schema_seen or current:
                    raise ValueError("Misplaced or unfinished object")
                if (
                    not isinstance(entry.get("key"), str)
                    or not entry["key"]
                    or entry["key"] in keys
                    or type(entry.get("size")) is not int
                    or entry["size"] < 0
                    or not isinstance(entry.get("etag"), str)
                ):
                    raise ValueError("Invalid or duplicate object metadata")
                # Version 1 writers put type first. Hash the original metadata bytes
                # so Unicode, field order and escaping exactly match the producer.
                prefix = b'{"type":"object",'
                if not line.startswith(prefix):
                    raise ValueError("Invalid v1 object record encoding")
                inventory_hash = hashlib.sha256(
                    inventory_hash.encode() + b"{" + line[len(prefix) :]
                ).hexdigest()
                keys.add(entry["key"])
                object_phase = True
                current = {
                    **entry,
                    "localFile": "objects/" + str(len(objects) + 1) + ".bin",
                }
                current.pop("type")
                current["readSize"] = 0
                current["handle"] = open(root / current["localFile"], "wb")
            elif kind == "bytes":
                if current is None:
                    raise ValueError("Object bytes without metadata")
                data = base64.b64decode(entry["data"], validate=True)
                if current["readSize"] + len(data) > current["size"]:
                    raise ValueError("Object exceeds declared size")
                current["handle"].write(data)
                current["readSize"] += len(data)
            elif kind == "end_object":
                if (
                    current is None
                    or entry["key"] != current["key"]
                    or current["readSize"] != current["size"]
                    or entry["size"] != current["size"]
                ):
                    raise ValueError("Object size mismatch")
                current.pop("handle").close()
                current.pop("readSize")
                objects.append(current)
                current = None
            elif kind == "verified":
                if (
                    not schema_seen
                    or current is not None
                    or entry.get("databaseHash") != database_hash
                    or entry.get("objectInventoryHash") != inventory_hash
                    or type(entry.get("files")) is not int
                    or entry["files"] != len(objects)
                ):
                    raise ValueError(
                        "Backup verification record does not match its contents"
                    )
                verified = True
            else:
                raise ValueError("Unknown backup record type: " + kind)
    if not complete:
        raise ValueError("Backup has no verified completion marker")
    if args.extract:
        with open(root / "database.sql", "w", encoding="utf8") as out:
            out.write("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n")
            for item in schema:
                if item["type"] == "table":
                    out.write(item["sql"] + ";\n")
            with open(root / "rows.sql", encoding="utf8") as sql:
                shutil.copyfileobj(sql, out)
            for item in schema:
                if item["type"] != "table":
                    out.write(item["sql"] + ";\n")
            out.write("COMMIT;\nPRAGMA foreign_keys=ON;\n")
        (root / "rows.sql").unlink()
        (root / "objects.json").write_text(
            json.dumps(objects, indent=2), encoding="utf8"
        )
        shutil.copytree(root, args.extract)
    print(
        "Verified:",
        rows,
        "database rows and",
        len(objects),
        "stored objects. SHA-256:",
        digest,
    )
