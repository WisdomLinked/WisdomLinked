export const fetchTimeZone = async (lat: number, lng: number): Promise<any> => {
    const apiKey = process.env.TIMEZONE_API_KEY;

    try {
        const response = await fetch(`https://api.timezonedb.com/v2.1/get-time-zone?key=TJ1H0FJT1K7W&format=json&by=position&lat=${lat}&lng=${lng}`,{
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials":"true",

            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.status === 'OK') {
            console.log('Time Zone:', data.zoneName);
            console.log('Local Time:', data.formatted);
        } else {
            console.error('Error:', data.message);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
};