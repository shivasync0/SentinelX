"""Reset the local configured database to the deterministic demo scenario.

Use only for a local/demo database. It deletes all application rows.
"""

from app.database import Base
from app.main import SessionLocal, engine
from app.seed import seed_demo_data


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    print("Sentinel X demo database was reset.")


if __name__ == "__main__":
    main()
