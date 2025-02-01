import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { composeWithDevTools } from "redux-devtools-extension";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { authReducer } from "../reducers/authReducer";
import { alertReducer } from "../reducers/alertReducer";
import { friendsReducer } from "../reducers/friendsReducer";
import { chatReducer } from "../reducers/chatReducer";
import videoChatReducer from "../reducers/videoChatReducer";
import { roomReducer } from "../reducers/roomReducer";
import { appReducer } from "../reducers/appReducer";

const rootReducer = combineReducers({
    app: appReducer,
    auth: authReducer,
    alert: alertReducer,
    friends: friendsReducer,
    chat: chatReducer,
    videoChat: videoChatReducer,
    room: roomReducer
});

const store = createStore(
    rootReducer,
    composeWithDevTools(applyMiddleware(thunk))
);

export type RootState = ReturnType<typeof rootReducer>;

type AppDispatch = typeof store.dispatch;

// Export typed dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>();

// const useAppDispatch = () => useDispatch<AppDispatch>();
// export const useAppDispatch: () => AppDispatch = useDispatch;                                  
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export { store};
