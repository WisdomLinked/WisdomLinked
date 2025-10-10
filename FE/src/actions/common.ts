import { momentLocalizer } from "react-big-calendar";
import moment from "moment";
moment.locale("en-GB");

export const localizer = momentLocalizer(moment);

export const makeAnOffsetToAvailableTimeSlots = (slots: Array<any>, offset: number) => {
    if (!slots?.length) {
        return []
    }
    let temp = slots.map(slot => (slot + offset + 48) % 48)
    temp.sort((a, b) => a - b)
    return temp || []
}

export const isSlotUnavailable = (start: number, duration: number, eventStart: number, eventEnd: number) => {
    return ((start + duration) > eventStart && (start + duration) <= eventEnd)
        || (start >= eventStart && start < eventEnd)
        || (start < eventStart && (start + duration) > eventEnd)
}

export const slotToTime = (slot: number) => {
    let hh = Math.floor(slot / 2)
    let ampm = 'am'
    if (hh > 11) {
        if (hh > 12)
            hh -= 12
        ampm = 'pm'
    }
    const min = slot % 2 ? '30' : '00'
    return `${hh}:${min} ${ampm}`
}

export const formatDateYYYY_MM_DD_h_m = (dateString: any) => {
    let date = new Date(dateString);
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export const formatDateYYYY_MM_DD = (dateString: any) => {
    let date = new Date(dateString);
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

export const isTheEventGoingOn = (start: any, end: any) => {
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    const currentTime = new Date().getTime()
    return startTime <= currentTime && currentTime < endTime
}

export const isFutureEvent = (start: any) => {
    const startTime = new Date(start).getTime()
    const currentTime = new Date().getTime()
    return startTime > currentTime
}

export const arraysEqual = (arr1: any, arr2: any) => {
    const a = [...arr1].sort((a: any, b: any) => a._id?.localeCompare(b?._id));
    const b = [...arr2].sort((a: any, b: any) => a._id?.localeCompare(b?._id));
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i]._id !== b[i]._id) {
            return false;
        }
    }
    return true;
}

export const getAvatarTitle = (name: any) => {
    name = name.trim()
    name = name.split(' ')
    let title = name[0].slice(0, 1).toUpperCase()
    if (name.length > 1) {
        let count = 0
        for (let i = 1; i < name.length; i++) {
            if (name[i] && !count) {
                count++
                title += name[i].slice(0, 1).toUpperCase()
            }
        }
    } else {
        title += name[0].slice(1, 2).toUpperCase()
    }
    return title
}

export const validateEmail = (email: any) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
    }

export const formatDateHH_MM_AMPM = (date: Date) => {
    let hours = date.getHours();
    let minutes: string | number = date.getMinutes();
    let ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;
    let strTime = hours + ":" + minutes + " " + ampm;

    return strTime;
}

export const formatDate = (date: Date) => {
    const now = new Date().getTime();
    const targetDate = new Date(date).getTime();
    const timeDiff = now - targetDate;

    if (timeDiff < 24 * 60 * 60 * 1000) { // Within today
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (timeDiff < 12 * 30 * 24 * 60 * 60 * 1000) { // Within last 12 months
        return `${date.getMonth() + 1}/${date.getDate()}`;
    } else { // Before than 12 months ago
        return date.getFullYear().toString();
    }
}

export const checkTitleNameInvalid = (title: string, str: string) => {
    if (str.toLowerCase() === 'general chat' || str.toLowerCase() === 'admin' || str.toLowerCase() === 'global chat') {
        return `Words "General Chat", "Admin" and "Global Chat" are not available for ${title}`
    } else {
        return false
    }
}

// export const getBase64FromImageURL = async (url: string) => {
//     try {
//         const response = await fetch(url);
//         const blob = await response.blob();
//         const base64Data = await new Promise((resolve) => {
//             const reader = new FileReader();
//             reader.onloadend = () => resolve(reader.result);
//
//             reader.readAsDataURL(blob);
//         });
//         return base64Data
//     } catch (error) {
//         console.error("Error converting image:", error);
//         return false;
//     }
// };


