import apiClient from './client';

// === Types ===

export interface ShippingAddress {
  id: string;
  userId: string;
  label: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressData {
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export type UpdateAddressData = Partial<CreateAddressData>;

export interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface UpdateTrackingData {
  trackingCode: string;
  carrier: string;
}

// === API Calls ===

export async function createAddress(data: CreateAddressData): Promise<ShippingAddress> {
  const response = await apiClient.post('/shipping/addresses', data);
  return response.data.data;
}

export async function listAddresses(): Promise<ShippingAddress[]> {
  const response = await apiClient.get('/shipping/addresses');
  return response.data.data;
}

export async function getAddress(id: string): Promise<ShippingAddress> {
  const response = await apiClient.get(`/shipping/addresses/${id}`);
  return response.data.data;
}

export async function updateAddress(
  id: string,
  data: UpdateAddressData,
): Promise<ShippingAddress> {
  const response = await apiClient.put(`/shipping/addresses/${id}`, data);
  return response.data.data;
}

export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/shipping/addresses/${id}`);
}

export async function setDefaultAddress(id: string): Promise<ShippingAddress> {
  const response = await apiClient.patch(`/shipping/addresses/${id}/default`);
  return response.data.data;
}

export async function listShippingMethods(): Promise<ShippingMethod[]> {
  const response = await apiClient.get('/shipping/methods');
  return response.data.data;
}

export async function updateTracking(
  orderItemId: string,
  data: UpdateTrackingData,
): Promise<unknown> {
  const response = await apiClient.patch(`/shipping/tracking/${orderItemId}`, data);
  return response.data.data;
}
