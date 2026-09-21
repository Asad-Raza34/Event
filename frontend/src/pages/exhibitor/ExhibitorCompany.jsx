import { useRef, useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { COMPANY_CATEGORIES } from '../../lib/constants';
import { formatDate, initials, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, Select, StarRating, Tabs, Textarea } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';

const DOCUMENT_TYPES = ['business_license', 'tax_certificate', 'insurance', 'identity', 'other'];

const ExhibitorCompany = () => {
  const toast = useToast();
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const [tab, setTab] = useState('profile');
  const [uploading, setUploading] = useState('');
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [busy, setBusy] = useState(false);
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const documentRef = useRef(null);

  const profile = workspace.data?.profile;

  const profileForm = useForm({
    companyName: '',
    tagline: '',
    description: '',
    website: '',
    foundedYear: '',
    employeeCount: '',
    categories: [],
    contactEmail: '',
    contactPhone: '',
    contactCity: '',
    contactCountry: '',
  });
  const staffForm = useForm({ name: '', role: 'Representative', email: '', phone: '' });
  const [documentMeta, setDocumentMeta] = useState({ title: '', type: 'business_license' });

  // Hydrate the form once the profile arrives.
  if (profile && !profileForm.values.companyName) {
    profileForm.setValues({
      companyName: profile.companyName || '',
      tagline: profile.tagline || '',
      description: profile.description || '',
      website: profile.website || '',
      foundedYear: profile.foundedYear || '',
      employeeCount: profile.employeeCount || '',
      categories: profile.categories || [],
      contactEmail: profile.contact?.email || '',
      contactPhone: profile.contact?.phone || '',
      contactCity: profile.contact?.city || '',
      contactCountry: profile.contact?.country || '',
    });
  }

  const saveProfile = async () => {
    const result = await profileForm.submit((values) =>
      api.exhibitors.updateProfile({
        companyName: values.companyName,
        tagline: values.tagline,
        description: values.description,
        website: values.website,
        foundedYear: values.foundedYear ? Number(values.foundedYear) : undefined,
        employeeCount: values.employeeCount,
        categories: values.categories,
        contact: {
          email: values.contactEmail,
          phone: values.contactPhone,
          city: values.contactCity,
          country: values.contactCountry,
        },
      }),
    );
    if (result.ok) {
      toast.success('Company profile saved');
      workspace.reload();
    }
  };

  const uploadAsset = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      if (kind === 'logo') await api.exhibitors.uploadLogo(file);
      else await api.exhibitors.uploadBanner(file);
      toast.success(`${titleCase(kind)} updated`);
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'The upload failed');
    } finally {
      setUploading('');
    }
  };

  const uploadDocument = async (file) => {
    if (!file) return;
    setUploading('document');
    try {
      await api.exhibitors.addDocument(file, documentMeta);
      toast.success('Document uploaded for verification');
      setDocumentMeta({ title: '', type: 'business_license' });
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'The document could not be uploaded');
    } finally {
      setUploading('');
      if (documentRef.current) documentRef.current.value = '';
    }
  };

  const removeDocument = async () => {
    setBusy(true);
    try {
      await api.exhibitors.removeDocument(pendingRemoval._id);
      toast.success('Document removed');
      setPendingRemoval(null);
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not remove the document');
    } finally {
      setBusy(false);
    }
  };

  const saveStaff = async () => {
    const result = await staffForm.submit((values) =>
      editingStaff ? api.exhibitors.updateStaff(editingStaff._id, values) : api.exhibitors.addStaff(values),
    );
    if (result.ok) {
      toast.success(editingStaff ? 'Staff member updated' : 'Staff member added');
      setStaffOpen(false);
      setEditingStaff(null);
      staffForm.reset({ name: '', role: 'Representative', email: '', phone: '' });
      workspace.reload();
    }
  };

  const removeStaff = async (member) => {
    try {
      await api.exhibitors.removeStaff(member._id);
      toast.success('Staff member removed');
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not remove the staff member');
    }
  };

  if (workspace.loading && !profile) return <LoadingState rows={3} />;
  if (workspace.error) {
    return (
      <div>
        <PageHeader title="Company profile" />
        <ErrorState error={workspace.error} onRetry={workspace.reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Company profile"
        subtitle="This is what attendees and organizers see across the directory, floor plan and chat."
        icon="building"
        actions={
          <>
            <Button variant="secondary" icon="upload" onClick={() => logoRef.current?.click()} loading={uploading === 'logo'}>
              Upload logo
            </Button>
            <Button variant="secondary" icon="upload" onClick={() => bannerRef.current?.click()} loading={uploading === 'banner'}>
              Upload banner
            </Button>
            <Button icon="check" loading={profileForm.submitting} onClick={saveProfile}>
              Save profile
            </Button>
          </>
        }
      />

      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadAsset('logo', event.target.files?.[0])} />
      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadAsset('banner', event.target.files?.[0])} />

      <Card className="overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500">
          {profile?.banner && <img src={mediaUrl(profile.banner)} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-wrap items-start gap-5 px-6 pb-6">
          <div className="-mt-10">
            <Avatar src={profile?.logo} name={profile?.companyName} size="xl" />
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{profile?.companyName}</h2>
              <Badge status={profile?.verificationStatus || 'pending'} dot />
              {profile?.isFeatured && <Badge tone="info">Featured</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profile?.tagline || 'Add a tagline to stand out in the directory.'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <StarRating value={profile?.avgRating || 0} count={profile?.reviewCount || 0} size="sm" />
              <span>{profile?.profileViews || 0} profile views</span>
              <span>{profile?.products?.length || 0} products</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'profile', label: 'Profile', icon: 'building' },
            { value: 'staff', label: 'Booth staff', icon: 'users2', count: profile?.staff?.length || 0 },
            { value: 'documents', label: 'Documents', icon: 'file', count: profile?.documents?.length || 0 },
          ]}
        />
      </div>

      <div className="mt-5">
        {tab === 'profile' && (
          <Card>
            <CardHeader title="Company details" subtitle="Keep this accurate — it drives your directory listing" icon="pencil" />
            <div className="card-pad grid gap-4 sm:grid-cols-2">
              <Field label="Company name" required error={profileForm.errors.companyName}>
                <Input name="companyName" value={profileForm.values.companyName} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Tagline">
                <Input name="tagline" value={profileForm.values.tagline} onChange={profileForm.handleChange} maxLength={200} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea name="description" rows={4} value={profileForm.values.description} onChange={profileForm.handleChange} maxLength={4000} />
              </Field>
              <Field label="Website">
                <Input name="website" value={profileForm.values.website} onChange={profileForm.handleChange} placeholder="https://company.com" />
              </Field>
              <Field label="Employees" hint="Free text — for example 51-200">
                <Input name="employeeCount" value={profileForm.values.employeeCount} onChange={profileForm.handleChange} placeholder="11-50" />
              </Field>
              <Field label="Founded year">
                <Input type="number" name="foundedYear" value={profileForm.values.foundedYear} onChange={profileForm.handleChange} min="1800" max="2100" />
              </Field>
              <Field label="Industries" hint="Hold ⌘/Ctrl to select up to 8" className="sm:col-span-2">
                <select
                  multiple
                  value={profileForm.values.categories}
                  onChange={(event) =>
                    profileForm.setValue('categories', Array.from(event.target.options).filter((option) => option.selected).map((option) => option.value))
                  }
                  className="input h-32"
                >
                  {COMPANY_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {titleCase(category)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact email">
                <Input type="email" name="contactEmail" value={profileForm.values.contactEmail} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Contact phone">
                <Input name="contactPhone" value={profileForm.values.contactPhone} onChange={profileForm.handleChange} />
              </Field>
              <Field label="City">
                <Input name="contactCity" value={profileForm.values.contactCity} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Country">
                <Input name="contactCountry" value={profileForm.values.contactCountry} onChange={profileForm.handleChange} />
              </Field>
            </div>
          </Card>
        )}

        {tab === 'staff' && (
          <Card>
            <CardHeader
              title="Booth staff"
              subtitle="Who will be at your stand"
              icon="users2"
              action={
                <Button
                  size="xs"
                  icon="plus"
                  onClick={() => {
                    setEditingStaff(null);
                    staffForm.reset({ name: '', role: 'Representative', email: '', phone: '' });
                    setStaffOpen(true);
                  }}
                >
                  Add staff
                </Button>
              }
            />
            <div className="card-pad">
              {(profile?.staff || []).length === 0 ? (
                <EmptyState icon="users2" title="No staff added" message="Add the colleagues who will represent your company at the booth." className="border-0" />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {profile.staff.map((member) => (
                    <li key={member._id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {member.role}
                          {member.email ? ` · ${member.email}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon="pencil"
                          onClick={() => {
                            setEditingStaff(member);
                            staffForm.reset({ name: member.name, role: member.role || '', email: member.email || '', phone: member.phone || '' });
                            setStaffOpen(true);
                          }}
                          aria-label={`Edit ${member.name}`}
                        />
                        <Button size="xs" variant="ghost" icon="trash" onClick={() => removeStaff(member)} aria-label={`Remove ${member.name}`} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}

        {tab === 'documents' && (
          <Card>
            <CardHeader title="Verification documents" subtitle="Organizers review these to verify your company" icon="file" />
            <div className="card-pad space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Document title">
                  <Input value={documentMeta.title} onChange={(event) => setDocumentMeta({ ...documentMeta, title: event.target.value })} placeholder="Business licence 2026" />
                </Field>
                <Field label="Document type">
                  <Select
                    value={documentMeta.type}
                    onChange={(event) => setDocumentMeta({ ...documentMeta, type: event.target.value })}
                    options={DOCUMENT_TYPES.map((type) => ({ value: type, label: titleCase(type) }))}
                  />
                </Field>
                <div className="flex items-end">
                  <Button variant="secondary" icon="upload" className="w-full" loading={uploading === 'document'} onClick={() => documentRef.current?.click()}>
                    Upload document
                  </Button>
                  <input ref={documentRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={(event) => uploadDocument(event.target.files?.[0])} />
                </div>
              </div>

              {(profile?.documents || []).length === 0 ? (
                <EmptyState icon="file" title="No documents uploaded" message="Upload your business licence or tax certificate to speed up verification." className="border-0" />
              ) : (
                <ul className="space-y-2">
                  {profile.documents.map((document) => (
                    <li key={document._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <Icon name="file" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{document.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {titleCase(document.type)} · uploaded {formatDate(document.createdAt)}
                        </p>
                      </div>
                      <Badge status={document.status} />
                      <a href={mediaUrl(document.file)} target="_blank" rel="noreferrer" className="link text-xs">
                        Open
                      </a>
                      <Button size="xs" variant="ghost" icon="trash" onClick={() => setPendingRemoval(document)} aria-label="Remove document" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        title={editingStaff ? `Edit ${editingStaff.name}` : 'Add a staff member'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStaffOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={staffForm.submitting} onClick={saveStaff} disabled={!staffForm.values.name}>
              {editingStaff ? 'Save' : 'Add staff'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={staffForm.errors.name}>
            <Input name="name" value={staffForm.values.name} onChange={staffForm.handleChange} />
          </Field>
          <Field label="Role">
            <Input name="role" value={staffForm.values.role} onChange={staffForm.handleChange} />
          </Field>
          <Field label="Email">
            <Input type="email" name="email" value={staffForm.values.email} onChange={staffForm.handleChange} />
          </Field>
          <Field label="Phone">
            <Input name="phone" value={staffForm.values.phone} onChange={staffForm.handleChange} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        onConfirm={removeDocument}
        loading={busy}
        title="Remove this document?"
        confirmLabel="Remove"
        message={`"${pendingRemoval?.title}" will be deleted from your verification documents.`}
      />
    </div>
  );
};

export default ExhibitorCompany;
