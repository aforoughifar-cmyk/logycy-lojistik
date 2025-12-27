import { supabase } from './supabaseClient';
import { ServiceResult, AuditLog } from '../types';

export const auditService = {
  /**
   * Logs an action to the database safely.
   * If the table doesn't exist, it catches the error to prevent app crash.
   */
  async log(action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER', entity: string, details: string, entityId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || 'system@logycy.com';

      const { error } = await supabase.from('audit_logs').insert({
        user_email: email,
        action,
        entity,
        entity_id: entityId,
        details
      });

      if (error) {
        console.warn('Audit log failed (non-critical):', error.message);
      }
    } catch (err) {
      console.warn('Audit log system error:', err);
    }
  },

  async getAuditLogs(): Promise<ServiceResult<AuditLog[]>> {
    try {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      return { data: data as any, error: error?.message || null };
    } catch (e: any) {
      return { data: [], error: e.message };
    }
  }
};