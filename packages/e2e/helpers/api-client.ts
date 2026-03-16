import axios, { type AxiosInstance } from 'axios';
import { API_URL } from './test-constants';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function authedApiClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
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
