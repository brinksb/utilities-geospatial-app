export interface PropertyType {
  id: number
  name: string
  color: string
  icon: string
}

export interface Property {
  id: number
  name: string
  address: string | null
  property_type_id: number
  property_type: PropertyType
  value: number | null
  longitude: number | null
  latitude: number | null
}

export interface PropertyDetail extends Property {
  inspections: Inspection[]
}

export interface Inspection {
  id: number
  property_id: number
  inspection_date: string
  status: string
  notes: string | null
  inspector_name: string | null
}
