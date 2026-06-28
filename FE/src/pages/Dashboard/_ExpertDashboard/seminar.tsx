import React, {
    useState,
    useEffect,
    useMemo,
    ChangeEvent,
    KeyboardEvent,
  } from 'react';
  import { Check, ImagePlus } from 'lucide-react';
  import { useDispatch } from 'react-redux';
  import { useNavigate } from 'react-router-dom';
  import { useAppSelector } from '../../../store';
  import { createGroupChat, updateGroupChat, uploadSeminarCover } from '../../../api/api';
  import { SetLoadingStatus } from '../../../actions/appActions';
  import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../actions/alertActions';
  import { updateMe } from '../../../actions/authActions';
  import { SERVICE_LABELS } from '../../../constants/serviceOptions';
  import { MAJOR_OPTIONS_WITH_OTHER, OTHER_MAJOR } from '../../../constants/majorOptions';
  import DatePickerField from '../../../components/ui/DatePickerField';
  import TimePickerField from '../../../components/ui/TimePickerField';
  import SelectField from '../../../components/ui/SelectField';
  import {
    COMMON_IANA_TIMEZONES,
    detectUserTimeZone,
    getTimezoneOffsetHalfHours,
  } from '../../../utils/schedulingTimezone';

  type StepId = 1 | 2 | 3;

  type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

  const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string; hint: string }[] = [
    { value: 'weekly', label: 'Weekly', hint: 'Every week on this weekday for a year' },
    { value: 'biweekly', label: 'Biweekly', hint: 'Every two weeks for a year' },
    { value: 'monthly', label: 'Monthly', hint: 'Every month on this date for a year' },
  ];

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
    recurrenceFrequency: RecurrenceFrequency;
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
      image?: string | null;
      status?: string;
      isRecurring?: boolean;
      recurrenceFrequency?: RecurrenceFrequency;
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
    recurrenceFrequency: 'weekly',
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
  
  const MAJORS_OPTIONS: string[] = MAJOR_OPTIONS_WITH_OTHER;
  
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
  
    const browserTz = useMemo(() => detectUserTimeZone(), []);

    // Timezone dropdown defaults to the browser zone but stays editable. Browser zone is
    // surfaced first, then the common IANA list (deduped in case the browser zone is in it).
    const timezoneOptions = useMemo(
      () => Array.from(new Set<string>([browserTz, ...COMMON_IANA_TIMEZONES])),
      [browserTz],
    );

    // Booking always happens in the browser's local time. If the timezone saved on
    // the expert's profile resolves to a different UTC offset than the browser right
    // now, surface a red warning so they know the scheduled time follows browser time.
    const timezoneMismatch = useMemo(() => {
      const profileTz = (userDetails as { timeZone?: string } | undefined)?.timeZone || 'UTC';
      const now = new Date();
      const matches =
        getTimezoneOffsetHalfHours(browserTz, now) === getTimezoneOffsetHalfHours(profileTz, now);
      return matches ? null : { browserTz, profileTz };
    }, [userDetails, browserTz]);

    const [currentStep, setCurrentStep] = useState<StepId>(1);
    const [formData, setFormData] = useState<SeminarFormData>(() => ({
      ...initialFormData,
      timezone: detectUserTimeZone(),
    }));
    const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
    const [showCustomMajorInput, setShowCustomMajorInput] = useState<boolean>(false);
    const [customMajor, setCustomMajor] = useState<string>('');
    const [tagInput, setTagInput] = useState<string>('');
    const [errors, setErrors] = useState<SeminarErrors>({});
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    // URL of an already-uploaded cover (when editing/resuming); reused if no new file is picked.
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

    // The expert's existing 1:1 sessions and seminars, used to flag time clashes
    // when scheduling a new seminar. Declined/cancelled/draft items are ignored,
    // and the seminar being edited is excluded so it never conflicts with itself.
    const existingBookings = useMemo(() => {
      const out: { name: string; start: Date; end: Date }[] = [];
      const editingId = selectedSeminar?.groupId ? String(selectedSeminar.groupId) : null;
      const push = (rec: any, name: string) => {
        if (!rec?.start) return;
        const start = new Date(rec.start);
        const end = rec.end
          ? new Date(rec.end)
          : new Date(start.getTime() + (rec.duration ? rec.duration * 60000 : 60 * 60000));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
        out.push({ name, start, end });
      };

      const events: any[] = Array.isArray((userDetails as any)?.events) ? (userDetails as any).events : [];
      for (const ev of events) {
        const status = String(ev?.status || '').toLowerCase();
        if (status === 'declined' || status === 'cancelled') continue;
        const who = ev?.customer?.username;
        push(ev, who ? `a 1:1 with ${who}` : ev?.title || 'a 1:1 session');
      }

      const groupChats: any[] = Array.isArray((userDetails as any)?.groupChats)
        ? (userDetails as any).groupChats
        : [];
      for (const g of groupChats) {
        const type = String(g?.type || '');
        if (type !== 'seminar' && type !== 'individual') continue;
        const status = String(g?.status || '').toLowerCase();
        if (status === 'draft' || status === 'cancelled') continue;
        if (editingId && String(g?._id) === editingId) continue;
        push(g, g?.name || (type === 'seminar' ? 'another seminar' : 'a 1:1 session'));
      }
      return out;
    }, [userDetails, selectedSeminar]);

    // For the chosen date/time: a hard conflict with an existing booking (blocks
    // creation) and a soft check against the expert's saved availability hours
    // (warns but still allows creating the seminar).
    const scheduleCheck = useMemo<{
      conflict: { name: string } | null;
      outsideAvailability: boolean;
    }>(() => {
      const { date, startTime, endTime } = formData;
      if (!date || !startTime || !endTime) return { conflict: null, outsideAvailability: false };
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(`${date}T${endTime}:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return { conflict: null, outsideAvailability: false };
      }

      const conflict = existingBookings.find((b) => start < b.end && b.start < end) || null;

      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const startBlock = Math.floor(toMinutes(startTime) / 30);
      const endBlock = Math.ceil(toMinutes(endTime) / 30);
      const required: number[] = [];
      for (let i = startBlock; i < endBlock; i += 1) required.push(i);

      const weekdayKey = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[start.getDay()];
      const weekly = (userDetails as any)?.weeklyTimeSlots;
      const hasWeekly =
        weekly && typeof weekly === 'object'
          ? Object.values(weekly).some((v) => Array.isArray(v) && v.length)
          : false;

      let availableSet: Set<number> | null = null;
      if (hasWeekly) {
        availableSet = new Set<number>(Array.isArray(weekly[weekdayKey]) ? weekly[weekdayKey] : []);
      } else {
        const flat = (userDetails as any)?.timeSlots;
        if (Array.isArray(flat)) availableSet = new Set<number>(flat);
      }

      const outsideAvailability = availableSet ? !required.every((i) => availableSet!.has(i)) : false;
      return { conflict: conflict ? { name: conflict.name } : null, outsideAvailability };
    }, [formData.date, formData.startTime, formData.endTime, existingBookings, userDetails]);
  
    useEffect(() => {
      if (userDetails?.status === 'review') {
        dispatch(showWarningAlert("This feature isn't available while your profile is under review."));
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
        isRecurring: !!selectedSeminar.isRecurring,
        recurrenceFrequency: selectedSeminar.recurrenceFrequency || 'weekly',
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

      if (selectedSeminar.image) {
        setExistingImageUrl(selectedSeminar.image);
        setCoverPreview(selectedSeminar.image);
      }
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
        dispatch(showErrorAlert('Cover image must be less than 5MB'));
        return;
      }
      updateFormField('coverImage', file);
      if (file) {
        setExistingImageUrl(null); // a new file replaces any previously uploaded cover
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

    const addCustomMajor = () => {
      const v = customMajor.trim();
      if (!v) return;
      if (!formData.majors.some((m) => m.toLowerCase() === v.toLowerCase())) {
        handleMultiSelect('majors', v);
      }
      setCustomMajor('');
      setShowCustomMajorInput(false);
    };
  
    const handleTagAdd = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const raw = tagInput.trim();
      if (!raw) return;
      if (formData.tags.length >= 5) {
        dispatch(showWarningAlert('You can add up to 5 tags'));
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
      // A hard scheduling clash blocks moving past the date & time step.
      if (currentStep === 2 && scheduleCheck.conflict) return;
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
  
    // Shared save path for both "Publish" (status: active) and "Save as Draft"
    // (status: draft). Publishing fully validates; a draft only needs a title.
    const persistSeminar = async (status: 'active' | 'draft') => {
      if (status === 'active') {
        if (!validateStep(3)) {
          setCurrentStep(3);
          return;
        }
      } else if (!formData.title.trim()) {
        setErrors((prev) => ({ ...prev, title: 'Add a title to save a draft.' }));
        setCurrentStep(1);
        return;
      }

      // A hard clash with an existing booking blocks saving at any status.
      if (scheduleCheck.conflict) {
        setCurrentStep(2);
        dispatch(
          showErrorAlert(
            `This time clashes with ${scheduleCheck.conflict.name}. Pick a different time.`,
          ),
        );
        return;
      }

      // Publishing requires a valid date/time; a draft may be saved without one.
      let timeInfo = null;
      if (formData.date && formData.startTime && formData.endTime) {
        timeInfo = computeStartEndAndDuration();
      }
      if (status === 'active' && !timeInfo) {
        setCurrentStep(2);
        return;
      }

      try {
        SetLoadingStatus(true);

        // Upload a newly chosen cover; otherwise keep the existing one.
        let imageUrl = existingImageUrl;
        if (formData.coverImage) {
          const uploaded = await uploadSeminarCover(formData.coverImage);
          if (uploaded) imageUrl = uploaded;
        }

        const payload = {
          name: formData.title.trim(),
          description: formData.description.trim(),
          image: imageUrl || undefined,
          services: formData.services,
          keywords: formData.majors,
          start: timeInfo?.start,
          end: timeInfo?.end,
          duration: timeInfo?.durationMinutes,
          price: formData.isFree ? 0 : Number(formData.price || 0),
          type: 'seminar' as const,
          status,
          createdBy: userDetails?._id,
          maxAttendees: formData.maxAttendees === '' ? undefined : Number(formData.maxAttendees),
          currency: formData.currency,
          isRecurring: formData.isRecurring,
          recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : undefined,
          timezone: formData.timezone,
        };

        const res = selectedSeminar?.groupId
          ? await updateGroupChat({ groupId: selectedSeminar.groupId, ...payload })
          : await createGroupChat(payload);

        if (res) {
          const msg =
            status === 'draft'
              ? 'Draft saved'
              : selectedSeminar?.groupId
                ? 'Seminar updated successfully'
                : 'Seminar created successfully';
          dispatch(showSuccessAlert(msg));
          await (dispatch as any)(updateMe());
          if (onAfterSeminarSave) {
            onAfterSeminarSave();
          } else {
            navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`);
          }
        }
      } catch {
        dispatch(showErrorAlert('Failed to save seminar. Please try again.'));
      } finally {
        SetLoadingStatus(false);
      }
    };

    const handlePublish = () => persistSeminar('active');
    const handleSaveDraft = () => persistSeminar('draft');
  
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
                      setExistingImageUrl(null);
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
                    {MAJORS_OPTIONS.filter((option) => option !== OTHER_MAJOR).map((option) => {
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
                    {showCustomMajorInput ? (
                      <div className="flex items-center gap-1 px-3 py-2">
                        <input
                          type="text"
                          autoFocus
                          value={customMajor}
                          onChange={(e) => setCustomMajor(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomMajor(); } }}
                          placeholder="Type your branch"
                          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-[#234C6A]/40"
                        />
                        <button
                          type="button"
                          onClick={addCustomMajor}
                          className="rounded-md bg-[#234C6A] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#1b3c53]"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCustomMajorInput(true)}
                        className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#234C6A] hover:bg-gray-50"
                      >
                        {OTHER_MAJOR} (add your own)
                      </button>
                    )}
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
        {timezoneMismatch && (
          <div
            role="alert"
            style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#b91c1c' }}
            className="rounded-lg border px-4 py-3 text-sm font-medium"
          >
            Your profile timezone (<strong>{timezoneMismatch.profileTz}</strong>) doesn’t match
            your current browser time (<strong>{timezoneMismatch.browserTz}</strong>). This seminar
            will be scheduled using your browser time.
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Seminar Date <span className="text-red-400">*</span>
          </label>
        <DatePickerField
          id="seminar-date"
          value={formData.date}
          onChange={(v) => updateFormField('date', v)}
          min={new Date().toLocaleDateString('en-CA')}
          placeholder="Select a date"
        />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
        </div>
  
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Start Time <span className="text-red-400">*</span>
            </label>
          <TimePickerField
            id="seminar-start-time"
            value={formData.startTime}
            onChange={(v) => updateFormField('startTime', v)}
            placeholder="Select start time"
          />
            {errors.startTime && (
              <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              End Time <span className="text-red-400">*</span>
            </label>
          <TimePickerField
            id="seminar-end-time"
            value={formData.endTime}
            onChange={(v) => updateFormField('endTime', v)}
            placeholder="Select end time"
          />
            {errors.endTime && (
              <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>
            )}
          </div>
        </div>

        {scheduleCheck.conflict ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            This time clashes with <strong>{scheduleCheck.conflict.name}</strong> already on your
            calendar. Choose a different time to continue.
          </div>
        ) : scheduleCheck.outsideAvailability ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            This time is outside the availability hours you set. You can still create the seminar.
          </div>
        ) : null}
  
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Timezone <span className="text-red-400">*</span>
          </label>
        <SelectField
          id="seminar-timezone"
          value={formData.timezone}
          onChange={(v) => updateFormField('timezone', v)}
          options={timezoneOptions.map((tz) => ({ value: tz, label: tz }))}
          placeholder="Select a timezone…"
        />
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

        {formData.isRecurring && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Repeats
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {RECURRENCE_OPTIONS.map((option) => {
                const active = formData.recurrenceFrequency === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateFormField('recurrenceFrequency', option.value)}
                    className={[
                      'rounded-lg border px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-[#234C6A] bg-[#e8f0f8]'
                        : 'border-gray-200 bg-white hover:border-[#234C6A]/40',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'block text-sm font-medium',
                        active ? 'text-[#234C6A]' : 'text-gray-700',
                      ].join(' ')}
                    >
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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