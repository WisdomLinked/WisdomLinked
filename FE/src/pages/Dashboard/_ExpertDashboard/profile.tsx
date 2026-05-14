import React, { useState, useEffect } from "react";
import EditAvatar from "../EditAvatar";
import {
    callApi,
    doGetKeywordsAndServices,
    doUpdateProfile,
    doUpdateProfileByAdmin,
    profileImageFetch, profileImageUpload
} from "../../../api/api";
import ShowFieldError from "../../../components/ShowFieldError";
import MultiSelectionWithInputTag from "../../../components/MultiSelectionWithInputTag";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import PhoneInput from "react-phone-input-2";
import { arraysEqual, checkTitleNameInvalid } from "../../../actions/common";
import { useNavigate } from "react-router-dom";
import { SetLoadingStatus } from "../../../actions/appActions";
import CountrySelect from "../../../components/CountrySelection";
import FileBrowser from "../../../components/fileBrowser";
import { useDispatch } from "react-redux";
import { showAlert } from "../../../actions/alertActions";
import { updateMe } from "../../../actions/authActions";
import { filterApiServicesToCanonical } from "../../../constants/serviceOptions";
import ReactImagePickerEditor from 'react-image-picker-editor';
import 'react-image-picker-editor/dist/index.css'
import FilePreviewModal from "../FilePreviewModal";

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EBF2F7] text-[#234C6A]">
            {icon}
        </div>
        <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
    </div>
);

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {children}{required && <span className="ml-0.5 text-rose-400">*</span>}
    </label>
);

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#234C6A] focus:bg-white focus:ring-2 focus:ring-[#234C6A]/10";

