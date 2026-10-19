import { describe, expect, it } from 'vitest';
import {
  STUDENT_PROFILE_SECTION_WEIGHTS,
  getStudentProfileCompletion,
} from './studentProfileCompletion';

describe('getStudentProfileCompletion', () => {
  it('returns 0% for an empty profile', () => {
    const result = getStudentProfileCompletion({});
    expect(result.percent).toBe(0);
    expect(result.sections).toHaveLength(3);
    expect(result.sections.every((s) => !s.isComplete)).toBe(true);
  });

  it('gives partial academic credit and keeps weights in one constant', () => {
    expect(STUDENT_PROFILE_SECTION_WEIGHTS.academic).toBe(40);
    const result = getStudentProfileCompletion({
      degreeSought: 'PhD',
      intendedIntake: 'Fall 2027',
      currentUniversity: 'HUST',
    });
    const academic = result.sections.find((s) => s.id === 'academic')!;
    expect(academic.filled).toBe(3);
    expect(academic.total).toBe(6);
    expect(academic.isComplete).toBe(false);
    // 40 * (3/6) = 20
    expect(result.percent).toBe(20);
  });

  it('splits preferences into services and interests at 15% each', () => {
    const servicesOnly = getStudentProfileCompletion({
      services: [{ label: 'Study Abroad' }],
    });
    expect(servicesOnly.percent).toBe(15);

    const both = getStudentProfileCompletion({
      services: ['Work Abroad'],
      keywords: ['Computer Science'],
    });
    expect(both.percent).toBe(30);
    expect(both.sections.find((s) => s.id === 'preferences')?.isComplete).toBe(true);
  });

  it('counts resume as the full 30% section', () => {
    const result = getStudentProfileCompletion({ resume: 'resumes/cv.pdf' });
    expect(result.percent).toBe(30);
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
    });
    expect(result.percent).toBe(100);
    expect(result.sections.every((s) => s.isComplete)).toBe(true);
    expect(result.sections.map((s) => s.href)).toEqual([
      '#profile-academic',
      '#profile-preferences',
      '#profile-resume',
    ]);
  });
});
