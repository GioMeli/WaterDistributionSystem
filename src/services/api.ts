import { supabase } from '@/db/supabase';
import type {
  Profile,
  LocationRecord,
  Delivery,
  DeliveryLocationItem,
  DeliveryStatus,
  AppSetting,
} from '@/types/types';

// ============================================================
// PROFILES
// ============================================================
export const getProfile = async (id: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return { data: data as Profile | null, error };
};

export const getAllVendors = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'vendor')
    .order('full_name');
  return { data: (data as Profile[]) ?? [], error };
};

export const updateProfile = async (id: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().maybeSingle();
  return { data: data as Profile | null, error };
};

export const createVendorUser = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.admin?.createUser({
    email,
    password,
    user_metadata: { full_name: fullName, role: 'vendor' },
    email_confirm: true,
  });
  return { data, error };
};

// ============================================================
// LOCATIONS
// ============================================================
export const getActiveLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('route_number');
  return { data: (data as LocationRecord[]) ?? [], error };
};

export const getAllLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order')
    .order('route_number');
  return { data: (data as LocationRecord[]) ?? [], error };
};

export const upsertLocation = async (location: Partial<LocationRecord>) => {
  const { data, error } = location.id
    ? await supabase.from('locations').update(location).eq('id', location.id).select().maybeSingle()
    : await supabase.from('locations').insert(location).select().maybeSingle();
  return { data: data as LocationRecord | null, error };
};

export const toggleLocationActive = async (id: string, is_active: boolean) => {
  const { error } = await supabase.from('locations').update({ is_active }).eq('id', id);
  return { error };
};

// ============================================================
// DELIVERIES
// ============================================================
export const createDelivery = async (delivery: {
  delivery_date: string;
  vendor_id: string;
  vendor_full_name: string;
  status: DeliveryStatus;
}) => {
  const { data, error } = await supabase.from('deliveries').insert(delivery).select().maybeSingle();
  return { data: data as Delivery | null, error };
};

export const createDeliveryItems = async (items: Partial<DeliveryLocationItem>[]) => {
  const { error } = await supabase.from('delivery_location_items').insert(items);
  return { error };
};

export const getDelivery = async (id: string) => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, vendor:profiles!deliveries_vendor_id_fkey(*)')
    .eq('id', id)
    .maybeSingle();
  return { data: data as (Delivery & { vendor: Profile }) | null, error };
};

export const getDeliveryItems = async (deliveryId: string) => {
  const { data, error } = await supabase
    .from('delivery_location_items')
    .select(`
      *,
      location:locations!delivery_location_items_location_id_fkey(latitude, longitude)
    `)
    .eq('delivery_id', deliveryId)
    .order('route_number');
  // Flatten lat/lng from joined location onto each item
  const flattened = (data ?? []).map((item) => {
    const { location, ...rest } = item as typeof item & { location?: { latitude?: number; longitude?: number } | null };
    return { ...rest, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null };
  });
  return { data: flattened as unknown as DeliveryLocationItem[], error };
};

export const getVendorDeliveries = async (vendorId: string) => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: (data as Delivery[]) ?? [], error };
};

export const getAllDeliveries = async (limit = 100) => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, vendor:profiles!deliveries_vendor_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: (data as (Delivery & { vendor: Profile })[]) ?? [], error };
};

export const getPendingDeliveries = async () => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, vendor:profiles!deliveries_vendor_id_fkey(*)')
    .in('status', ['submitted_to_admin', 'resubmitted_to_admin'])
    .order('submitted_at', { ascending: true });
  return { data: (data as (Delivery & { vendor: Profile })[]) ?? [], error };
};

export const updateDelivery = async (id: string, updates: Partial<Delivery>) => {
  const { data: current, error: fetchError } = await supabase
    .from('deliveries')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };

  if (
    current?.status === 'approved' ||
    current?.status === 'finalised'
  ) {
    const error = new Error('Approved or finalised deliveries cannot be modified.');
    return { data: null, error };
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  return { data: data as Delivery | null, error };
};

export const updateDeliveryItem = async (id: string, updates: Partial<DeliveryLocationItem>) => {
  const { data: item, error: fetchError } = await supabase
    .from('delivery_location_items')
    .select(`
      id,
      delivery:deliveries!delivery_location_items_delivery_id_fkey(status)
    `)
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };

  const itemData = item as {
    delivery?: { status?: string } | { status?: string }[] | null;
  };

  const deliveryStatus = Array.isArray(itemData.delivery)
    ? itemData.delivery[0]?.status
    : itemData.delivery?.status;

  if (deliveryStatus === 'approved' || deliveryStatus === 'finalised') {
    const error = new Error('Items from approved or finalised deliveries cannot be modified.');
    return { data: null, error };
  }

  const { data, error } = await supabase
    .from('delivery_location_items')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  return { data: data as DeliveryLocationItem | null, error };
};

// ============================================================
// REPORT DATA
// ============================================================
export const getReportData = async (filters: {
  start_date?: string;
  end_date?: string;
  year?: number;
  month?: number;
  vendor_id?: string;
  status?: string;
}) => {
  let query = supabase
    .from('delivery_location_items')
    .select(`
      *,
      delivery:deliveries!delivery_location_items_delivery_id_fkey(
        id, delivery_date, status, vendor_id, vendor_full_name,
        admin_full_name, approved_at, finalised_at,
        vendor:profiles!deliveries_vendor_id_fkey(full_name)
      )
    `);

  if (filters.start_date) {
    query = query.gte('delivery.delivery_date', filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte('delivery.delivery_date', filters.end_date);
  }
  if (filters.status) {
    query = query.eq('delivery.status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(2000);
  return { data: data ?? [], error };
};

// ============================================================
// APP SETTINGS
// ============================================================
export const getSettings = async () => {
  const { data, error } = await supabase.from('app_settings').select('*');
  return { data: (data as AppSetting[]) ?? [], error };
};

export const updateSetting = async (key: string, value: string) => {
  const { error } = await supabase.from('app_settings').update({ value }).eq('key', key);
  return { error };
};

// ============================================================
// AUDIT LOG
// ============================================================
export const addAuditLog = async (log: {
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}) => {
  await supabase.from('audit_logs').insert(log);
};

// ============================================================
// STORAGE — upload signature/pdf blob
// ============================================================
export const uploadFile = async (
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<string | null> => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
};
