"""Initialize the configured database and idempotently add the demo scenario."""

from app.database import Base
from app.main import SessionLocal, engine
from app.seed import seed_demo_data


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    print("Sentinel X demo data is ready.")


if __name__ == "__main__":
    main()
