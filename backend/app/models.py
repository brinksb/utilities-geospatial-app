"""SQLAlchemy models for database tables."""
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Date, Text, DateTime
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db import Base


class PropertyType(Base):
    __tablename__ = "property_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    color = Column(String(7), nullable=False, default="#3B82F6")
    icon = Column(String(50), nullable=False, default="building")

    properties = relationship("Property", back_populates="property_type")


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    address = Column(String(500))
    property_type_id = Column(Integer, ForeignKey("property_types.id"), nullable=False)
    value = Column(Numeric(15, 2))
    geometry = Column(Geometry("POINT", srid=4326), nullable=False)

    property_type = relationship("PropertyType", back_populates="properties")
    inspections = relationship("Inspection", back_populates="property", cascade="all, delete-orphan")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    inspection_date = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    notes = Column(Text)
    inspector_name = Column(String(200))

    property = relationship("Property", back_populates="inspections")
