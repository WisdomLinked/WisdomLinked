import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../../store";
import { useNavigate } from "react-router-dom";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import { addMemberToGroup, doAcceptEvent, doCancelInvitation } from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { setChosenChatDetails } from "../../../actions/chatActions";


const Dashboard = () => {

    const { auth: { userDetails: { pendingGroupChats, events, status } } } = useAppSelector(state => state)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [groupChats, set_groupChats] = useState<any>([])
    const [sessions, set_sessions] = useState<any>([])
    const [pendingInvitations, set_pendingInvitations] = useState<any>([])

    const acceptSeminarAppointment = async (data: any) => {
        const response = await addMemberToGroup({
            _id: data._id,
            friendId: data.customerId._id,
            groupChatId: data.groupChatId._id
        })
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    const acceptEvent = async (event: any) => {
        console.log("accept events", event)
        SetLoadingStatus(true)
        const response = await doAcceptEvent(event._id)
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    const navigateCustomer = (item: any) => {
        console.log("navigate events", item); // Use item here instead of event
        navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
        // Assuming item contains customer details, you can use item directly
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    const cancelInvitation = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doCancelInvitation(event._id)
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        const now = new Date().getTime()
        let temp: any = events.filter((item: any) => (new Date(item.end).getTime() >= now) && (item.status === 'accepted'))
        set_sessions([...temp])

        temp = events.filter((item: any) => (new Date(item.end).getTime() >= now || !item.duration) && (item.status === 'pending'))
        set_pendingInvitations([...temp])

        temp = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now)
        set_groupChats([...temp])
    }, [events, pendingGroupChats])

    useEffect(() => {
        dispatch(updateMe())
    }, [])

    return (
        <div className="w-full h-full mx-auto p-6 text-white overflow-y-auto">
            <div className="text-center text-2xl mb-6">Seminar appointments </div>
            {
                groupChats.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            groupChats.map((item: any, index: number) => (
                                <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.customerId.username}
                                            image={item.customerId.image}
                                        />
                                        <div>
                                            <div className="text-lg">{item.customerId.username}</div>
                                            <div className="text-sm">{item.customerId.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2" />
                                    <div><span className="font-bold">Title  : </span> {item.groupChatId.name}</div>
                                    <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}</div>
                                    <div><span className="font-bold">Duration  : </span> {item.groupChatId.duration} min</div>
                                    <div><span className="font-bold">Price  : </span> ${item.groupChatId.price}</div>
                                    <hr className="my-2" />
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        disabled={status === 'review'}
                                        onClick={() => acceptSeminarAppointment(item)}
                                    >
                                        Accept
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }
            <div className="text-center text-2xl my-6">Session appointments </div>
            {
                sessions.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            sessions.map((item: any, index: number) => (
                                <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.customer.username}
                                            image={item.customer.image}
                                        />
                                        <div>
                                            <div className="text-lg">{item.customer.username}</div>
                                            <div className="text-sm">{item.customer.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2" />
                                    <div><span className="font-bold">Title  : </span> {item.title}</div>
                                    <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}</div>
                                    <div><span className="font-bold">Duration  : </span> {item.duration} min</div>
                                    <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                    <hr className="my-3" />
                                    {/* <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        disabled={status === 'review'}
                                        onClick={() => acceptEvent(item)}
                                    >
                                        Accept
                                    </button> */}
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        onClick={() => navigateCustomer(item.customer)}
                                    >
                                        Go to chat
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }
            <div className="text-center text-2xl my-6">Pending invitations </div>
            {
                pendingInvitations.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            pendingInvitations.map((item: any, index: number) => (
                                <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.customer.username}
                                            image={item.customer.image}
                                        />
                                        <div>
                                            <div className="text-lg">{item.customer.username}</div>
                                            <div className="text-sm">{item.customer.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2" />
                                    <div><span className="font-bold">Title  : </span> {item.title}</div>
                                    <div><span className="font-bold">Starts at : </span> {item.start ? formatDateYYYY_MM_DD_h_m(item.start) : 'undefined'}</div>
                                    <div><span className="font-bold">Duration  : </span> {item.duration ? `${item.duration} min` : 'undefined'}</div>
                                    <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                    <hr className="my-3" />
                                    {item.paidBy==='none'?
                                        <button
                                            className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                            onClick={() => cancelInvitation(item)}
                                        >
                                            Cancel
                                        </button>
                                        :<button
                                            className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                            onClick={() => acceptEvent(item)}
                                        >
                                            Accept
                                        </button>
                                    }
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }
        </div>
    );
};

export default Dashboard;
