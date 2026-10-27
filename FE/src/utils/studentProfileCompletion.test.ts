import { describe, expect, it } from 'vitest';
import { getStudentProfileCompletion } from './studentProfileCompletion';

describe('getStudentProfileCompletion', () => {
  it('returns 0% for an empty profile', () => {
    const result = getStudentProfileCompletion({});
    expect(result.percent).toBe(0);
    expect(result.sections).toHaveLength(4);
    expect(result.sections.every(section => !section.isComplete)).toBe(true);
  });

  it('uses filled fields over total fields for the overall percent', () => {
    const result = getStudentProfileCompletion({
      degreeSought: 'PhD',
      intendedIntake: 'Fall 2027',
      currentUniversity: 'HUST',
    });
    const academic = result.sections.find(section => section.id === 'academic')!;
    expect(academic.filled).toBe(3);
    expect(academic.total).toBe(6);
    expect(academic.isComplete).toBe(false);
    // 3 of 10 fields
    expect(result.percent).toBe(30);
  });

  it('splits preferences into services and interests', () => {
    const servicesOnly = getStudentProfileCompletion({
      services: [{ label: 'Study Abroad' }],
    });
    expect(servicesOnly.percent).toBe(10);

    const slugService = getStudentProfileCompletion({
      services: [{ value: 'study_abroad' }],
    });
    expect(slugService.percent).toBe(10);

    const both = getStudentProfileCompletion({
      services: ['Work Abroad'],
      keywords: ['Computer Science'],
    });
    expect(both.percent).toBe(20);
    expect(both.sections.find(section => section.id === 'preferences')?.isComplete).toBe(true);
  });

  it('counts numeric GPA the same as a string GPA', () => {
    const result = getStudentProfileCompletion({ gpa: 3.75 });
    expect(result.sections.find(section => section.id === 'academic')?.filled).toBe(1);
    expect(result.percent).toBe(10);
  });

  it('counts resume as one of the total fields', () => {
    const result = getStudentProfileCompletion({ resume: 'resumes/cv.pdf' });
    expect(result.percent).toBe(10);
    expect(result.sections.find(section => section.id === 'resume')?.isComplete).toBe(true);
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
    expect(unsigned.sections.find(section => section.id === 'terms')?.isComplete).toBe(false);
    const signed = getStudentProfileCompletion({ roleTermsSigned: true });
    expect(signed.sections.find(section => section.id === 'terms')?.isComplete).toBe(true);
    expect(signed.percent).toBe(10);
  });

  it('reaches 100% when every field is filled', () => {
    const result = getStudentProfileCompletion({
      degreeSought: "Master's",
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
    expect(result.sections.every(section => section.isComplete)).toBe(true);
    expect(result.sections.map(section => section.href)).toEqual([
      '#profile-academic',
      '#profile-preferences',
      '#profile-resume',
      '#terms-agreement',
    ]);
  });

  it('matches section labels with the overall field percent', () => {
    const result = getStudentProfileCompletion({
      degreeSought: 'PhD',
      intendedIntake: 'Fall 2027',
      currentUniversity: 'HUST',
      gpa: '3.8',
      services: ['Study Abroad'],
      keywords: ['CS'],
      resume: 'cv.pdf',
      roleTermsSigned: true,
    });
    const complete = result.sections.filter(section => section.isComplete).length;
    expect(complete).toBe(3);
    // 4 of 6 academic + 2 + 1 + 1 = 8 of 10
    expect(result.percent).toBe(80);
  });
});
