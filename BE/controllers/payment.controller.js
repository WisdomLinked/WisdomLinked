const PaymentHistory = require("../models/PaymentHistory");

const appendPaymentHistory = async (data) => {
    try {
        const newPaymentHistory = new PaymentHistory(data)
        await newPaymentHistory.save()
        return true
    } catch (err) {
        console.log(err)
        return false;
    }
}

module.exports = {
    appendPaymentHistory
}
