#!/usr/bin/env python3
"""Extract the canonical Powder workbook into stable JSON for source auditing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import openpyxl


def rows_as_records(sheet):
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(value).strip() if value is not None else f"column_{index + 1}" for index, value in enumerate(rows[0])]
    return [
        {headers[index]: value for index, value in enumerate(row) if value is not None}
        for row in rows[1:]
        if any(value is not None for value in row)
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    workbook = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
    payload = {
        "workbook": args.workbook.name,
        "sheets": {
            sheet.title: rows_as_records(sheet)
            for sheet in workbook.worksheets
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
