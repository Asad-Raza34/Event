import { useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { COMPANY_CATEGORIES } from '../../lib/constants';
import { formatCurrency, mediaUrl, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea, Toggle } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const emptyProduct = {
  name: '',
  description: '',
  category: 'technology',
  kind: 'product',
  price: 0,
  currency: 'USD',
  tags: '',
  isFeatured: false,
  isActive: true,
};

const ExhibitorProducts = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.exhibitors.products(query), { limit: 12 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm(emptyProduct);

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    form.reset({
      name: product.name,
      description: product.description || '',
      category: product.category || 'other',
      kind: product.kind || 'product',
      price: product.price || 0,
      currency: product.currency || 'USD',
      tags: (product.tags || []).join(', '),
      isFeatured: Boolean(product.isFeatured),
      isActive: product.isActive !== false,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const result = await form.submit((values) => {
      const payload = {
        ...values,
        price: Number(values.price) || 0,
        tags: String(values.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      return editing ? api.exhibitors.updateProduct(editing._id, payload) : api.exhibitors.createProduct(payload);
    });
    if (result.ok) {
      toast.success(editing ? 'Product updated' : 'Product added to your catalogue');
      setModalOpen(false);
      list.reload();
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.exhibitors.removeProduct(pendingDelete._id);
      toast.success('Product removed');
      setPendingDelete(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The product could not be removed');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (product) => {
    try {
      await api.exhibitors.updateProduct(product._id, { isActive: !product.isActive });
      toast.success(product.isActive ? 'Product hidden from the directory' : 'Product published');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update the product');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            <img src={mediaUrl(row.image)} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Icon name="box" className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{truncate(row.description || '', 70)}</p>
          </div>
        </div>
      ),
    },
    { key: 'kind', label: 'Type', render: (row) => <span className="badge-neutral">{titleCase(row.kind)}</span> },
    { key: 'category', label: 'Category', render: (row) => <span className="text-xs">{titleCase(row.category)}</span> },
    { key: 'price', label: 'Price', render: (row) => formatCurrency(row.price, row.currency) },
    { key: 'stats', label: 'Views', render: (row) => <span className="text-sm">{row.stats?.views || 0}</span> },
    {
      key: 'flags',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.isActive === false ? 'neutral' : 'success'}>{row.isActive === false ? 'Hidden' : 'Published'}</Badge>
          {row.isFeatured && <Badge tone="info">Featured</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="pencil" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="xs" variant="ghost" onClick={() => toggleActive(row)}>
            {row.isActive === false ? 'Publish' : 'Hide'}
          </Button>
          <Button size="xs" variant="ghost" icon="trash" onClick={() => setPendingDelete(row)} aria-label={`Delete ${row.name}`} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products & services"
        subtitle="What you showcase at the booth — also searchable by attendees and the AI assistant."
        icon="box"
        actions={
          <Button icon="plus" onClick={openCreate}>
            Add product
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search your catalogue…"
        onReset={list.reset}
        filters={[
          {
            name: 'kind',
            label: 'Type',
            value: list.filters.kind || '',
            options: [
              { value: 'product', label: 'Product' },
              { value: 'service', label: 'Service' },
            ],
            onChange: (value) => list.setFilter('kind', value),
          },
          {
            name: 'category',
            label: 'Category',
            value: list.filters.category || '',
            options: COMPANY_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) })),
            onChange: (value) => list.setFilter('category', value),
          },
          {
            name: 'active',
            label: 'Visibility',
            value: list.filters.active || '',
            placeholder: 'Published',
            options: [{ value: 'all', label: 'Include hidden' }],
            onChange: (value) => list.setFilter('active', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={6} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <EmptyState
              icon="box"
              title="No products yet"
              message="Add the products and services you will showcase so attendees can find you."
              action={
                <Button icon="plus" onClick={openCreate}>
                  Add product
                </Button>
              }
            />
          }
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add a product or service'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={form.submitting} onClick={save} disabled={!form.values.name}>
              {editing ? 'Save product' : 'Add product'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={form.errors.name} className="sm:col-span-2">
            <Input name="name" value={form.values.name} onChange={form.handleChange} placeholder="Cobalt X1 industrial robot" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" rows={3} value={form.values.description} onChange={form.handleChange} />
          </Field>
          <Field label="Type">
            <Select
              name="kind"
              value={form.values.kind}
              onChange={form.handleChange}
              options={[
                { value: 'product', label: 'Product' },
                { value: 'service', label: 'Service' },
              ]}
            />
          </Field>
          <Field label="Category">
            <Select
              name="category"
              value={form.values.category}
              onChange={form.handleChange}
              options={COMPANY_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) }))}
            />
          </Field>
          <Field label="Price">
            <Input type="number" min="0" step="0.01" name="price" value={form.values.price} onChange={form.handleChange} />
          </Field>
          <Field label="Currency">
            <Select
              name="currency"
              value={form.values.currency}
              onChange={form.handleChange}
              options={['USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD'].map((currency) => ({ value: currency, label: currency }))}
            />
          </Field>
          <Field label="Tags" hint="Comma separated" className="sm:col-span-2">
            <Input name="tags" value={form.values.tags} onChange={form.handleChange} placeholder="automation, robotics, warehouse" />
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <Toggle
              label="Featured product"
              description="Featured products are highlighted on your booth and profile."
              checked={form.values.isFeatured}
              onChange={(value) => form.setValue('isFeatured', value)}
            />
            <Toggle
              label="Published"
              description="Hidden products stay in your catalogue but are not shown publicly."
              checked={form.values.isActive}
              onChange={(value) => form.setValue('isActive', value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={busy}
        title="Delete this product?"
        confirmLabel="Delete product"
        message={`"${pendingDelete?.name}" will be removed from your catalogue and from any booth featuring it.`}
      />
    </div>
  );
};

export default ExhibitorProducts;
