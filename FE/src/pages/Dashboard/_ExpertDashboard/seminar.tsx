import React, {
    useState,
    useEffect,
    ChangeEvent,
    KeyboardEvent,
  } from 'react';
  import { Check, ImagePlus } from 'lucide-react';
  import { useDispatch } from 'react-redux';
  import { useNavigate } from 'react-router-dom';
  import { useAppSelector } from '../../../store';
  import { createGroupChat, updateGroupChat } from '../../../api/api';
  import { SetLoadingStatus } from '../../../actions/appActions';
  import { showAlert } from '../../../actions/alertActions';
  import { updateMe } from '../../../actions/authActions';
  import { SERVICE_LABELS } from '../../../constants/serviceOptions';
  
  type StepId = 1 | 2 | 3;
  
  interface StepConfig {
    id: StepId;
    label: string;
    description: string;
  }
  
  interface SeminarFormData {
    title: string;
    description: string;
    majors: string[];
    services: string[];
    coverImage: File | null;
    tags: string[];
    date: string;
    startTime: string;
    endTime: string;
    timezone: string;
    isRecurring: boolean;
    price: number | '';
    isFree: boolean;
    maxAttendees: number | '';
    currency: string;
  }
  
  interface ExpertSeminarProps {
    selectedSeminar?: {
      groupId?: string;
      groupName?: string;
      description?: string;
      keywords?: string[];
      services?: string[];
      start?: string | Date;
      end?: string | Date;
      duration?: number;
      price?: number;
    };
    /** New expert shell: refresh user + switch tab without full page navigation */
    onAfterSeminarSave?: () => void;
    /** Return to seminar list without saving */
    onCancel?: () => void;
  }
  
  type MultiSelectField = 'majors' | 'services';
  type DropdownId = 'majors' | 'services' | null;
  
  type SeminarErrors = Partial<Record<keyof SeminarFormData, string>>;

  const keywordServiceToStrings = (arr: unknown[] | undefined): string[] => {
    if (!arr?.length) return [];
    return arr
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item?.value) return String(item.value);
        return '';
      })
      .filter(Boolean);
  };
  
  const initialFormData: SeminarFormData = {
    title: '',
    description: '',
    majors: [],
    services: [],
    coverImage: null,
    tags: [],
    date: '',
    startTime: '',
    endTime: '',
    timezone: '',
    isRecurring: false,
    price: '',
    isFree: false,
    maxAttendees: '',
    currency: 'USD',
  };
  
  const stepConfigs: StepConfig[] = [
    { id: 1, label: 'Add Details', description: 'Basic information about your seminar.' },
    { id: 2, label: 'Date & Time', description: 'Schedule when this seminar will run.' },
    { id: 3, label: 'Set Price', description: 'Configure pricing and capacity.' },
  ];
  
  const MAJORS_OPTIONS: string[] = [
    'Computer Science',
    'Business Administration',
    'Data Science',
    'Engineering',
    'Marketing',
    'Finance',
    'Design',
    'Healthcare',
  ];
  
  const TIMEZONE_OPTIONS: string[] = [
    'UTC',
    'US/Eastern',
    'US/Central',
    'US/Pacific',
    'IST',
    'GMT',
    'CET',
  ];
  
  const CURRENCY_OPTIONS: string[] = ['USD', 'EUR', 'GBP', 'INR'];
  
  const ExpertSeminar: React.FC<ExpertSeminarProps> = ({
    selectedSeminar,
    onAfterSeminarSave,
    onCancel,
  }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const {
      auth: { userDetails },
    } = useAppSelector((state) => state);
  
    const [currentStep, setCurrentStep] = useState<StepId>(1);
    const [formData, setFormData] = useState<SeminarFormData>(initialFormData);
    const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
    const [tagInput, setTagInput] = useState<string>('');
    const [errors, setErrors] = useState<SeminarErrors>({});
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
    useEffect(() => {
      if (userDetails?.status === 'review') {
        dispatch(showAlert("This feature isn't available while your profile is under review."));
      }
    }, [userDetails?.status, dispatch]);
  
    useEffect(() => {
      if (!selectedSeminar) return;

      const start = selectedSeminar.start ? new Date(selectedSeminar.start) : null;
      const end = selectedSeminar.end ? new Date(selectedSeminar.end) : null;

      const patched: Partial<SeminarFormData> = {
        title: selectedSeminar.groupName || '',
        description: selectedSeminar.description || '',
        majors: keywordServiceToStrings(selectedSeminar.keywords as unknown[] | undefined),
        services: keywordServiceToStrings(selectedSeminar.services as unknown[] | undefined),
        price: selectedSeminar.price ?? '',
      };
  
      if (start && end) {
        const dateStr = start.toISOString().slice(0, 10);
        const toTime = (d: Date) => d.toTimeString().slice(0, 5);
        patched.date = dateStr;
        patched.startTime = toTime(start);
        patched.endTime = toTime(end);
      }
  
      setFormData((prev) => ({
        ...prev,
        ...patched,
      }));
    }, [selectedSeminar]);
  
    const updateFormField = <K extends keyof SeminarFormData>(
      key: K,
      value: SeminarFormData[K]
    ) => {
      setFormData((prev) => ({
        ...prev,
        [key]: value,
      }));
      setErrors((prev) => ({
        ...prev,
        [key]: '',
      }));
    };
  
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      if (file && file.size > 5 * 1024 * 1024) {
        dispatch(showAlert('Cover image must be less than 5MB'));
        return;
      }
      updateFormField('coverImage', file);
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setCoverPreview(typeof reader.result === 'string' ? reader.result : null);
        };
        reader.readAsDataURL(file);
      } else {
        setCoverPreview(null);
      }
    };
  
    const handleMultiSelect = (field: MultiSelectField, value: string) => {
      const current = formData[field];
      const exists = current.includes(value);
      const nextValues = exists ? current.filter((v) => v !== value) : [...current, value];
      updateFormField(field, nextValues as SeminarFormData[MultiSelectField]);
    };
  
    const handleTagAdd = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const raw = tagInput.trim();
      if (!raw) return;
      if (formData.tags.length >= 5) {
        dispatch(showAlert('You can add up to 5 tags'));
        return;
      }
      if (formData.tags.includes(raw)) {
        setTagInput('');
        return;
      }
      updateFormField('tags', [...formData.tags, raw]);
      setTagInput('');
    };
  
    const removeTag = (tag: string) => {
      updateFormField(
        'tags',
        formData.tags.filter((t) => t !== tag)
      );
    };
  
    const validateStep = (stepId: StepId): boolean => {
      const newErrors: SeminarErrors = {};
  
      if (stepId === 1) {
        if (!formData.title.trim()) {
          newErrors.title = 'Title is required.';
        }
        if (!formData.description.trim()) {
          newErrors.description = 'Description is required.';
        }
      } else if (stepId === 2) {
        if (!formData.date) {
          newErrors.date = 'Date is required.';
        }
        if (!formData.startTime) {
          newErrors.startTime = 'Start time is required.';
        }
        if (!formData.endTime) {
          newErrors.endTime = 'End time is required.';
        }
        if (!formData.timezone) {
          newErrors.timezone = 'Timezone is required.';
        }
      } else if (stepId === 3) {
        if (!formData.isFree) {
          if (formData.price === '' || Number(formData.price) <= 0) {
            newErrors.price = 'Price must be greater than 0.';
          }
          if (!formData.currency) {
            newErrors.currency = 'Currency is required.';
          }
        }
      }
  
      setErrors((prev) => ({
        ...prev,
        ...newErrors,
      }));
  
      return Object.keys(newErrors).length === 0;
    };
  
    const handleNext = () => {
      if (!validateStep(currentStep)) return;
      if (currentStep === 3) return;
      setCurrentStep((prev) => (prev + 1) as StepId);
    };
  
    const handleBack = () => {
      if (currentStep === 1) return;
      setCurrentStep((prev) => (prev - 1) as StepId);
    };
  
    const computeStartEndAndDuration = (): {
      start: Date;
      end: Date;
      durationMinutes: number;
    } | null => {
      if (!formData.date || !formData.startTime || !formData.endTime) {
        return null;
      }
      const startIso = `${formData.date}T${formData.startTime}:00`;
      const endIso = `${formData.date}T${formData.endTime}:00`;
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        setErrors((prev) => ({
          ...prev,
          endTime: 'End time must be after start time.',
        }));
        return null;
      }
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      return { start, end, durationMinutes };
    };
  
    const handlePublish = async () => {
      if (!validateStep(3)) {
        setCurrentStep(3);
        return;
      }
  
      const timeInfo = computeStartEndAndDuration();
      if (!timeInfo) {
        setCurrentStep(2);
        return;
      }
  
      const { start, end, durationMinutes } = timeInfo;
  
      const payload = {
        name: formData.title.trim(),
        description: formData.description.trim(),
        services: formData.services,
        keywords: formData.majors,
        start,
        end,
        duration: durationMinutes,
        price: formData.isFree ? 0 : Number(formData.price || 0),
        type: 'seminar' as const,
        status: 'active' as const,
        createdBy: userDetails?._id,
        maxAttendees: formData.maxAttendees === '' ? undefined : Number(formData.maxAttendees),
        currency: formData.currency,
        isRecurring: formData.isRecurring,
        timezone: formData.timezone,
      };
  
      try {
        dispatch(SetLoadingStatus(true));
  
        if (selectedSeminar?.groupId) {
          const res = await updateGroupChat({
            groupId: selectedSeminar.groupId,
            ...payload,
          });
          if (res) {
            dispatch(showAlert('Seminar updated successfully'));
            await (dispatch as any)(updateMe());
            if (onAfterSeminarSave) {
              onAfterSeminarSave();
            } else {
              navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`);
            }
          }
        } else {
          const res = await createGroupChat(payload);
          if (res) {
            dispatch(showAlert('Seminar created successfully'));
            await (dispatch as any)(updateMe());
            if (onAfterSeminarSave) {
              onAfterSeminarSave();
            } else {
              navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`);
            }
          }
        }
      } catch {
        dispatch(showAlert('Failed to save seminar. Please try again.'));
      } finally {
        dispatch(SetLoadingStatus(false));
      }
    };
  
    const handleSaveDraft = () => {
      dispatch(showAlert('Draft saved locally. Publishing will be added next.'));
    };
  
    const renderStepper = () => (
      <div className="mb-8 rounded-xl border border-gray-100 bg-white px-8 py-5">
        <div className="flex items-center justify-between">
          {stepConfigs.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isLast = index === stepConfigs.length - 1;
  
            return (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
                      isCompleted || isActive
                        ? 'border-[#234C6A] bg-[#234C6A] text-white'
                        : 'border-gray-300 bg-white text-gray-400',
                    ].join(' ')}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <div
                    className={[
                      'mt-2 text-xs',
                      isActive ? 'font-semibold text-gray-900' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {step.label}
                  </div>
                </div>
                {!isLast && (
                  <div
                    className={[
                      'mx-2 h-px flex-1',
                      currentStep > step.id ? 'bg-[#234C6A]' : 'bg-gray-200',
                    ].join(' ')}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  
    const renderStep1 = () => {
      const titleLength = formData.title.length;
      const descriptionLength = formData.description.length;
  
      return (
        <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-6">
          {/* Cover image */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Cover Image{' '}
              <span className="ml-1 text-xs font-normal text-gray-400">(Optional)</span>
            </label>
            <div className="mt-1">
              {coverPreview ? (
                <div className="relative h-36 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      updateFormField('coverImage', null);
                      setCoverPreview(null);
                    }}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow hover:bg-white"
                  >
                    ×
                  </button>
                </div>
              ) : (
              <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400 hover:border-[#234C6A] hover:bg-gray-50/80">
                  <ImagePlus className="mb-2 h-6 w-6 text-gray-400" />
                  <span className="text-[13px] text-gray-600">
                    Click to upload or drag and drop
                  </span>
                  <span className="mt-1 text-[11px] text-gray-400">
                    PNG, JPG up to 5MB
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>
  
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Seminar Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={formData.title}
              onChange={(e) => updateFormField('title', e.target.value)}
              placeholder="e.g. Breaking into Product Management in 2025"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
            />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-red-500">{errors.title}</span>
              <span className="text-gray-400">{titleLength} / 100</span>
            </div>
          </div>
  
          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description <span className="text-red-400">*</span>
            </label>
          <textarea
            rows={4}
            maxLength={500}
            value={formData.description}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Describe what attendees will learn, who it's for, and what makes this seminar valuable."
            className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
          />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-red-500">{errors.description}</span>
              <span className="text-gray-400">{descriptionLength} / 500</span>
            </div>
          </div>
  
          {/* Majors + Services */}
        <div className="grid gap-6 md:grid-cols-2">
            {/* Majors */}
          <div
            className="space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
              <label className="block text-sm font-medium text-gray-700">
                Relevant Majors <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((prev) => (prev === 'majors' ? null : 'majors'))
                  }
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
                >
                  <span className={formData.majors.length ? 'text-gray-800' : 'text-gray-400'}>
                    {formData.majors.length ? 'Selected majors' : 'Select majors…'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formData.majors.length ? `${formData.majors.length} selected` : ''}
                  </span>
                </button>
                {openDropdown === 'majors' && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
                    {MAJORS_OPTIONS.map((option) => {
                      const checked = formData.majors.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                        >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleMultiSelect('majors', option)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-[#234C6A] focus:ring-[#234C6A]"
                        />
                          <span className="text-xs text-gray-700">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
              {formData.majors.map((major) => (
                <span
                  key={major}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e8f0f8] px-2.5 py-1 text-xs text-[#234C6A]"
                >
                  {major}
                  <button
                    type="button"
                    onClick={() => handleMultiSelect('majors', major)}
                    className="text-[11px] text-[#234C6A]/70 hover:text-[#1b3c53]"
                  >
                    ×
                  </button>
                </span>
              ))}
              </div>
            </div>
  
            {/* Services */}
          <div
            className="space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
              <label className="block text-sm font-medium text-gray-700">
                Services <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown((prev) => (prev === 'services' ? null : 'services'))
                  }
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
                >
                  <span className={formData.services.length ? 'text-gray-800' : 'text-gray-400'}>
                    {formData.services.length ? 'Selected services' : 'Select services…'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formData.services.length ? `${formData.services.length} selected` : ''}
                  </span>
                </button>
                {openDropdown === 'services' && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
                    {SERVICE_LABELS.map((option) => {
                      const checked = formData.services.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                        >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleMultiSelect('services', option)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-[#234C6A] focus:ring-[#234C6A]"
                        />
                          <span className="text-xs text-gray-700">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
              {formData.services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e8f0f8] px-2.5 py-1 text-xs text-[#234C6A]"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => handleMultiSelect('services', service)}
                    className="text-[11px] text-[#234C6A]/70 hover:text-[#1b3c53]"
                  >
                    ×
                  </button>
                </span>
              ))}
              </div>
            </div>
          </div>
  
          {/* Tags */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Tags</label>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                Optional
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-[11px] text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              {formData.tags.length < 5 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                  placeholder="e.g. product, strategy, career"
                  className="min-w-[140px] flex-1 border-none px-1 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Add up to 5 tags to help students discover your seminar.
            </p>
          </div>
        </div>
      );
    };
  
    const renderStep2 = () => (
      <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Seminar Date <span className="text-red-400">*</span>
          </label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => updateFormField('date', e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
        />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
        </div>
  
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Start Time <span className="text-red-400">*</span>
            </label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => updateFormField('startTime', e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
          />
            {errors.startTime && (
              <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              End Time <span className="text-red-400">*</span>
            </label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => updateFormField('endTime', e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
          />
            {errors.endTime && (
              <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>
            )}
          </div>
        </div>
  
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Timezone <span className="text-red-400">*</span>
          </label>
        <select
          value={formData.timezone}
          onChange={(e) => updateFormField('timezone', e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
        >
            <option value="">Select a timezone…</option>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {errors.timezone && (
            <p className="mt-1 text-xs text-red-500">{errors.timezone}</p>
          )}
        </div>
  
        <div className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Recurring Seminar</p>
            <p className="mt-1 text-xs text-gray-400">
              Enable if this seminar repeats on a schedule.
            </p>
          </div>
        <button
          type="button"
          onClick={() => updateFormField('isRecurring', !formData.isRecurring)}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            formData.isRecurring ? 'bg-[#234C6A]' : 'bg-gray-200',
          ].join(' ')}
        >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                formData.isRecurring ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
      </div>
    );
  
    const renderStep3 = () => (
      <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-6">
        <div className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Free Seminar</p>
            <p className="mt-1 text-xs text-gray-400">
              When enabled, attendees can join without paying a fee.
            </p>
          </div>
        <button
          type="button"
          onClick={() => updateFormField('isFree', !formData.isFree)}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            formData.isFree ? 'bg-[#234C6A]' : 'bg-gray-200',
          ].join(' ')}
        >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                formData.isFree ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>
  
        {!formData.isFree && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Price <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-gray-400">
                  {formData.currency || 'USD'}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    updateFormField(
                      'price',
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
                />
              </div>
              <select
                value={formData.currency}
                onChange={(e) => updateFormField('currency', e.target.value)}
                className="w-24 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
              >
                {CURRENCY_OPTIONS.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>
            {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
            {errors.currency && (
              <p className="mt-1 text-xs text-red-500">{errors.currency}</p>
            )}
          </div>
        )}
  
        {formData.isFree && (
          <p className="text-xs text-gray-400">
            This seminar will be free for all attendees.
          </p>
        )}
  
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Max Attendees
          </label>
        <input
          type="number"
          min={0}
          value={formData.maxAttendees}
          onChange={(e) =>
            updateFormField(
              'maxAttendees',
              e.target.value === '' ? '' : Number(e.target.value)
            )
          }
          placeholder="Leave blank for unlimited"
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
        />
          <p className="mt-1 text-xs text-gray-400">
            Leave blank for unlimited attendees.
          </p>
        </div>
      </div>
    );
  
    const renderStepContent = () => {
      if (currentStep === 1) return renderStep1();
      if (currentStep === 2) return renderStep2();
      return renderStep3();
    };
  
  return (
    <div
      className="min-h-full bg-[#F5F3EF]"
      onClick={() => setOpenDropdown(null)}
    >
        <div className="mx-auto max-w-2xl px-6 py-8">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {selectedSeminar?.groupId ? 'Edit seminar' : 'Create a seminar'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Fill in the details below to schedule your next seminar.
              </p>
            </div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Back to list
              </button>
            ) : null}
          </header>
  
          {renderStepper()}
  
        {renderStepContent()}
  
          <div className="mt-6 border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center rounded-lg bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            >
              Save as Draft
            </button>
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Back
                  </button>
                )}
              {currentStep < 3 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-[#234C6A] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1b3c53]"
                >
                  Next
                </button>
              )}
              {currentStep === 3 && (
                <button
                  type="button"
                  onClick={handlePublish}
                  className="rounded-lg bg-[#234C6A] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1b3c53]"
                >
                  Publish Seminar
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  export default ExpertSeminar;