const ExpertProfile = ({
    userDetails,
    isFromAdminPanel = false,
    updateOneUser
}: any) => {

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [imageSrc, set_imageSrc] = useState<any>(null);
    const [image, set_image] = useState<any>('');
    const [oldImageSrc, set_oldImageSrc] = useState<any>(null);
    const [name, set_name] = useState('');
    const [title, set_title] = useState('');
    const [description, set_description] = useState('');
    const [keywords, set_keywords] = useState([]);
    const [services, set_services] = useState([]);
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([]);
    const [selectedServices, set_selectedServices] = useState<Array<any>>([]);
    const [country, set_country] = useState<any>();
    const [state, set_state] = useState<any>();
    const [city, set_city] = useState<any>();
    const [stateAvailable, set_stateAvailable] = useState(false);
    const [cityAvailable, set_cityAvailable] = useState(false);
    const [phoneNumber, set_phoneNumber] = useState<any>('');
    const [showError, set_showError] = useState(false);
    const [enableToUpdate, set_enableToUpdate] = useState(false);
    const [resume, set_resume] = useState('');
    const [file, set_file] = useState('');
    const [fileError, set_fileError] = useState('');
    const [currFileName, set_currFileName] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    const SPECIAL_NOTE_MAX = 2000;
    const [specialNote, set_specialNote] = useState('');
    const [savingSpecialNote, set_savingSpecialNote] = useState(false);

    const reset = async () => {
        if (!userDetails) return;
        if (userDetails.image) set_imageSrc(oldImageSrc);
        set_name(userDetails.username || '');
        set_title(userDetails.title || '');
        set_description(userDetails.description || '');
        set_selectedKeywords(userDetails.keywords || []);
        set_selectedServices(userDetails.services || []);
        set_country(userDetails.country || null);
        set_state(userDetails.state || null);
        set_city(userDetails.city || null);
        set_phoneNumber(userDetails.phoneNumber || '');
        set_resume(userDetails.resume || '');
        set_specialNote(userDetails.specialNote || '');
    };

    const loadData = async () => {
        if (!userDetails) return;
        if (userDetails.image) {
            const img: any = imageSrc ? imageSrc : await profileImageFetch(userDetails.image, "small");
            if (img) { set_imageSrc(img); set_oldImageSrc(img); set_image(userDetails.image); }
        }
        set_name(userDetails.username || '');
        set_title(userDetails.title || '');
        set_description(userDetails.description || '');
        set_selectedKeywords(userDetails.keywords || []);
        set_selectedServices(userDetails.services || []);
        set_country(userDetails.country || null);
        set_state(userDetails.state || null);
        set_city(userDetails.city || null);
        set_phoneNumber(userDetails.phoneNumber || '');
        set_resume(userDetails.resume || '');
        set_specialNote(userDetails.specialNote || '');
    };

    const saveSpecialNote = async () => {
        const trimmed = (specialNote || '').slice(0, SPECIAL_NOTE_MAX);
        set_savingSpecialNote(true);
        if (!isFromAdminPanel) {
            const ok = await doUpdateProfile({ email: userDetails.email, specialNote: trimmed });
            if (ok) {
                set_specialNote(trimmed);
                dispatch(showAlert('Notes saved'));
            }
        } else {
            const res = await doUpdateProfileByAdmin({ email: userDetails.email, specialNote: trimmed });
            if (res?.result) {
                updateOneUser(res.result);
                set_specialNote(trimmed);
                dispatch(showAlert('Notes saved'));
            } else {
                dispatch(showAlert('Could not save notes'));
            }
        }
        set_savingSpecialNote(false);
    };

    const uploadProfileImage = async (newDataUri: any) => {
        try {
            const fileExtension = newDataUri.split(';')[0].split('/')[1];
            const base64Response = await fetch(newDataUri);
            const blob = await base64Response.blob();
            const file = new File([blob], `${userDetails.userId}_${Date.now()}.${fileExtension}`, { type: blob.type });
            const formData = new FormData();
            formData.append('image', file);
            const res = await profileImageUpload(formData);
            set_currFileName(res.data.details[0].filename);
            return res.data.details[0].filename;
        } catch (error) {
            console.error('Error uploading image:', error);
        }
    };

    const updateProfile = async () => {
        SetLoadingStatus(true);
        if (oldImageSrc != imageSrc) await uploadProfileImage(imageSrc);
        const updates = {
            email: userDetails.email,
            image: currFileName ? currFileName : image,
            username: name, title, description,
            keywords: selectedKeywords,
            services: selectedServices.map((x: any) => x._id),
            country, state, city, phoneNumber,
        };
        if (!isFromAdminPanel) {
            await doUpdateProfile(updates);
            await dispatch(updateMe() as any);
        } else {
            const res = await doUpdateProfileByAdmin(updates);
            if (res) updateOneUser(res.result);
        }
        SetLoadingStatus(false);
    };

    const updateResume = async () => {
        SetLoadingStatus(true);
        const response = await callApi('POST', 'auth/updateResume', { email: userDetails.email }, file);
        if (response.status === 'SUCCESS') {
            set_resume(response.newResume);
            set_file('');
        } else {
            dispatch(showAlert(response.error));
        }
        SetLoadingStatus(false);
    };

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || []);
            set_services(filterApiServicesToCanonical(response.services || []));
        }
    };

    useEffect(() => {
        const hasChanges =
            !(imageSrc == oldImageSrc) ||
            name !== userDetails.username ||
            title !== userDetails.title ||
            description !== userDetails.description ||
            !arraysEqual(selectedKeywords || [], userDetails.keywords || []) ||
            !arraysEqual(selectedServices || [], userDetails.services || []) ||
            !userDetails.country?.name !== country?.name ||
            !userDetails.state?.name !== state?.name ||
            !userDetails.city?.name !== city?.name ||
            phoneNumber !== userDetails.phoneNumber;

        const hasValidCoreFields =
            name.length >= 3 &&
            !checkTitleNameInvalid('Username', name) &&
            title.length > 0 &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            !!phoneNumber;

        if (hasChanges && hasValidCoreFields) {
            set_enableToUpdate(true);
            set_showError(false);
        } else {
            set_enableToUpdate(false);
            set_showError(true);
        }
    }, [imageSrc, oldImageSrc, name, title, description, selectedKeywords, selectedServices, country, state, stateAvailable, city, cityAvailable, phoneNumber, userDetails]);

    useEffect(() => {
        if (!fileError && file) updateResume();
    }, [file, fileError]);

    useEffect(() => {
        if (userDetails) { loadData(); getKeywordsAndServices(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userDetails]);

    if (!userDetails) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#F5F3EF]">
                <p className="text-sm text-slate-500">Loading profile…</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-y-auto bg-[#F5F3EF]">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

                {/* Page header */}
                {!isFromAdminPanel && (
                    <div className="mb-7 flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M9.57 5.93L3.5 12l6.07 6.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M20.5 12H3.67" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Expert Profile</h1>
                            <p className="text-xs text-slate-400">Manage how you appear to students and mentees</p>
                        </div>
                    </div>
                )}

                <div className="space-y-5">

                    {/* ── Card 1: Identity ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <SectionHeader
                            icon={
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
                                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                            }
                            title="Identity"
                            subtitle="Your name, photo, and headline"
                        />

                        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                            {/* Avatar */}
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <div className="rounded-2xl overflow-hidden ring-2 ring-slate-100 shadow-md">
                                    <ReactImagePickerEditor
                                        config={{
                                            borderRadius: '16px',
                                            language: 'en',
                                            width: '120px',
                                            height: '120px',
                                            objectFit: 'cover',
                                            compressInitial: 50,
                                            aspectRatio: 1,
                                        }}
                                        imageSrcProp={imageSrc}
                                        imageChanged={(newDataUri: any) => set_imageSrc(newDataUri)}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 text-center max-w-[120px]">
                                    Max 500 KB · Square works best
                                </p>
                            </div>

                            {/* Name + Title */}
                            <div className="flex-1 w-full space-y-4">
                                {isFromAdminPanel && (
                                    <div>
                                        <FieldLabel>Email</FieldLabel>
                                        <input className={inputClass} disabled value={userDetails.email} />
                                    </div>
                                )}
                                <div>
                                    <FieldLabel required>Full name</FieldLabel>
                                    <input
                                        className={inputClass}
                                        placeholder="e.g. Dr. Maya Iyer"
                                        value={name}
                                        onChange={(e) => set_name(e.target.value)}
                                    />
                                    <ShowFieldError
                                        show={!(name.length >= 3 && !checkTitleNameInvalid('Username', name)) && showError}
                                        label={checkTitleNameInvalid('Username', name) || "Name must be at least 3 characters."}
                                    />
                                </div>
                                <div>
                                    <FieldLabel required>Professional title</FieldLabel>
                                    <input
                                        className={inputClass}
                                        placeholder="e.g. Senior Structural Engineer"
                                        value={title}
                                        onChange={(e) => set_title(e.target.value)}
                                    />
                                    <ShowFieldError show={!title.length && showError} label="Title is required." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Card 2: Expertise ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <SectionHeader
                            icon={
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                                    <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            }
                            title="Expertise"
                            subtitle="Your bio, disciplines, and services"
                        />

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <FieldLabel required>Short bio</FieldLabel>
                                <textarea
                                    className={`${inputClass} min-h-[130px] resize-none`}
                                    placeholder="Describe your expertise and who you help — 2–3 sentences."
                                    value={description}
                                    onChange={(e) => set_description(e.target.value)}
                                />
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-[11px] text-slate-400">
                                        Bio can be edited freely.
                                    </span>
                                    <span className={`text-[11px] ml-auto ${description.length > 100 ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {description.length}/100
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <FieldLabel required>Majors / disciplines</FieldLabel>
                                    <MultiSelectionWithInputTag
                                        options={keywords}
                                        selectedOptions={selectedKeywords}
                                        set_selectedOptions={set_selectedKeywords}
                                        placeholder="e.g. Civil Engineering…"
                                    />
                                </div>
                                <div>
                                    <FieldLabel required>Services you offer</FieldLabel>
                                    <SelectionWithCheckBox
                                        options={services}
                                        selectedOptions={selectedServices}
                                        set_selectedOptions={set_selectedServices}
                                        placeholder="Select services"
                                        isMulti={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Card: Preferences & expectations (special notes) ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <SectionHeader
                            icon={
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d="M4 4h16v12H7l-3 3V4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                                    <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                            }
                            title="Preferences & expectations"
                            subtitle="Optional notes for students about how you work and what you expect"
                        />
                        <p className="text-xs text-slate-600 mb-3">
                            Examples: communication preferences, how to prepare for sessions, cancellation policy in your
                            own words, or topics you especially enjoy mentoring.
                        </p>
                        <textarea
                            className={`${inputClass} min-h-[120px] resize-y`}
                            placeholder="Write anything that helps students get the most out of working with you…"
                            value={specialNote}
                            onChange={(e) => set_specialNote(e.target.value.slice(0, SPECIAL_NOTE_MAX))}
                            maxLength={SPECIAL_NOTE_MAX}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">
                                {specialNote.length}/{SPECIAL_NOTE_MAX}
                            </span>
                            <button
                                type="button"
                                onClick={saveSpecialNote}
                                disabled={savingSpecialNote}
                                className="rounded-xl bg-[#234C6A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1b3c53] disabled:opacity-50 transition"
                            >
                                {savingSpecialNote ? 'Saving…' : 'Save notes'}
                            </button>
                        </div>
                    </div>

                    {/* ── Card 3: Location & Contact ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <SectionHeader
                            icon={
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.8"/>
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.8"/>
                                </svg>
                            }
                            title="Location & Contact"
                            subtitle="Where you're based and how to reach you"
                        />

                        <div className="space-y-4">
                            <CountrySelect
                                selectedCountry={country}
                                set_selectedCountry={set_country}
                                selectedState={state}
                                set_selectedState={set_state}
                                selectedCity={city}
                                set_selectedCity={set_city}
                                stateAvailable={stateAvailable}
                                set_stateAvailable={set_stateAvailable}
                                cityAvailable={cityAvailable}
                                set_cityAvailable={set_cityAvailable}
                                showError={showError}
                            />

                            <div>
                                <FieldLabel required>Phone number</FieldLabel>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 transition focus-within:border-[#234C6A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#234C6A]/10">
                                    <PhoneInput
                                        specialLabel=""
                                        placeholder="Enter number"
                                        value={phoneNumber}
                                        onChange={(data) => set_phoneNumber(data)}
                                        inputStyle={{ border: "none", width: "100%", background: "transparent", fontSize: "14px" }}
                                    />
                                </div>
                                <ShowFieldError show={!phoneNumber.length && showError} label="Required field." />
                            </div>
                        </div>
                    </div>

                    {/* ── Card 4: Resume ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <SectionHeader
                            icon={
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                            }
                            title="Resume / CV"
                            subtitle="Upload a PDF of your latest credentials"
                        />

                        {resume && (
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-800">Resume on file</p>
                                        <p className="text-[11px] text-emerald-600">Your CV is uploaded and visible to students</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPreview(true)}
                                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                                >
                                    View
                                </button>
                            </div>
                        )}

                        {showPreview && (
                            <FilePreviewModal fileUrl={resume} fileName="Resume" onClose={() => setShowPreview(false)} />
                        )}

                        <div>
                            <FieldLabel>{resume ? 'Replace resume' : 'Upload resume'}</FieldLabel>
                            {!resume && (
                                <p className="mb-2 text-xs text-slate-500">
                                    No resume uploaded yet. Upload a PDF up to 2MB.
                                </p>
                            )}
                            <div className="w-full">
                                <FileBrowser file={file} set_file={set_file} set_fileError={set_fileError} />
                            </div>
                            <ShowFieldError
                                show={fileError || (!file && showError)}
                                label={file ? fileError : "Resume is required."}
                            />
                        </div>
                    </div>

                    {/* ── Sticky action bar ── */}
                    <div className="sticky bottom-4 z-10">
                        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md px-5 py-3.5 shadow-lg flex items-center justify-between gap-3">
                            <p className="text-xs text-slate-400 hidden sm:block">
                                {enableToUpdate ? "You have unsaved changes." : "All fields must be valid to save."}
                            </p>
                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={reset}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    disabled={!enableToUpdate}
                                    onClick={async () => { await updateProfile(); await loadData(); }}
                                    className="rounded-xl bg-[#234C6A] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1b3c53] disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ExpertProfile;