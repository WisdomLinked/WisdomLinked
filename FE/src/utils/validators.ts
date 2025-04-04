export const validateLoginForm = ({ email, password }: {email: string, password: string}) => {
    const isMailValid = validateMail(email);
    const isPasswordValid = validatePassword(password);

    return isMailValid && isPasswordValid;
};

export const validateRegisterForm = ({
    email,
    password,
    username,
}: {
    email: string;
    password: string;
    username: string
}) => {
    return (
        validateMail(email) &&
        validatePassword(password) &&
        validateUsername(username)
    );
};

const validatePassword = (password: string) => {
    return password.length > 5;
};

export const validateMail = (email: string) => {
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailPattern.test(email);
};

const validateUsername = (username: string) => {
    return username.length > 2 && username.length < 13;
};

export const validateGroupName = (name: string) => {
    return name.length > 2 && name.length < 13;
};

export const validateImageSize = (imageSrc : string) => {
    if(!imageSrc) return;
    // Remove the Base64 metadata if present
    const cleanedBase64 = imageSrc?.split(",")[1] || imageSrc;
    // Calculate the size in bytes
    const sizeInBytes = (cleanedBase64.length * 3) / 4 - (cleanedBase64.endsWith("==") ? 2 : cleanedBase64.endsWith("=") ? 1 : 0);

    // Convert to kilobytes (optional)
    const sizeInKB = sizeInBytes / 1024;

    // Check if the size exceeds 1MB (1024KB)
    if (sizeInKB > 1024) {
        return false; // Image is larger than 1MB
    } else {
        return true; // Image is within the size limit
    }
}