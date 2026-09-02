import { AlertActions, actionTypes } from '../actions/types';
import type { AlertVariant } from '../types/alert';
import { DEFAULT_ALERT_VARIANT } from '../types/alert';

const initialState = {
    open: false,
    message: '',
    variant: DEFAULT_ALERT_VARIANT as AlertVariant,
};

export interface AlertState {
    open: boolean;
    message: string;
    variant: AlertVariant;
}

export const alertReducer = (state = initialState, action: AlertActions): AlertState => {
    switch (action.type) {
        case actionTypes.showAlert:
            return {
                open: true,
                message: action.payload.message,
                variant: action.payload.variant ?? DEFAULT_ALERT_VARIANT,
            };

        case actionTypes.hideAlert:
            return {
                open: false,
                message: '',
                variant: DEFAULT_ALERT_VARIANT,
            };

        default:
            return state;
    }
};
