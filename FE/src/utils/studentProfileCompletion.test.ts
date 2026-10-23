import { describe, expect, it } from 'vitest';
import {
  STUDENT_PROFILE_SECTION_WEIGHTS,
  getStudentProfileCompletion,
} from './studentProfileCompletion';

describe('getStudentProfileCompletion', () => {
  it('returns 0% for an empty profile', () => {
    const result = getStudentProfileCompletion({});
    expect(result.percent).toBe(0);
    expect(result.sections).toHaveLength(4);
    expect(result.sections.every((s) => !s.isComplete)).toBe(true);
    const weightSum = Object.values(STUDENT_PROFILE_SECTION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(weightSum).toBe(100);
  });

  it('gives partial academic credit and keeps weights in one constant', () => {
    expect(STUDENT_PROFILE_SECTION_WEIGHTS.academic).toBe(35);
    const result = getStudentProfileCompletion({
      degreeSought: 'PhD',
      intendedIntake: 'Fall 2027',
      currentUniversity: 'HUST',
    });
    const academic = result.sections.find((s) => s.id === 'academic')!;
    expect(academic.filled).toBe(3);
    expect(academic.total).toBe(6);
    expect(academic.isComplete).toBe(false);
    // 35 * (3/6) = 17.5, rounded to 18
    expect(result.percent).toBe(18);
  });

  it('splits preferences into services and interests', () => {
    const servicesOnly = getStudentProfileCompletion({
      services: [{ label: 'Study Abroad' }],
    });
    expect(servicesOnly.percent).toBe(13);

    // Slug-shaped service docs (same shape the profile page stores/loads).
    const slugService = getStudentProfileCompletion({
      services: [{ value: 'study_abroad' }],
    });
    expect(slugService.percent).toBe(13);

    const both = getStudentProfileCompletion({
      services: ['Work Abroad'],
      keywords: ['Computer Science'],
    });
    expect(both.percent).toBe(25);
    expect(both.sections.find((s) => s.id === 'preferences')?.isComplete).toBe(true);
  });

  it('counts numeric GPA the same as a string GPA', () => {
    const result = getStudentProfileCompletion({ gpa: 3.75 });
    expect(result.sections.find((s) => s.id === 'academic')?.filled).toBe(1);
    expect(result.percent).toBe(Math.round(35 * (1 / 6)));
  });

  it('counts resume as the full resume section', () => {
    const result = getStudentProfileCompletion({ resume: 'resumes/cv.pdf' });
    expect(result.percent).toBe(25);
    expect(result.sections.find((s) => s.id === 'resume')?.isComplete).toBe(true);
  });

  it('ignores whitespace-only values and empty arrays', () => {
    const result = getStudentProfileCompletion({
      degreeSought: '   ',
      targetUniversities: '',
      services: [],
      keywords: ['  '],
      resume: ' ',
    });
    expect(result.percent).toBe(0);
  });

  it('keeps terms incomplete until the current role contract is signed', () => {
    const unsigned = getStudentProfileCompletion({ roleTermsSigned: false });
    expect(unsigned.sections.find((s) => s.id === 'terms')?.isComplete).toBe(false);
    const signed = getStudentProfileCompletion({ roleTermsSigned: true });
    expect(signed.sections.find((s) => s.id === 'terms')?.isComplete).toBe(true);
    expect(signed.percent).toBe(15);
  });

  it('reaches 100% when every section is filled', () => {
    const result = getStudentProfileCompletion({
      degreeSought: 'Master\'s',
      intendedIntake: 'Fall 2027',
      currentUniversity: 'HUST',
      gpa: '3.8',
      targetUniversities: 'MIT, Stanford',
      country: 'China',
      services: ['Research Guidance'],
      keywords: ['Civil Engineering'],
      resume: 'https://cdn.example.com/resume.pdf',
      roleTermsSigned: true,
    });
    expect(result.percent).toBe(100);
    expect(result.sections.every((s) => s.isComplete)).toBe(true);
    expect(result.sections.map((s) => s.href)).toEqual([
      '#profile-academic',
      '#profile-preferences',
      '#profile-resume',
      '#terms-agreement',
    ]);
  });
});
