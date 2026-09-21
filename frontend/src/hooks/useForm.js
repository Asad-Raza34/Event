import { useCallback, useState } from 'react';

/**
 * Controlled form state with server-side validation feedback.
 *
 *   const form = useForm({ title: '' });
 *   <Input name="title" value={form.values.title} onChange={form.handleChange} />
 *   const result = await form.submit((values) => api.expos.create(values));
 *   if (result.ok) toast.success('Saved');
 */
export const useForm = (initialValues = {}, { onSuccess } = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (event) => {
      const { name, value, type, checked, multiple, options } = event.target;
      if (multiple) {
        setValue(name, Array.from(options).filter((option) => option.selected).map((option) => option.value));
        return;
      }
      setValue(name, type === 'checkbox' ? checked : value);
    },
    [setValue],
  );

  /** Replaces the whole form (used when opening an edit modal). */
  const reset = useCallback((next = initialValues) => {
    setValues(next);
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(
    async (handler) => {
      setSubmitting(true);
      clearErrors();
      try {
        const result = await handler(values);
        await onSuccess?.(result);
        return { ok: true, data: result };
      } catch (error) {
        setErrors(error?.fieldErrors || {});
        setFormError(error?.message || 'Something went wrong. Please try again.');
        return { ok: false, error };
      } finally {
        setSubmitting(false);
      }
    },
    [values, onSuccess, clearErrors],
  );

  return {
    values,
    setValues,
    setValue,
    handleChange,
    errors,
    setErrors,
    formError,
    setFormError,
    submitting,
    submit,
    reset,
    clearErrors,
  };
};

export default useForm;
