
import { supabase } from './supabaseClient';
import { ServiceResult, Employee } from '../types';

export const hrService = {
  // --- EMPLOYEES ---
  async getEmployees(): Promise<ServiceResult<Employee[]>> {
    const { data, error } = await supabase.from('employees').select('*').order('full_name');
    if (error) return { data: [], error: error.message };
    
    const mapped = data.map((db: any) => ({
      id: db.id,
      fullName: db.full_name || `${db.first_name || ''} ${db.last_name || ''}`.trim(),
      firstName: db.first_name,
      lastName: db.last_name,
      birthDate: db.birth_date,
      identityNo: db.identity_no,
      address: db.address,
      insuranceNo: db.insurance_no,
      position: db.position || 'Personel',
      department: db.department,
      email: db.email,
      phone: db.phone,
      salary: Number(db.salary || 0), // Ensure salary is a number
      currency: db.currency || 'TRY',
      startDate: db.start_date,
      isActive: db.is_active === false ? false : true, // CRITICAL: null should be TRUE
      bankName: db.bank_name,
      branchName: db.branch_name,
      accountNo: db.account_no,
      iban: db.iban,
      hasWorkPermit: db.has_work_permit,
      workPermitStartDate: db.work_permit_start,
      workPermitEndDate: db.work_permit_end,
      permissions: db.permissions || []
    }));
    return { data: mapped as any, error: null };
  },

  async getEmployeeById(id: string): Promise<ServiceResult<Employee>> {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
    if (error) return { data: null, error: error.message };
    return {
      data: {
        id: data.id,
        fullName: data.full_name,
        firstName: data.first_name,
        lastName: data.last_name,
        birthDate: data.birth_date,
        identityNo: data.identity_no,
        position: data.position,
        department: data.department,
        email: data.email,
        phone: data.phone,
        salary: Number(data.salary || 0),
        currency: data.currency || 'TRY',
        startDate: data.start_date,
        isActive: data.is_active === false ? false : true,
        bankName: data.bank_name,
        branchName: data.branch_name,
        accountNo: data.account_no,
        iban: data.iban,
        address: data.address,
        insuranceNo: data.insurance_no,
        hasWorkPermit: data.has_work_permit,
        workPermitStartDate: data.work_permit_start,
        workPermitEndDate: data.work_permit_end
      } as Employee,
      error: null
    };
  },

  async addEmployee(emp: Partial<Employee>): Promise<ServiceResult<void>> {
    const dbObj = {
      full_name: emp.fullName,
      first_name: emp.firstName,
      last_name: emp.lastName,
      birth_date: emp.birthDate || null,
      identity_no: emp.identityNo,
      email: emp.email,
      phone: emp.phone,
      position: emp.position,
      department: emp.department,
      salary: emp.salary,
      currency: emp.currency,
      start_date: emp.startDate || null,
      insurance_no: emp.insuranceNo,
      is_active: emp.isActive ?? true,
      has_work_permit: emp.hasWorkPermit,
      work_permit_start: emp.workPermitStartDate || null,
      work_permit_end: emp.workPermitEndDate || null,
      bank_name: emp.bankName,
      branch_name: emp.branchName,
      account_no: emp.accountNo,
      iban: emp.iban,
      address: emp.address
    };
    const { error } = await supabase.from('employees').insert(dbObj);
    return { data: null, error: error?.message || null };
  },

  async updateEmployee(id: string, emp: Partial<Employee>): Promise<ServiceResult<void>> {
    const dbObj: any = {};
    if (emp.fullName !== undefined) dbObj.full_name = emp.fullName;
    if (emp.salary !== undefined) dbObj.salary = emp.salary;
    if (emp.isActive !== undefined) dbObj.is_active = emp.isActive;
    if (emp.position !== undefined) dbObj.position = emp.position;
    if (emp.currency !== undefined) dbObj.currency = emp.currency;
    if (emp.permissions !== undefined) dbObj.permissions = emp.permissions;

    const { error } = await supabase.from('employees').update(dbObj).eq('id', id);
    return { data: null, error: error?.message || null };
  },

  async deleteEmployee(id: string) {
    return await supabase.from('employees').delete().eq('id', id);
  },

  // --- PAYROLL & ADVANCES ---
  async getPayrolls(period: string) {
    const { data } = await supabase.from('payrolls').select('*').eq('period', period);
    const mapped = data?.map((p: any) => ({
      id: p.id,
      period: p.period,
      employeeId: p.employee_id,
      employeeName: p.employee_name,
      baseSalary: Number(p.base_salary || 0),
      bonus: Number(p.bonus || 0),
      deductions: Number(p.deductions || 0),
      advanceDeduction: Number(p.advance_deduction || 0),
      worked_days: p.worked_days,
      netSalary: Number(p.net_salary || 0),
      currency: p.currency,
      status: p.status
    }));
    return { data: mapped as any, error: null };
  },

  async getPayrollsByEmployee(id: string) {
    const { data } = await supabase.from('payrolls').select('*').eq('employee_id', id).order('period', { ascending: false });
    const mapped = data?.map((p: any) => ({
      id: p.id,
      period: p.period,
      employeeId: p.employee_id,
      employeeName: p.employee_name,
      baseSalary: Number(p.base_salary || 0),
      bonus: Number(p.bonus || 0),
      deductions: Number(p.deductions || 0),
      advanceDeduction: Number(p.advance_deduction || 0),
      worked_days: p.worked_days,
      netSalary: Number(p.net_salary || 0),
      currency: p.currency,
      status: p.status
    }));
    return { data: mapped as any, error: null };
  },

  async getAllPayrolls() {
    const { data } = await supabase.from('payrolls').select('*');
    const mapped = data?.map((p: any) => ({
      id: p.id,
      period: p.period,
      employeeId: p.employee_id,
      employeeName: p.employee_name,
      baseSalary: Number(p.base_salary || 0),
      bonus: Number(p.bonus || 0),
      deductions: Number(p.deductions || 0),
      advanceDeduction: Number(p.advance_deduction || 0),
      worked_days: p.worked_days,
      netSalary: Number(p.net_salary || 0),
      currency: p.currency,
      status: p.status
    }));
    return { data: mapped as any, error: null };
  },

  async createPayroll(p: any) {
    const { data: existing } = await supabase.from('payrolls').select('id').eq('period', p.period).eq('employee_id', p.employeeId).maybeSingle();
    const dbObj = {
      period: p.period,
      employee_id: p.employeeId,
      employee_name: p.employeeName,
      base_salary: p.baseSalary,
      bonus: p.bonus,
      deductions: p.deductions,
      advance_deduction: p.advanceDeduction || 0,
      worked_days: p.workedDays || 30,
      net_salary: p.netSalary,
      currency: p.currency,
      status: p.status
    };
    const { error } = existing
      ? await supabase.from('payrolls').update(dbObj).eq('id', existing.id)
      : await supabase.from('payrolls').insert(dbObj);
    return { data: null, error: error?.message || null };
  },

  async deletePayroll(id: string) {
    const { error } = await supabase.from('payrolls').delete().eq('id', id);
    return { data: null, error: error?.message || null };
  },

  async createBulkPayrolls(list: any[]) {
    const dbObjs = list.map(p => ({
      period: p.period,
      employee_id: p.employeeId,
      employee_name: p.employeeName,
      base_salary: p.baseSalary,
      bonus: p.bonus,
      deductions: p.deductions,
      advance_deduction: p.advanceDeduction || 0,
      worked_days: p.workedDays || 30,
      net_salary: p.netSalary,
      currency: p.currency,
      status: p.status
    }));
    const { error } = await supabase.from('payrolls').upsert(dbObjs, { onConflict: 'period, employee_id' });
    return { data: null, error: error?.message || null };
  },

  async getAdvances() {
    const { data } = await supabase.from('advances').select('*').order('date', { ascending: false });
    return {
      data: data?.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        employeeName: a.employee_name,
        amount: Number(a.amount || 0),
        currency: a.currency,
        date: a.date,
        description: a.description,
        status: a.status
      })),
      error: null
    };
  },

  async getEmployeeAdvances(employeeId: string) {
    // 1. Get all advances taken by this employee
    const { data: advancesData } = await supabase
      .from('advances')
      .select('amount')
      .eq('employee_id', employeeId)
      .neq('status', 'Reddedildi');
    
    const totalTaken = advancesData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;

    // 2. Get all amounts already deducted in historical payrolls
    const { data: payrollsData } = await supabase
      .from('payrolls')
      .select('advance_deduction')
      .eq('employee_id', employeeId);
    
    const totalDeducted = payrollsData?.reduce((acc, curr) => acc + (Number(curr.advance_deduction) || 0), 0) || 0;

    // 3. Return the net balance (Remaining Debt)
    return { data: Math.max(0, totalTaken - totalDeducted), error: null };
  },

  async createAdvance(a: any) {
    const { data, error } = await supabase.from('advances').insert({
      employee_id: a.employeeId,
      employee_name: a.employeeName,
      amount: a.amount,
      currency: a.currency,
      date: a.date,
      description: a.description,
      status: a.status
    }).select().single();
    return { data, error: error?.message || null };
  },

  async updateAdvance(id: string, a: any) {
    const { error } = await supabase.from('advances').update({
      employee_id: a.employeeId,
      employee_name: a.employeeName,
      amount: a.amount,
      currency: a.currency,
      date: a.date,
      description: a.description,
      status: a.status
    }).eq('id', id);
    return { data: null, error: error?.message || null };
  },

  async deleteAdvance(id: string) {
    await supabase.from('advances').delete().eq('id', id);
    return { data: null, error: null };
  },

  async getInsurancePayments() {
    const { data } = await supabase.from('insurance_payments').select('*').order('period', { ascending: false });
    return {
      data: data?.map((i: any) => ({
        id: i.id,
        period: i.period,
        amount: Number(i.amount || 0),
        currency: i.currency,
        type: i.type,
        paymentDate: i.payment_date,
        description: i.description,
        status: i.status ? String(i.status) : 'Bekliyor',
        coveredEmployees: i.covered_employees
      })),
      error: null
    };
  },

  async createInsurancePayment(i: any) {
    await supabase.from('insurance_payments').insert({
      period: i.period,
      amount: i.amount,
      currency: i.currency,
      type: i.type,
      payment_date: i.paymentDate,
      description: i.description,
      status: i.status,
      covered_employees: i.coveredEmployees
    });
    return { data: null, error: null };
  },

  async updateInsurancePayment(id: string, i: any) {
    const { error } = await supabase.from('insurance_payments')
      .update({
        period: i.period,
        amount: i.amount,
        currency: i.currency,
        type: i.type,
        payment_date: i.paymentDate,
        description: i.description,
        status: i.status,
        covered_employees: i.coveredEmployees
      })
      .eq('id', id);

    return { data: null, error: error ? error.message : null };
  },

  async deleteInsurancePayment(id: string) {
    const { error } = await supabase.from('insurance_payments').delete().eq('id', id);
    return { data: null, error: error ? error.message : null };
  },

  async grantEmployeeAccess(arg1: any, arg2?: any): Promise<ServiceResult<any>> {
    const payload: any = (typeof arg1 === 'string')
      ? { employee_id: arg1, ...(arg2 || {}) }
      : { ...(arg1 || {}) };

    if (!payload.employee_id && payload.employeeId) payload.employee_id = payload.employeeId;
    if (!payload.redirect_to && payload.redirectTo) payload.redirect_to = payload.redirectTo;

    if (!payload.employee_id) {
      return { data: null, error: 'employee_id is required' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('grant-access', { body: payload });
      if (error) {
        let msg = (error as any).message || String(error);
        return { data: null, error: msg };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e?.message || String(e) };
    }
  },
};
