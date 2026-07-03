export type UserRole = 'vendor' | 'admin';
export type UserStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type LocationRecord = {
  id: string;
  route_number: string;
  building_number: string;
  office_name: string;
  sup_number: string;
  estimated_bottles: number;
  latitude: number | null;
  longitude: number | null;
  location_notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted_to_admin'
  | 'rejected_by_admin'
  | 'resubmitted_to_admin'
  | 'approved'
  | 'finalised';

export type ItemStatus = 'pending' | 'completed' | 'no_issue_needed';

export interface Delivery {
  id: string;
  delivery_date: string;
  vendor_id: string;
  vendor_full_name: string;
  vendor_signature_url: string | null;
  admin_id: string | null;
  admin_full_name: string | null;
  admin_signature_url: string | null;
  status: DeliveryStatus;
  admin_comments: string | null;
  generated_pdf_url: string | null;
  final_signed_pdf_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  finalised_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  vendor?: Profile;
}

export interface DeliveryLocationItem {
  id: string;
  delivery_id: string;
  location_id: string | null;
  route_number: string;
  building_number: string;
  office_name: string;
  sup_number: string;
  estimated_bottles: number;
  issued_quantity: number;
  received_quantity: number;
  officer_name: string | null;
  officer_signature_url: string | null;
  no_issue_needed: boolean;
  status: ItemStatus;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined from locations table
  latitude?: number | null;
  longitude?: number | null;
}

export interface ReportExport {
  id: string;
  admin_id: string;
  export_type: 'csv' | 'excel' | 'pdf';
  filter_start_date: string | null;
  filter_end_date: string | null;
  generated_file_url: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string | null;
  updated_at: string;
}

export interface DeliveryWithItems extends Delivery {
  items: DeliveryLocationItem[];
}

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  year?: number;
  month?: number;
  vendor_id?: string;
  location_id?: string;
  building_number?: string;
  office_name?: string;
  sup_number?: string;
  status?: DeliveryStatus | '';
  no_issue_only?: boolean;
  min_issued?: number;
  max_issued?: number;
}
