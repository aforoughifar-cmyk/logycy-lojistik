
import { supabase } from './supabaseClient';
import { ServiceResult } from '../types';

export const authService = {
  async signIn(email: string, password: string): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: error.message };
    return { data: data.user, error: null };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async updateUserPassword(p: string): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.updateUser({ password: p });
    return error ? { data: null, error: error.message } : { data: data.user, error: null };
  },

  async updateUserProfile(a: any): Promise<ServiceResult<any>> {
    const { data, error } = await supabase.auth.updateUser({ data: a.data });
    return error ? { data: null, error: error.message } : { data: data.user, error: null };
  }
};
