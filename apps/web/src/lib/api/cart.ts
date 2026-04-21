import apiClient from './client';

// === Types ===

export interface CartCollectionItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  salePrice: number | null;
  condition: string;
  seller: {
    id: string;
    name: string;
  };
}

export interface CartItem {
  id: string;
  userId: string;
  collectionItemId: string;
  reservedAt: string;
  expiresAt: string;
  remainingMs?: number;
  collectionItem: CartCollectionItem;
}

export interface CartSummary {
  itemCount: number;
  totalAmount: number;
}

// === API Calls ===

export async function addToCart(collectionItemId: string): Promise<CartItem> {
  const response = await apiClient.post('/cart', { collectionItemId });
  return response.data.data;
}

export async function getCart(): Promise<CartItem[]> {
  const response = await apiClient.get('/cart');
  return response.data.data;
}

export async function getCartSummary(): Promise<CartSummary> {
  const response = await apiClient.get('/cart/summary');
  return response.data.data;
}

export async function removeFromCart(cartItemId: string): Promise<void> {
  await apiClient.delete(`/cart/${cartItemId}`);
}

export async function clearCart(): Promise<void> {
  await apiClient.delete('/cart');
}
