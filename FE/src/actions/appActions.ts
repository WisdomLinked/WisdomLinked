import { actionTypes } from "./types"
import { store } from "../store"

export const updateLocation = (location: string) => {
    localStorage.setItem('location', location)
    return {
        type: actionTypes.setLocation,
        payload: location
    }
}

export const SetLoadingStatus = (loading: Boolean) => {
    store.dispatch({
        type: "SetLoadingStatus",
        payload: loading,
    })
}

export const SetTotalTimeSpent = (totalTimeSpent: any) => {
    localStorage.setItem('totalTimeSpent', totalTimeSpent)
    return {
        type: "SetTotalTimeSpent",
        payload: totalTimeSpent,
    }
}