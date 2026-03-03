const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const validateRegisterSchema = async (req, res, next) => {
    try {
        const { email, username, password } = req.body
        let isEmailValid = validateEmail(email)
        let isUsernameValid = username?.length >= 3
        let isPasswordValid = password?.length >= 6
        if (!isEmailValid || !isUsernameValid || !isPasswordValid) {
            let errorMsg = 'Error validating request body. '
            if (!isEmailValid)
                errorMsg += `"email" must be a valid email. `
            if (!isUsernameValid)
                errorMsg += `"username" length must be at least 3 characters long. `
            if (!isPasswordValid)
                errorMsg += `"password" length must be at least 6 characters long. `
            throw new Error(errorMsg)
        }
        next();
    } catch (err) {
        console.log(err.message)
        res.status(400).send(err.message);
    }
};

const validateLoginSchema = async (req, res, next) => {
    try {
        const { email, password } = req.body

        let isEmailValid = validateEmail(email)
        let isPasswordValid = password?.length >= 6


        if (!isEmailValid || !isPasswordValid) {
            let errorMsg = 'Error validating request body. '
            if (!isEmailValid)
                errorMsg += `"email" must be a valid email. `
            if (!isPasswordValid)
                errorMsg += `"password" length must be at least 6 characters long. `
            throw new Error(errorMsg)
        }
        next();
    } catch (err) {
        console.error('Login validation error:', err.message);
        console.log(err.message)
        res.status(400).send(err.message);
    }
};

module.exports = {
    validateLoginSchema,
    validateRegisterSchema
};
