const axios = require("axios");

exports.getCurrentDateString = () => {
    const date = new Date();

    let currentDay = String(date.getDate()).padStart(2, '0');

    let currentMonth = String(date.getMonth() + 1).padStart(2, "0");

    let currentYear = date.getFullYear();

    let currentDate = `${currentDay}-${currentMonth}-${currentYear}`;

    return currentDate;
}

exports.sendOTP = (targetEmail, todays_date_str, smurf_details_str) => {
    var data = JSON.stringify({
        "from": {
            "email": "varunsahni286@gmail.com"
        },
        "personalizations": [{
            "to": [
                {
                    "email": targetEmail
                }
            ],
            "dynamic_template_data": {
                "todays_date": todays_date_str,
                "smurf_details": smurf_details_str
            }
        }],
        "template_id": "d-46afc30a193342d5b3795022b0fc4c53"
    });

    console.log("OTP Email Data: ", data);

    var config = {
        method: 'post',
        url: 'https://api.sendgrid.com/v3/mail/send',
        headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_APIKEY}`,
            'Content-Type': 'application/json'
        },
        data: data
    };

    axios(config)
        .then(function (response) {
            console.log(JSON.stringify(response.data));
        })
        .catch(function (error) {
            console.log(error);
        });

}