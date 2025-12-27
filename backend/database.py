from sqlalchemy import create_engine, Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os

DATABASE_URL = "sqlite:///./neuralplay.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Video(Base):
    __tablename__ = "videos"
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True)
    name = Column(String)
    
    transcript = relationship("Transcript", back_populates="video", uselist=False)

class Transcript(Base):
    __tablename__ = "transcripts"
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    text = Column(Text)
    start_time = Column(Float)
    end_time = Column(Float)
    
    video = relationship("Video", back_populates="transcript")

def init_db():
    Base.metadata.create_all(bind=engine)
