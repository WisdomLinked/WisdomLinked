import { sendClarificationEmail } from './email.js';
import { CaseStatus } from '../constants/caseStatus.js';

export async function sendStatusEmail(status, { studentEmail, expertEmail, caseId }) {
  if (!studentEmail && !expertEmail) return;
  const appName = 'Wisdom Document System';

  switch (status) {
    case CaseStatus.NEEDS_INFO:
      if (studentEmail) await sendClarificationEmail(
        studentEmail,
        `[${caseId}] Additional information needed – ${appName}`,
        `Your application ${caseId} requires additional information from the review committee.\n\nPlease log in to view the feedback and submit the requested information.\n\n— ${appName}`
      );
      break;
    case CaseStatus.RESUBMITTED:
      if (expertEmail) {
        await sendClarificationEmail(
          expertEmail,
          `[${caseId}] Case resubmitted – ${appName}`,
          `The student has resubmitted case ${caseId} with additional information.\n\nPlease log in to the committee dashboard to review the updated application.\n\n— ${appName}`
        );
      }
      break;
    case CaseStatus.PENDING_ADMIN_APPROVAL:
      if (studentEmail) await sendClarificationEmail(
        studentEmail,
        `[${caseId}] Expert recommendation received – ${appName}`,
        `An expert has recommended approval for your application ${caseId}. Final approval is pending from the admission office. You will be notified when the decision is complete.\n\n— ${appName}`
      );
      break;
    case CaseStatus.ASSIGNED:
      if (studentEmail) await sendClarificationEmail(
        studentEmail,
        `[${caseId}] Case assigned for review – ${appName}`,
        `Your application ${caseId} has been assigned to an expert for review.\n\nYou will be notified when the review is complete.\n\n— ${appName}`
      );
      if (expertEmail) {
        await sendClarificationEmail(
          expertEmail,
          `[${caseId}] New case assigned to you – ${appName}`,
          `A new case ${caseId} has been assigned to you for review.\n\nPlease log in to the committee dashboard to review the application.\n\n— ${appName}`
        );
      }
      break;
    case CaseStatus.APPROVED:
      if (studentEmail) await sendClarificationEmail(
        studentEmail,
        `[${caseId}] Application approved – ${appName}`,
        `Congratulations! Your application ${caseId} has been approved.\n\n— ${appName}`
      );
      break;
    case CaseStatus.REJECTED:
      if (studentEmail) await sendClarificationEmail(
        studentEmail,
        `[${caseId}] Application update – ${appName}`,
        `Your application ${caseId} has been assessed. Please log in to view the outcome and any feedback.\n\n— ${appName}`
      );
      break;
    default:
      break;
  }
}
