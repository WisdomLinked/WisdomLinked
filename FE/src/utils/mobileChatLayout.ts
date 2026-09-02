export const shouldShowMobileMessenger = (
  chosenChatDetails: unknown,
  chosenGroupChatDetails: unknown,
): boolean => {
  return Boolean(chosenChatDetails || chosenGroupChatDetails);
};

