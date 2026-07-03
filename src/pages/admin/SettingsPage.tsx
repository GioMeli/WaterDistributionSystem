import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSettings, updateSetting } from '@/services/api';
import { toast } from 'sonner';
import { Settings, Save, Mail, Info, FileText, Building2 } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(({ data }) => {
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.key] = s.value || ''; });
      setSettings(map);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const keys = [
      'notification_email',
      'admin_email',
      'system_name',
      'company_name',
      'pdf_header_text',
      'approval_email_text',
      'rejection_email_text',
    ];
    for (const key of keys) {
      if (settings[key] !== undefined) {
        await updateSetting(key, settings[key]);
      }
    }
    setSaving(false);
    toast.success('Settings saved');
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : (
            <>
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-primary" />
                    Email Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Notification Email</Label>
                    <Input
                      type="email"
                      placeholder="notifications@example.com"
                      value={settings['notification_email'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, notification_email: e.target.value }))}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email address where delivery notifications and final PDFs are sent.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Email</Label>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      value={settings['admin_email'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, admin_email: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="h-4 w-4 text-primary" />
                    System Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>System Name</Label>
                    <Input
                      placeholder="Water Distribution Management System"
                      value={settings['system_name'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, system_name: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      placeholder="Water Distribution Company"
                      value={settings['company_name'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, company_name: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    PDF & Email Text
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>PDF Header Text</Label>
                    <Input
                      placeholder="Official Delivery Confirmation"
                      value={settings['pdf_header_text'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, pdf_header_text: e.target.value }))}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Approval Email Text</Label>
                    <Input
                      placeholder="Your delivery has been approved."
                      value={settings['approval_email_text'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, approval_email_text: e.target.value }))}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rejection Email Text</Label>
                    <Input
                      placeholder="Your delivery has been rejected. Please review the reason and resubmit."
                      value={settings['rejection_email_text'] || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, rejection_email_text: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button className="h-11 gap-2" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SettingsPage;
