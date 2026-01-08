"""API routes."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.db import get_db
from app.models import PropertyType, Property
from app.schemas import (
    PropertyTypeSchema,
    PropertyListSchema,
    PropertyDetailSchema,
    PropertyCreateSchema,
)

router = APIRouter()


def _add_coordinates(property_obj, db: Session):
    """Extract lon/lat from geometry and add to property object.

    Demo feature: enables sidebar clicks to trigger network overlay.
    In production, coordinates might come from a different source.
    """
    if property_obj and property_obj.geometry:
        coords = db.execute(
            func.ST_X(property_obj.geometry),
        ).scalar(), db.execute(
            func.ST_Y(property_obj.geometry),
        ).scalar()
        property_obj.longitude = coords[0]
        property_obj.latitude = coords[1]
    return property_obj


@router.get("/property-types", response_model=list[PropertyTypeSchema])
def get_property_types(db: Session = Depends(get_db)):
    """Get all property types."""
    return db.query(PropertyType).all()


@router.get("/properties", response_model=list[PropertyListSchema])
def get_properties(
    type_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get all properties, optionally filtered by type."""
    query = db.query(Property).options(joinedload(Property.property_type))

    if type_id is not None:
        query = query.filter(Property.property_type_id == type_id)

    properties = query.all()

    # Add coordinates for network overlay demo
    for prop in properties:
        _add_coordinates(prop, db)

    return properties


@router.get("/properties/{property_id}", response_model=PropertyDetailSchema)
def get_property(property_id: int, db: Session = Depends(get_db)):
    """Get a single property with its inspections."""
    property = (
        db.query(Property)
        .options(
            joinedload(Property.property_type),
            joinedload(Property.inspections),
        )
        .filter(Property.id == property_id)
        .first()
    )

    if not property:
        raise HTTPException(status_code=404, detail="Property not found")

    # Add coordinates for network overlay demo
    _add_coordinates(property, db)

    return property


@router.post("/properties", response_model=PropertyDetailSchema, status_code=201)
def create_property(
    property_data: PropertyCreateSchema,
    db: Session = Depends(get_db),
):
    """Create a new property."""
    # Verify property type exists
    property_type = db.query(PropertyType).filter(
        PropertyType.id == property_data.property_type_id
    ).first()
    if not property_type:
        raise HTTPException(status_code=400, detail="Invalid property_type_id")

    # Create geometry from lat/lon
    geometry = func.ST_SetSRID(
        func.ST_MakePoint(property_data.longitude, property_data.latitude),
        4326
    )

    property = Property(
        name=property_data.name,
        address=property_data.address,
        property_type_id=property_data.property_type_id,
        value=property_data.value,
        geometry=geometry,
    )

    db.add(property)
    db.commit()
    db.refresh(property)

    # Reload with relationships
    return (
        db.query(Property)
        .options(
            joinedload(Property.property_type),
            joinedload(Property.inspections),
        )
        .filter(Property.id == property.id)
        .first()
    )
