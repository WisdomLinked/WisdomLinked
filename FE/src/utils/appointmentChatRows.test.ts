import { describe, expect, it } from 'vitest';
import {
  appointmentChatRows,
  appointmentCounterpart,
  appointmentPersonName,
  isChatableAppointment,
  matchesAppointmentQuery,
  type AppointmentChatRow,
} from './appointmentChatRows';

const ME = 'student-1';
const EXPERT = { _id: 'expert-1', username: 'Dr Wang', email: 'wang@example.com', image: 'w.png' };
const STUDENT = { _id: ME, username: 'Asha', email: 'asha@example.com', image: null };

const appointment = (over: Record<string, any> = {}) => ({
  _id: 'appt-1',
  name: 'Thermodynamics Prep Session',
  type: 'individual',
  status: 'active',
  participants: [STUDENT, EXPERT],
  admin: EXPERT,
  rcChannelId: 'rid-appt-1',
  ...over,
});

describe('which appointments have a chat', () => {
  it('accepts a confirmed 1:1 appointment', () => {
    expect(isChatableAppointment(appointment())).toBe(true);
  });

  it('rejects a proposal nobody has accepted yet', () => {
    expect(isChatableAppointment(appointment({ status: 'pending' }))).toBe(false);
  });

  it('rejects a cancelled appointment, so no row is left behind', () => {
    expect(isChatableAppointment(appointment({ status: 'cancelled' }))).toBe(false);
  });

  it('keeps a finished appointment, which stays active because there is no completed state', () => {
    const over = appointment({ end: '2020-01-01T00:00:00.000Z' });
    expect(isChatableAppointment(over)).toBe(true);
  });

  it('rejects seminars and communities', () => {
    expect(isChatableAppointment(appointment({ type: 'seminar' }))).toBe(false);
    expect(isChatableAppointment(appointment({ type: 'community' }))).toBe(false);
  });

  it('tolerates casing and padding on the stored values', () => {
    expect(isChatableAppointment(appointment({ type: ' Individual ', status: 'ACTIVE' }))).toBe(true);
  });

  it('rejects junk input rather than throwing', () => {
    expect(isChatableAppointment(null)).toBe(false);
    expect(isChatableAppointment(undefined)).toBe(false);
    expect(isChatableAppointment({})).toBe(false);
  });
});

describe('who the appointment is with', () => {
  it('is the expert when the viewer is the student', () => {
    expect(appointmentCounterpart(appointment(), ME)).toEqual(EXPERT);
  });

  it('is the student when the viewer is the expert', () => {
    expect(appointmentCounterpart(appointment(), 'expert-1')).toEqual(STUDENT);
  });

  it('falls back to the admin when they are not also listed as a participant', () => {
    const over = appointment({ participants: [STUDENT] });
    expect(appointmentCounterpart(over, ME)).toEqual(EXPERT);
  });

  it('accepts a viewer id passed as an object rather than a string', () => {
    expect(appointmentCounterpart(appointment(), { _id: ME })).toEqual(EXPERT);
  });

  it('returns null when the viewer is the only person on it', () => {
    const over = appointment({ participants: [STUDENT], admin: STUDENT });
    expect(appointmentCounterpart(over, ME)).toBeNull();
  });

  it('names a person by username, falling back to email', () => {
    expect(appointmentPersonName(EXPERT)).toBe('Dr Wang');
    expect(appointmentPersonName({ email: 'only@example.com' })).toBe('only@example.com');
    expect(appointmentPersonName(null)).toBe('');
  });
});

describe('building the appointment rows', () => {
  it('titles the row with the appointment and names the other person beneath it', () => {
    const rows = appointmentChatRows([appointment()], ME);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Thermodynamics Prep Session');
    expect(rows[0].withName).toBe('Dr Wang');
    expect(rows[0].withUserId).toBe('expert-1');
    expect(rows[0].rcChannelId).toBe('rid-appt-1');
  });

  it('keeps every confirmed appointment with the same person as its own row', () => {
    const rows = appointmentChatRows(
      [appointment(), appointment({ _id: 'appt-2', name: 'Fluid Mechanics Review' })],
      ME,
    );
    expect(rows.map(r => r.name)).toEqual([
      'Thermodynamics Prep Session',
      'Fluid Mechanics Review',
    ]);
  });

  it('leaves out seminars, communities, pending and cancelled rows', () => {
    const rows = appointmentChatRows(
      [
        appointment(),
        appointment({ _id: 's', type: 'seminar' }),
        appointment({ _id: 'c', type: 'community' }),
        appointment({ _id: 'p', status: 'pending' }),
        appointment({ _id: 'x', status: 'cancelled' }),
      ],
      ME,
    );
    expect(rows.map(r => r._id)).toEqual(['appt-1']);
  });

  it('never emits the same appointment twice', () => {
    const one = appointment();
    expect(appointmentChatRows([one, one], ME)).toHaveLength(1);
  });

  it('still renders a title when the appointment has no name stored', () => {
    const rows = appointmentChatRows([appointment({ name: '  ' })], ME);
    expect(rows[0].name).toBe('1:1 Appointment');
  });

  it('leaves rcChannelId undefined until the room exists', () => {
    const rows = appointmentChatRows([appointment({ rcChannelId: null })], ME);
    expect(rows[0].rcChannelId).toBeUndefined();
  });

  it('returns nothing for empty, null or undefined input', () => {
    expect(appointmentChatRows([], ME)).toEqual([]);
    expect(appointmentChatRows(null, ME)).toEqual([]);
    expect(appointmentChatRows(undefined, ME)).toEqual([]);
  });
});

describe('searching the appointment list', () => {
  const row = (over: Partial<AppointmentChatRow> = {}): AppointmentChatRow => ({
    _id: 'a',
    name: 'Thermodynamics Prep Session',
    withName: 'Dr Wang',
    raw: {},
    ...over,
  });

  it('matches the appointment name', () => {
    expect(matchesAppointmentQuery(row(), 'thermo')).toBe(true);
  });

  it('matches the person the appointment is with', () => {
    expect(matchesAppointmentQuery(row(), 'wang')).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(matchesAppointmentQuery(row(), '  DR WANG ')).toBe(true);
  });

  it('matches nothing that appears in neither field', () => {
    expect(matchesAppointmentQuery(row(), 'calculus')).toBe(false);
  });

  it('keeps every row when the box is empty', () => {
    expect(matchesAppointmentQuery(row(), '')).toBe(true);
    expect(matchesAppointmentQuery(row(), '   ')).toBe(true);
  });
});
