
const checkTitleNameInvalid = (title, str) => {
    if (str.toLowerCase() === 'general chat' || str.toLowerCase() === 'admin' || str.toLowerCase() === 'global chat') {
        return `Words "General Chat", "Admin" and "Global Chat" are not available for ${title}`
    } else {
        return false
    }
}

module.exports = {
    checkTitleNameInvalid
}