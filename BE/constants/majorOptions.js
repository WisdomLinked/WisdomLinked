const MAJOR_OPTIONS = [
    'Aerospace Engineering',
    'Biomedical Engineering',
    'Chemical Engineering',
    'Civil Engineering',
    'Computer Engineering',
    'Electrical Engineering',
    'Environmental Engineering',
    'Industrial Engineering',
    'Mechanical Engineering',
    'Materials Science & Engineering',
    'Nuclear Engineering',
    'Petroleum Engineering',
    'Software Engineering',
    'Systems Engineering',
];

const OTHER_MAJOR = 'Other';

const isBaselineMajor = (value) => {
    const v = String(value || '').trim().toLowerCase();
    return MAJOR_OPTIONS.some((m) => m.toLowerCase() === v);
};

module.exports = { MAJOR_OPTIONS, OTHER_MAJOR, isBaselineMajor };
