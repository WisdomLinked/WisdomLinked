export function slotsIndicesEqual(a: number[], b: number[]): boolean {
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  if (sortedA.length !== sortedB.length) return false;
  return sortedA.every((value, index) => value === sortedB[index]);
}

function rateSuffix(hourlyRate?: number): string {
  if (hourlyRate == null || Number.isNaN(hourlyRate)) return '';
  return ` ($${hourlyRate}/hr)`;
}

export function buildAvailabilitySaveSuccessMessage(opts: {
  rateChanged: boolean;
  slotsChanged: boolean;
  durationsChanged?: boolean;
  hourlyRate?: number;
}): string {
  const suffix = opts.rateChanged ? rateSuffix(opts.hourlyRate) : '';
  const changedParts: string[] = [];
  if (opts.rateChanged) changedParts.push('hourly rate');
  if (opts.slotsChanged) changedParts.push('weekly availability');
  if (opts.durationsChanged) changedParts.push('appointment durations');

  if (changedParts.length > 1) {
    const list =
      changedParts.length === 2
        ? changedParts.join(' and ')
        : `${changedParts.slice(0, -1).join(', ')}, and ${changedParts[changedParts.length - 1]}`;
    return `${list.charAt(0).toUpperCase() + list.slice(1)} saved${suffix}. Students will see your updates when booking.`;
  }
  if (opts.rateChanged) {
    return `Hourly rate saved${suffix}.`;
  }
  if (opts.slotsChanged) {
    return 'Weekly availability saved. Students will see your updated time slots when booking.';
  }
  if (opts.durationsChanged) {
    return 'Appointment durations saved. Students will only see the session lengths you offer when booking.';
  }
  return 'Availability settings saved.';
}

export function buildBookingNoticeSaveSuccessMessage(hours: number): string {
  return `Minimum booking notice set to ${hours} hours. Students can only book slots that start at least that far in advance.`;
}

export function mapAvailabilitySaveError(message: string): string {
  if (message.includes('time slots')) {
    return 'Could not save weekly availability. Please try again.';
  }
  if (message.includes('rate')) {
    return 'Could not save hourly rate. Please try again.';
  }
  if (message.includes('duration')) {
    return 'Could not save appointment durations. Please try again.';
  }
  return message || 'Could not save availability. Please try again.';
}
