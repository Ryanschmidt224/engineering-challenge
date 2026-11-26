"""Split the verifier's trusted fixture SQL into complete statements for D1 batch.
The runtime test restores only into its newly created local D1 binding.
"""

import json
import pathlib
import sqlite3
import sys

statements = []
pending = ""
for line in (
    pathlib.Path(sys.argv[1]).read_text(encoding="utf8").splitlines(keepends=True)
):
    pending += line
    if sqlite3.complete_statement(pending):
        statement = pending.strip()
        pending = ""
        if statement.upper() not in {
            "PRAGMA FOREIGN_KEYS=OFF;",
            "PRAGMA FOREIGN_KEYS=ON;",
            "BEGIN TRANSACTION;",
            "COMMIT;",
        }:
            statements.append(statement)
if pending.strip():
    raise ValueError("Incomplete recovery SQL statement")
print(json.dumps(statements))
