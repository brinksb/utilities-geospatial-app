"""Pydantic schemas for API request/response models."""
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PropertyTypeSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    icon: str


class InspectionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property_id: int
    inspection_date: date
    status: str
    notes: Optional[str] = None
    inspector_name: Optional[str] = None


class PropertyListSchema(BaseModel):
    """Schema for property list (with coordinates for network overlay demo)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    property_type_id: int
    property_type: PropertyTypeSchema
    value: Optional[Decimal] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None


class PropertyDetailSchema(BaseModel):
    """Schema for property detail (with inspections and coordinates)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    property_type_id: int
    property_type: PropertyTypeSchema
    value: Optional[Decimal] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    inspections: list[InspectionSchema] = []


class PropertyCreateSchema(BaseModel):
    """Schema for creating a new property."""
    name: str
    address: Optional[str] = None
    property_type_id: int
    value: Optional[Decimal] = None
    longitude: float
    latitude: float
