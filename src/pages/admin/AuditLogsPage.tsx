import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuditLogs } from '@/services/api';
import { ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLogs(200).then(({ data }) => {
      setLogs(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit Logs</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent System Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading audit logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground">No audit logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Action</th>
                      <th className="py-3 pr-4">Entity</th>
                      <th className="py-3 pr-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b align-top">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td className="py-3 pr-4">
                          {log.user?.full_name || log.user?.email || log.user_id || '-'}
                        </td>
                        <td className="py-3 pr-4 capitalize">{log.user?.role || '-'}</td>
                        <td className="py-3 pr-4 font-medium">{log.action}</td>
                        <td className="py-3 pr-4">
                          {log.entity_type}
                          {log.entity_id ? ` / ${String(log.entity_id).slice(0, 8)}` : ''}
                        </td>
                        <td className="py-3 pr-4 max-w-md">
                          <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                            {log.details ? JSON.stringify(log.details, null, 2) : '-'}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AuditLogsPage;