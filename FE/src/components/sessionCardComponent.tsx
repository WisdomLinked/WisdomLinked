import { formatDateYYYY_MM_DD_h_m } from "../actions/common"
import { Session, User } from "../api/types";
import Avatar from "./Avatar";

interface SessionCardComponentProps {
    key: number;
    image: string | undefined; // The base64 image string
    session: Session; // The session object containing session details

    userId: string;
    userStatus: string;
    userRole: string;

    onCancel: Function;
    onEdit: Function;
    onNavigate: Function;
    onAccept: Function;

}
const SessionCardComponent = (props: SessionCardComponentProps) => {


    const editButton = (
        <button
            className="text-white py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
            disabled={props.userStatus === 'review'}
            onClick={() => props.onEdit(props.session)}
        >
            Edit
        </button>
    )

    const chatButton = (
        <button
            className="text-white py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
            onClick={() => props.onNavigate(props.session.expert)}
        >
            Chat
        </button>
    )

    const cancelButton = (
        <button
            className="text-white py-1 w-full border border-lightgrey rounded-lg flex items-center justify-center disabled:opacity-50 transition-alll duration-200 hover:bg-green"
            onClick={() => props.onCancel(props.session)}
        >
            Cancel
        </button>
    )

    const acceptButton = (
        <button
            className="text-white py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
            onClick={() => props.onAccept(props.session)}
        >
            Accept
        </button>
    )


    const getButtonsToDisplay = (userRole: string, sessionStatus: string, sessionCreatedBy: string) => {
        const buttonsToDisplay = [];

        if (sessionStatus === 'accepted') {
            if (userRole === 'customer') {
                buttonsToDisplay.push(editButton);
            }
            buttonsToDisplay.push(chatButton);
        }
        // TODO: Check if an accepted session can be cancelled
        if (sessionCreatedBy === props.userId) {
            buttonsToDisplay.push(cancelButton);
        } else {
            if (sessionStatus !== 'accepted') {
                buttonsToDisplay.push(acceptButton);
            }
        }

        return buttonsToDisplay;
    }

    return (
        <div key={props.key} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:shadow-lg overflow-hidden">
            <div className="flex space-x-3 items-center">
                <Avatar
                    username={props.session.expert.username}
                    image={props.image}
                />
                <div>
                    <div className="text-white text-lg">{props.session.expert.username}</div>
                    <div className="text-white text-sm">{props.session.expert.email}</div>
                </div>
            </div>
            <hr className="my-2" />
            <div><span className="text-white font-bold">Title  : </span> <span className="text-white">{props.session.title}</span></div>
            <div><span className="text-white font-bold">Starts at : </span> <span className="text-white">{formatDateYYYY_MM_DD_h_m(props.session.start)}</span></div>
            <div><span className="text-white font-bold">Duration  : </span> <span className="text-white">{props.session.duration} min</span></div>
            <div><span className="text-white font-bold">Price  : </span> <span className="text-white">${props.session.price}</span></div>
            <hr className="my-3" />
            <div className="w-full flex justify-center space-x-4">
                {getButtonsToDisplay(props.userRole, props.session.status, props.session.createdBy).map((button, index) => {
                    return (
                        <div className="w-full flex justify-center space-x-4" key={index}>
                            {button}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default SessionCardComponent