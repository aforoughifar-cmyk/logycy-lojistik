
import { supabase } from './supabaseClient';
import { CalendarEvent, AppNotification } from '../types';

// Circuit breaker: If table is missing, stop querying it to prevent console 404 spam
let notesTableExists = true;

export const calendarService = {
  
  // 1. Get All Events (Aggregated)
  async getEvents(year: number, month: number): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    
    // Date Range Helpers
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0).toISOString(); // Last day of month

    try {
      // A. SHIPMENTS (ETA & ETD)
      const { data: shipments } = await supabase
        .from('shipments')
        .select('id, reference_no, eta, etd, vessel_name, status')
        .or(`eta.gte.${startDate},etd.gte.${startDate}`) 
        .neq('status', 'Teslim Edildi');

      if (shipments) {
        shipments.forEach((s: any) => {
          // ETA Event
          if (s.eta) {
            events.push({
              id: `ship-eta-${s.id}`,
              date: s.eta,
              title: `Varış: ${s.reference_no}`,
              description: `${s.vessel_name || 'Gemi'} limana varıyor.`,
              type: 'shipment',
              status: s.status,
              relatedId: s.id
            });
          }
          // ETD Event
          if (s.etd) {
            events.push({
              id: `ship-etd-${s.id}`,
              date: s.etd,
              title: `Kalkış: ${s.reference_no}`,
              description: `${s.vessel_name || 'Gemi'} limandan ayrılıyor.`,
              type: 'shipment',
              status: s.status,
              relatedId: s.id
            });
          }
        });
      }

      // B. CHECKS (Due Date)
      const { data: checks } = await supabase
        .from('checks')
        .select('id, reference_no, due_date, party_name, amount, currency, type, status')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .eq('status', 'pending');

      if (checks) {
        checks.forEach((c: any) => {
          events.push({
            id: `check-${c.id}`,
            date: c.due_date,
            title: c.type === 'in' ? `Çek Tahsilat: ${c.party_name}` : `Çek Ödeme: ${c.party_name}`,
            description: `${c.amount} ${c.currency} - ${c.reference_no}`,
            type: 'check',
            status: c.type === 'in' ? 'incoming' : 'outgoing',
            relatedId: c.id
          });
        });
      }

      // C. TASKS (Due Date)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .eq('is_completed', false);

      if (tasks) {
        tasks.forEach((t: any) => {
          events.push({
            id: `task-${t.id}`,
            date: t.due_date,
            title: `Görev: ${t.title}`,
            description: t.priority === 'high' ? 'ÖNEMLİ' : '',
            type: 'task',
            status: t.priority,
            relatedId: t.id
          });
        });
      }

      // D. MANUAL NOTES (From Supabase or LocalStorage fallback)
      let dbNotes = null;

      // Only try fetching if we think the table exists
      if (notesTableExists) {
        const response = await supabase
            .from('calendar_notes')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (response.error) {
            // Check for "Relation does not exist" (42P01) or 404 Not Found
            if (response.error.code === '42P01' || response.status === 404) {
                console.warn("Calendar Notes table missing. Switching to local storage mode to prevent errors.");
                notesTableExists = false;
            }
        } else {
            dbNotes = response.data;
        }
      }

      if (notesTableExists && dbNotes) {
        dbNotes.forEach((n: any) => {
          events.push({
            id: n.id,
            date: n.date,
            title: n.title,
            description: n.description,
            type: 'note',
            relatedId: n.id
          });
        });
      } 
      
      // Fallback to LocalStorage if table doesn't exist or we switched mode
      if (!notesTableExists) {
        const localNotes = localStorage.getItem('calendarNotes');
        if (localNotes) {
          const parsed: CalendarEvent[] = JSON.parse(localNotes);
          parsed.forEach(n => {
             // Simple string date compare
             if (n.date >= startDate.slice(0,10) && n.date <= endDate.slice(0,10)) {
               events.push(n);
             }
          });
        }
      }

    } catch (error) {
      console.error("Calendar aggregation error:", error);
    }

    return events;
  },

  // 2. Add Manual Note
  async addNote(note: { date: string, title: string, description?: string }) {
    // Try DB if table exists
    if (notesTableExists) {
        const { data, error } = await supabase
        .from('calendar_notes')
        .insert({
            date: note.date,
            title: note.title,
            description: note.description,
            type: 'note'
        })
        .select()
        .single();

        if (!error) return { data, error: null };
        
        // If error suggests missing table, flip flag
        if (error.code === '42P01' || error.message?.includes('404')) {
            notesTableExists = false;
        }
    }

    // Fallback LocalStorage
    const newId = 'local-' + Date.now();
    const newEvent: CalendarEvent = { id: newId, type: 'note', ...note };
    
    const existing = localStorage.getItem('calendarNotes');
    const list = existing ? JSON.parse(existing) : [];
    list.push(newEvent);
    localStorage.setItem('calendarNotes', JSON.stringify(list));
    return { data: newEvent, error: null };
  },

  // 3. Generate Notifications (Logic for "Today" and "Urgent")
  async getNotifications(): Promise<AppNotification[]> {
    const today = new Date().toISOString().slice(0, 10);
    const notifications: AppNotification[] = [];

    // A. Checks Due Today or Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: urgentChecks } = await supabase
      .from('checks')
      .select('*')
      .or(`due_date.eq.${today},due_date.eq.${tomorrowStr}`)
      .eq('status', 'pending');

    if (urgentChecks) {
      urgentChecks.forEach((c: any) => {
        notifications.push({
          id: `notif-check-${c.id}`,
          title: c.type === 'in' ? 'Tahsilat Günü!' : 'Ödeme Günü!',
          message: `${c.party_name} - ${c.amount} ${c.currency} (${c.type === 'in' ? 'Alınacak' : 'Verilecek'})`,
          type: c.type === 'in' ? 'success' : 'warning',
          date: c.due_date,
          isRead: false,
          link: `/checks/${c.id}`
        });
      });
    }

    // B. Today's Calendar Notes (Reuse getEvents to handle source logic)
    const todayEvents = await this.getEvents(new Date().getFullYear(), new Date().getMonth());
    todayEvents.filter(e => e.date === today && e.type === 'note').forEach(e => {
        notifications.push({
            id: `notif-note-${e.id}`,
            title: 'Hatırlatma',
            message: e.title,
            type: 'info',
            date: e.date,
            isRead: false
        });
    });

    return notifications;
  }
};
