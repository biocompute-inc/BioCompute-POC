from __future__ import annotations

import argparse
from pathlib import Path

import sqlalchemy as sa


TABLE_ORDER = [
    "users",
    "files",
    "jobs",
    "notifications",
    "job_events",
    "sessions",
    "password_reset_tokens",
    "rate_limit_events",
]

SERIAL_PK_TABLES = [
    ("users", "id"),
    ("notifications", "id"),
    ("job_events", "id"),
    ("password_reset_tokens", "id"),
    ("rate_limit_events", "id"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate data from SQLite to Postgres (Supabase)."
    )
    parser.add_argument(
        "--sqlite",
        required=True,
        help="Path to SQLite DB file (e.g. backend/poc.db)",
    )
    parser.add_argument(
        "--postgres",
        required=True,
        help="Postgres connection URL",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete data in Postgres tables before inserting",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for inserts",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite DB not found: {sqlite_path}")

    sqlite_engine = sa.create_engine(f"sqlite:///{sqlite_path.as_posix()}")
    pg_engine = sa.create_engine(args.postgres)

    sqlite_meta = sa.MetaData()
    sqlite_meta.reflect(bind=sqlite_engine, only=TABLE_ORDER)

    pg_meta = sa.MetaData()
    pg_meta.reflect(bind=pg_engine, only=TABLE_ORDER)

    def sanitize_row(row: dict) -> dict:
        cleaned = {}
        for key, value in row.items():
            if isinstance(value, str) and "\x00" in value:
                value = value.replace("\x00", "")
            cleaned[key] = value
        return cleaned

    with pg_engine.begin() as pg_conn:
        if args.truncate:
            for table_name in reversed(TABLE_ORDER):
                pg_conn.execute(sa.text(f'TRUNCATE TABLE "{table_name}" CASCADE'))

        for table_name in TABLE_ORDER:
            sqlite_table = sqlite_meta.tables.get(table_name)
            pg_table = pg_meta.tables.get(table_name)
            if sqlite_table is None or pg_table is None:
                raise SystemExit(f"Missing table in metadata: {table_name}")

            print(f"Migrating {table_name}...")
            rows = []
            with sqlite_engine.connect() as sqlite_conn:
                result = sqlite_conn.execute(sa.select(sqlite_table))
                for row in result.mappings():
                    rows.append(sanitize_row(dict(row)))
                    if len(rows) >= args.batch_size:
                        pg_conn.execute(pg_table.insert(), rows)
                        rows.clear()
            if rows:
                pg_conn.execute(pg_table.insert(), rows)

        for table_name, pk in SERIAL_PK_TABLES:
            pg_conn.execute(
                sa.text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(:table_name, :pk_name),
                        COALESCE(MAX({pk}), 1),
                        MAX({pk}) IS NOT NULL
                    )
                    FROM "{table_name}"
                    """
                ),
                {"table_name": table_name, "pk_name": pk},
            )


if __name__ == "__main__":
    main()
