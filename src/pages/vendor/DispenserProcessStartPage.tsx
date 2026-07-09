import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isAfter } from 'date-fns';
import { Droplets, FlaskConical, Lock, PlayCircle, RefreshCw } from 'lucide-react';
import DeliveryMap from '@/pages/vendor/DeliveryMap';
import type { Dispenser, DispenserCycle, DispenserProcessType } from '@/types/types';

type Props = {
  processType: DispenserProcessType;
};

const DispenserProcessStartPage: React.FC<Props> = ({ processType }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [dispensers, setDispensers] = useState<Dispenser[]>([]);
  const [openCycle, setOpenCycle] = useState<DispenserCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const processLabel = processType === 'sanitisation' ? 'Sanitisation' : 'Descaling';
  const lockLabel = processType === 'sanitisation' ? '6 months' : '12 months';
  const ProcessIcon = processType === 'sanitisation' ? Droplets : FlaskConical;

  const load = async () => {
    if (!profile) return;

    setLoading(true);

    const { data: dispenserData } = await supabase
      .from('dispensers')
      .select('*, location:locations(id, office_name, building_number, route_number, latitude, longitude)')
      .eq('is_active', true)
      .order('serial_number');

    const { data: cycleData } = await supabase
      .from('dispenser_cycles')
      .select('*')
      .eq('vendor_id', profile.id)
      .eq('process_type', processType)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    setDispensers((dispenserData as Dispenser[]) ?? []);
    setOpenCycle((cycleData as DispenserCycle[])?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile, processType]);

  const today = new Date();

  const availableDispensers = useMemo(() => {
    return dispensers.filter((d) => {
      const nextDue =
        processType === 'descaling'
          ? d.descaling_next_due_date
          : d.sanitisation_next_due_date;

      return !nextDue || !isAfter(new Date(nextDue), today);
    });
  }, [dispensers, processType]);

  const lockedDispensers = useMemo(() => {
    return dispensers.filter((d) => {
      const nextDue =
        processType === 'descaling'
          ? d.descaling_next_due_date
          : d.sanitisation_next_due_date;

      return !!nextDue && isAfter(new Date(nextDue), today);
    });
  }, [dispensers, processType]);

  const handleStart = async () => {
    if (!profile) return;

    if (openCycle) {
      navigate(`/vendor/${processType}/workflow/${openCycle.id}`);
      return;
    }

    if (availableDispensers.length === 0) {
      toast.error(`No dispensers are currently due for ${processLabel}`);
      return;
    }

    setStarting(true);

    try {
      const { data: cycle, error: cycleError } = await supabase
        .from('dispenser_cycles')
        .insert({
          process_type: processType,
          vendor_id: profile.id,
          vendor_full_name: profile.full_name || profile.email,
          status: 'open',
        })
        .select()
        .maybeSingle();

      if (cycleError || !cycle) throw cycleError || new Error('Cycle was not created');

      const items = availableDispensers.map((d) => {
        const loc = d.location as any;

        return {
          cycle_id: cycle.id,
          dispenser_id: d.id,
          serial_number: d.serial_number,
          model: d.model,
          location_name: loc?.office_name || null,
          status: 'pending',
          next_due_date: null,
        };
      });

      const { error: itemsError } = await supabase
        .from('dispenser_cycle_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success(`${processLabel} process started`);
      navigate(`/vendor/${processType}/workflow/${cycle.id}`);
    } catch (err: any) {
      toast.error('Failed to start process', {
        description: err?.message || 'Unknown error',
      });
    } finally {
      setStarting(false);
    }
  };

  const mapItems = dispensers.map((d) => {
    const loc = d.location as any;
    const nextDue =
      processType === 'descaling'
        ? d.descaling_next_due_date
        : d.sanitisation_next_due_date;

    const locked = !!nextDue && isAfter(new Date(nextDue), today);

    return {
      id: d.id,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      route_number: loc?.route_number,
      office_name: loc?.office_name,
      location_name: loc?.office_name,
      status: locked ? 'no_issue' : 'pending',
    };
  });

  return (
    <VendorLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <ProcessIcon className="h-6 w-6 text-primary" />
              {processLabel}
            </h1>
            <p className="text-muted-foreground">
              Review due dispensers and start the process only when ready · Lock period: <strong>{lockLabel}</strong>
            </p>
          </div>

          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Available / Due</p>
              <p className="text-2xl font-bold">{availableDispensers.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Locked</p>
              <p className="text-2xl font-bold">{lockedDispensers.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Open Process</p>
              <p className="text-2xl font-bold">{openCycle ? 'Yes' : 'No'}</p>
            </CardContent>
          </Card>
        </div>

        <DeliveryMap items={mapItems} />

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Dispensers due for {processLabel}</h2>
                <p className="text-sm text-muted-foreground">
                  A cycle will be created only after pressing Start Process.
                </p>
              </div>

              <Button onClick={handleStart} disabled={starting || loading || (!openCycle && availableDispensers.length === 0)}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {openCycle ? `Continue ${processLabel}` : starting ? 'Starting...' : `Start ${processLabel} Process`}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading dispensers...</p>
            ) : availableDispensers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No dispensers are due for {processLabel}.
              </div>
            ) : (
              <div className="space-y-2">
                {availableDispensers.map((d) => {
                  const loc = d.location as any;

                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-semibold">{d.serial_number || 'S/N —'} · {d.model || '—'}</p>
                        <p className="text-sm text-muted-foreground">{loc?.office_name || 'No location'}</p>
                      </div>
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Due
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {lockedDispensers.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                Locked dispensers
              </h2>

              <div className="space-y-2">
                {lockedDispensers.map((d) => {
                  const loc = d.location as any;
                  const nextDue =
                    processType === 'descaling'
                      ? d.descaling_next_due_date
                      : d.sanitisation_next_due_date;

                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                      <div>
                        <p className="font-semibold">{d.serial_number || 'S/N —'} · {d.model || '—'}</p>
                        <p className="text-sm text-muted-foreground">{loc?.office_name || 'No location'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Next due: {nextDue ? format(new Date(nextDue), 'dd MMM yyyy') : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </VendorLayout>
  );
};

export default DispenserProcessStartPage;