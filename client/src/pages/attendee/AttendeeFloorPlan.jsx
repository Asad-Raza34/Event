import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { formatDate, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Select, Tabs } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const EXPO_TABS = [
  { value: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { value: 'past', label: 'Past', icon: 'clock' },
];

const AttendeeFloorPlan = () => {
  const { user } = useAuth();
  const registrations = useApi(() => api.registrations.mine({ limit: 50 }), []);
  const [activeExpoId, setActiveExpoId] = useState('');
  const [floorPlan, setFloorPlan] = useState(null);
  const [tab, setTab] = useState('upcoming');

  const eligible = (registrations.data || []).filter((item) => item.expo && item.status !== 'cancelled');
  const upcoming = eligible.filter((item) => new Date(item.expo.startDate) >= new Date(new Date().toDateString()));
  const past = eligible.filter((item) => new Date(item.expo.startDate) < new Date(new Date().toDateString()));
  const currentList = tab === 'upcoming' ? upcoming : past;

  if (registrations.loading && !registrations.data) return <LoadingState rows={3} />;
  if (registrations.error) {
    return (
      <div>
        <PageHeader title="Floor plans" />
        <ErrorState error={registrations.error} onRetry={registrations.reload} />
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div>
        <PageHeader title="Floor plans" subtitle="Navigate the venue with interactive maps for each expo you registered for." icon="map" />
        <EmptyState
          icon="map"
          title="No expos with floor plans"
          message="Register for an expo to access its floor plan, booth locations and navigation."
          action={
            <a href="/expos">
              <Button icon="compass">Browse expos</Button>
            </a>
          }
        />
      </div>
    );
  }

  const loadFloorPlan = async (expoId) => {
    try {
      const response = await api.expos.floorPlan(expoId);
      setFloorPlan(response.data);
    } catch (error) {
      setFloorPlan({ error: error?.message || 'Could not load floor plan' });
    }
  };

  if (currentList.length && !activeExpoId) {
    setActiveExpoId(currentList[0].expo._id);
  }

  return (
    <div>
      <PageHeader
        title="Interactive floor plans"
        subtitle="Explore booth layouts, stages and amenities for your registered expos."
        icon="map"
        actions={
          <>
            <Tabs active={tab} onChange={setTab} tabs={EXPO_TABS} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader title="Your expos" icon="ticket" />
          <div className="card-pad space-y-2">
            {currentList.map((registration) => (
              <button
                key={registration._id}
                type="button"
                className={`w-full text-left p-3 rounded-xl transition ${activeExpoId === registration.expo._id ? 'bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => {
                  setActiveExpoId(registration.expo._id);
                  loadFloorPlan(registration.expo._id);
                }}
              >
                <p className="font-medium truncate">{registration.expo?.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {registration.expo?.location?.venue} · {formatDate(registration.expo?.startDate)}
                </p>
              </button>
            ))}
            {currentList.length === 0 && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">No {tab} expos</p>
            )}
          </div>
        </Card>

        <Card className="min-h-[500px]">
          {!floorPlan ? (
            <div className="flex h-[500px] items-center justify-center text-slate-400">
              <Icon name="map" className="h-12 w-12" />
            </div>
          ) : floorPlan.error ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="text-center">
                <Icon name="alert" className="mx-auto h-10 w-10 text-rose-400" />
                <p className="mt-3 font-medium">Could not load floor plan</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{floorPlan.error}</p>
              </div>
            </div>
          ) : (
            <div className="relative h-[500px] overflow-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{floorPlan.expo?.title || 'Floor plan'}</h3>
                  <Badge tone="info">{floorPlan.booths?.length || 0} booths</Badge>
                </div>
                {floorPlan.svg ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800" dangerouslySetInnerHTML={{ __html: floorPlan.svg }} />
                ) : floorPlan.image ? (
                  <img src={floorPlan.image} alt="Floor plan" className="mx-auto max-h-[450px] rounded-xl" />
                ) : (
                  <div className="flex h-[400px] items-center justify-center text-slate-400">
                    <Icon name="map" className="h-12 w-12" />
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AttendeeFloorPlan;