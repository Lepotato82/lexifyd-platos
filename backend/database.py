import os
from sqlmodel import create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lexifyd.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_db():
    with Session(engine) as session:
        yield session
