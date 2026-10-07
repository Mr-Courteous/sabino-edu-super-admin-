export type PaymentStatus = 'pending' | 'completed' | 'grace_period' | 'expired';
export type Role = 'owner' | 'admin' | 'viewer';

export interface Pagination { page: number; limit: number; total: number; totalPages: number }

export interface Admin {
  id: number; email: string; name: string; role: Role; is_active: boolean;
  must_change_password: boolean; last_login_at: string | null; created_at: string;
}

export interface School {
  id: number; name: string; email: string | null; phone: string | null; school_type: string | null;
  country: string | null; payment_status: PaymentStatus; subscription_expiry: string | null;
  renewal_warning_sent_at: string | null; created_at: string; updated_at: string;
  /** When the school most recently became (or renewed as) completed. null if never recorded. */
  paid_at?: string | null; paid_estimated?: boolean | null;
}

export interface Transaction {
  id: number; tx_ref: string | null; flutterwave_ref: string | null; status: string;
  amount: string | null; currency: string | null; created_at: string;
}

export interface AuditEntry {
  id: number; admin_id: number | null; admin_email: string; admin_name: string | null; action: string;
  target_type: string | null; target_id: number | null; target_label: string | null;
  details: Record<string, any> | null; ip: string | null; created_at: string;
}

export interface StatusChange {
  id: number; old_status: string | null; new_status: string; old_expiry: string | null; new_expiry: string | null;
  changed_at: string; estimated: boolean;
}

export interface SchoolDetail extends School {
  status_history: StatusChange[];
  students_count: number; classes_count: number; transactions: Transaction[];
  activity: Pick<AuditEntry, 'id' | 'admin_email' | 'admin_name' | 'action' | 'details' | 'created_at'>[];
}

export interface Student {
  id: number; first_name: string; last_name: string; email: string | null;
  school_id: number; school_name: string | null; created_at: string;
}

export interface Stats {
  total: number; completed: number; grace_period: number; expired: number; pending: number;
  expiring_soon: number; new_30d: number; students: number; devices: number;
}

export interface AudienceInfo { id: string; label: string; devices: number | null; needs: 'version' | 'schoolId' | null }
export interface NotificationResult { recipients: number; sent: number; failed: number; unregistered: number }
export interface SentNotification {
  id: number; admin_email: string; admin_name: string | null; target_label: string | null; created_at: string;
  details: { audience: string; audienceLabel: string; title: string; body: string; recipients: number; sent: number; failed: number; unregistered: number; version?: string };
}
