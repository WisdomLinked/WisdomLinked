import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ArrowDown, ArrowUp, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import {
  createFeaturedExpert,
  deleteFeaturedExpert,
  getAdminFeaturedExperts,
  reorderFeaturedExpert,
  updateFeaturedExpert,
  type FeaturedExpertRecord,
  type FeaturedExpertType,
} from '../../api/api';
import { showErrorAlert, showSuccessAlert } from '../../actions/alertActions';
import { ExpertPhoto, expertInitials } from '../FeaturedExperts';
import { uploadProfilePhotoFile } from '../../utils/profileImageUpload';

type FormState = {
  name: string;
  title: string;
  organization: string;
  type: FeaturedExpertType;
  photoUrl: string;
};

const emptyForm: FormState = {
  name: '',
  title: '',
  organization: '',
  type: 'academic',
  photoUrl: '',
};

function validateForm(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (!form.title.trim()) errors.title = 'Title is required.';
  if (!form.organization.trim()) errors.organization = 'Organization is required.';
  if (form.type !== 'academic' && form.type !== 'industry') {
    errors.type = 'Type must be Academic or Industry.';
  }
  return errors;
}

export default function AdminExpertsManager() {
  const dispatch = useDispatch();
  const [experts, setExperts] = useState<FeaturedExpertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const rows = await getAdminFeaturedExperts();
    if (rows === false) {
      dispatch(showErrorAlert('Could not load featured experts.'));
      setExperts([]);
    } else {
      setExperts(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEdit = (expert: FeaturedExpertRecord) => {
    setEditingId(expert.id);
    setForm({
      name: expert.name,
      title: expert.title,
      organization: expert.organization,
      type: expert.type,
      photoUrl: expert.photoUrl || '',
    });
    setErrors({});
    setPhotoFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setPhotoFile(null);
  };

  const handleSave = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      let photoUrl = form.photoUrl.trim();
      if (photoFile) {
        photoUrl = await uploadProfilePhotoFile(photoFile);
      }
      const payload = {
        name: form.name.trim(),
        title: form.title.trim(),
        organization: form.organization.trim(),
        type: form.type,
        photoUrl,
      };
      const res = editingId
        ? await updateFeaturedExpert(editingId, payload)
        : await createFeaturedExpert(payload);
      if (!res) {
        dispatch(showErrorAlert(editingId ? 'Could not update expert.' : 'Could not add expert.'));
        return;
      }
      if (res.errors) {
        setErrors(res.errors);
        return;
      }
      if (res.error) {
        dispatch(showErrorAlert(res.error));
        return;
      }
      dispatch(showSuccessAlert(editingId ? 'Expert updated.' : 'Expert added.'));
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setPhotoFile(null);
      await load();
    } catch (err: any) {
      dispatch(showErrorAlert(err?.message || (editingId ? 'Could not update expert.' : 'Could not add expert.')));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (expert: FeaturedExpertRecord) => {
    if (!window.confirm(`Remove ${expert.name} from Featured Experts?`)) return;
    setBusy(true);
    const res = await deleteFeaturedExpert(expert.id);
    setBusy(false);
    if (!res || res.error) {
      dispatch(showErrorAlert(res && res.error ? res.error : 'Could not remove expert.'));
      return;
    }
    dispatch(showSuccessAlert('Expert removed.'));
    await load();
  };

  const handleReorder = async (expert: FeaturedExpertRecord, direction: 'up' | 'down') => {
    setBusy(true);
    const res = await reorderFeaturedExpert(expert.id, direction);
    setBusy(false);
    if (!res || res.error) {
      dispatch(showErrorAlert(res && res.error ? res.error : 'Could not reorder experts.'));
      return;
    }
    if (Array.isArray(res.experts) && res.experts.length) {
      setExperts(res.experts);
    } else {
      await load();
    }
    dispatch(showSuccessAlert('Expert order updated.'));
  };

  return (
    <div className="w-full h-full pt-10 overflow-y-auto text-wl-ink px-[18px]">
      <div className="w-full max-w-[1500px] mx-auto text-wl-ink">
        <div className="w-full bg-wl-card rounded-2xl border border-wl-line shadow-[0_10px_30px_rgba(35,76,106,0.08)] overflow-hidden">
          <div className="w-full flex flex-col lg:flex-row lg:justify-between lg:items-center p-6 gap-4 border-b border-wl-line bg-wl-pageAlt/40">
            <div>
              <h2 className="text-lg font-medium text-wl-ink">Featured experts</h2>
              <p className="mt-1 text-sm text-wl-muted">
                These cards appear on the public landing page, sorted in this order.
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-xl border border-wl-brand bg-wl-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:brightness-95"
            >
              <Plus size={20} />
              Add Expert
            </button>
          </div>

          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                <tr>
                  <th scope="col" className="px-6 py-4 w-20">Photo</th>
                  <th scope="col" className="px-6 py-4">Name</th>
                  <th scope="col" className="px-6 py-4">Title</th>
                  <th scope="col" className="px-6 py-4">Organization</th>
                  <th scope="col" className="px-6 py-4">Type</th>
                  <th scope="col" className="px-6 py-4 text-center">Order</th>
                  <th scope="col" className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-wl-muted">
                      Loading featured experts…
                    </td>
                  </tr>
                ) : experts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-wl-muted">
                      No featured experts yet. Add one to show them on the landing page.
                    </td>
                  </tr>
                ) : (
                  experts.map((expert, index) => (
                    <tr key={expert.id} className="border-b border-wl-line hover:bg-wl-pageAlt transition-colors">
                      <td className="px-6 py-4">
                        <ExpertPhoto name={expert.name} photoUrl={expert.photoUrl} size="sm" />
                        <span className="sr-only">{expertInitials(expert.name)}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-wl-ink">{expert.name}</td>
                      <td className="px-6 py-4 text-wl-ink">{expert.title}</td>
                      <td className="px-6 py-4 text-wl-ink">{expert.organization}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            expert.type === 'academic'
                              ? 'bg-wl-brandSoft text-wl-brand'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {expert.type === 'academic' ? 'Academic' : 'Industry'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={busy || index === 0}
                            onClick={() => handleReorder(expert, 'up')}
                            className="p-2 text-wl-brand hover:bg-wl-brandSoft rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            title="Move up"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || index === experts.length - 1}
                            onClick={() => handleReorder(expert, 'down')}
                            className="p-2 text-wl-brand hover:bg-wl-brandSoft rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            title="Move down"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEdit(expert)}
                            className="p-2 text-wl-brand hover:bg-wl-brandSoft rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRemove(expert)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-wl-card border border-wl-line rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-wl-brand">
                {editingId ? 'Edit expert' : 'Add expert'}
              </h3>
              <button type="button" onClick={closeModal} className="text-wl-muted hover:text-wl-ink" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                  placeholder="Dr. Bruce Wang"
                />
                {errors.name ? <p className="mt-1 text-sm text-red-500">{errors.name}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                  placeholder="Professor of Transportation Engineering"
                />
                {errors.title ? <p className="mt-1 text-sm text-red-500">{errors.title}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Organization</label>
                <input
                  type="text"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                  placeholder="UC Berkeley"
                />
                {errors.organization ? <p className="mt-1 text-sm text-red-500">{errors.organization}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as FeaturedExpertType })}
                  className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                >
                  <option value="academic">Academic</option>
                  <option value="industry">Industry</option>
                </select>
                {errors.type ? <p className="mt-1 text-sm text-red-500">{errors.type}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Photo URL</label>
                <input
                  type="text"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                  placeholder="https://… or uploaded filename"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-muted mb-2">Upload photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-wl-ink"
                />
                {photoFile ? (
                  <p className="mt-1 text-xs text-wl-muted">Selected: {photoFile.name}</p>
                ) : null}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 bg-wl-brand text-white rounded-lg hover:brightness-95 transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {editingId ? 'Save' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="px-4 py-2 border border-wl-line bg-wl-pageAlt text-wl-ink rounded-lg hover:bg-wl-page transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
