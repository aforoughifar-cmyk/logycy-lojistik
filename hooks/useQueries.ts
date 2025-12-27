
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseService } from '../services/supabaseService';
import { Shipment, ShipmentStatus } from '../types';

// --- SHIPMENTS HOOKS ---

export const useShipments = (page: number, limit: number, search: string) => {
  return useQuery({
    queryKey: ['shipments', page, limit, search],
    queryFn: async () => {
      const { data, error } = await supabaseService.getShipments({ page, limit, search });
      if (error) throw new Error(error);
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
};

export const useCreateShipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shipment: Partial<Shipment>) => {
      const { data, error } = await supabaseService.createShipment(shipment);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

// FIX: Added missing useUpdateShipment hook to handle shipment updates
export const useUpdateShipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Shipment> }) => {
      const { data, error } = await supabaseService.updateShipmentDetails(id, updates);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useDeleteShipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseService.deleteShipment(id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

// --- FINANCE & PAYROLL HOOKS (CRITICAL FOR SYNC) ---

export const useFinanceItems = () => {
  return useQuery({
    queryKey: ['finance'],
    queryFn: async () => {
      const { data, error } = await supabaseService.getAllFinanceItems();
      if (error) throw new Error(error);
      return data;
    },
    refetchOnWindowFocus: true
  });
};

export const usePayrolls = (period: string) => {
  return useQuery({
    queryKey: ['payrolls', period],
    queryFn: async () => {
      const { data, error } = await supabaseService.getPayrolls(period);
      if (error) throw new Error(error);
      return data;
    }
  });
};

export const useDeletePayroll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseService.deletePayroll(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] }); // Force finance sync
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseService.deleteExpense(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] }); // Force finance sync
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });
};

export const useExpenses = () => {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabaseService.getExpenses();
      if (error) throw new Error(error);
      return data;
    }
  });
};

// --- OTHER DATA ---

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data, error } = await supabaseService.getDashboardStats();
      if (error) throw new Error(error);
      return data;
    }
  });
};

export const useTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabaseService.getTasks();
      if (error) throw new Error(error);
      return data;
    }
  });
};

export const useEmployees = () => {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabaseService.getEmployees();
      if (error) throw new Error(error);
      return data;
    }
  });
};
