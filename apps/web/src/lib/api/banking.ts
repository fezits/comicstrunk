import apiClient from './client';

// === Types ===

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  branchNumber: string;
  accountNumber: string;
  cpf: string;
  holderName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  bankName: string;
  branchNumber: string;
  accountNumber: string;
  cpf: string;
  holderName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  isPrimary?: boolean;
}

// === API Calls ===

export async function listBankAccounts(): Promise<BankAccount[]> {
  const response = await apiClient.get('/banking');
  return response.data.data;
}

export async function createBankAccount(data: CreateBankAccountInput): Promise<BankAccount> {
  const response = await apiClient.post('/banking', data);
  return response.data.data;
}

export async function updateBankAccount(
  id: string,
  data: Partial<CreateBankAccountInput>,
): Promise<BankAccount> {
  const response = await apiClient.put(`/banking/${id}`, data);
  return response.data.data;
}

export async function deleteBankAccount(id: string): Promise<void> {
  await apiClient.delete(`/banking/${id}`);
}

export async function setPrimaryBankAccount(id: string): Promise<BankAccount> {
  const response = await apiClient.patch(`/banking/${id}/primary`);
  return response.data.data;
}
