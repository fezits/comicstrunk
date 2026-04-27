import axios, { type AxiosInstance } from 'axios';
import { API_URL, BASE_URL } from './test-constants';

// Em produção a API exige header Origin (CORS) — incluir em todas as chamadas
// para que o mesmo client funcione em local e prod.
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  Origin: BASE_URL,
  'User-Agent': 'Mozilla/5.0 (Comicstrunk-E2E)',
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { ...COMMON_HEADERS },
});

export function authedApiClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    timeout: 10_000,
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  setCookieHeader?: string;
}

export async function loginViaApi(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post('/auth/login', { email, password });
  const { accessToken, user } = response.data.data;
  const setCookieHeader = response.headers['set-cookie']?.[0] ?? undefined;
  return { accessToken, user, setCookieHeader };
}

interface SignupInput {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

export async function signupViaApi(input: SignupInput): Promise<LoginResponse> {
  const response = await apiClient.post('/auth/signup', input);
  const { accessToken, user } = response.data.data;
  const setCookieHeader = response.headers['set-cookie']?.[0] ?? undefined;
  return { accessToken, user, setCookieHeader };
}
