import React, { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../../../store";
import { useNavigate } from "react-router-dom";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import {
    addMemberToGroup,
    doAcceptEvent,
    doCancelInvitation,
    profileImageFetch
} from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../actions/chatActions";
import Chatbot from "../../../components/chatbot";
import Dashboard from "../../../components/dashboard";

const ExpertDashboard = () => {

    const { auth: { userDetails = {} }, friends: { groupChatList } } = useAppSelector((state) => state);
    const { _id, pendingGroupChats, groupChats: groupChat, events, status } = userDetails;

    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [groupChats, set_groupChats] = useState<any>([])
    const [sessions, set_sessions] = useState<any>([])
    const [acceptedSeminars, set_acceptedSeminars] = useState<any>([])
    const [pendingInvitations, set_pendingInvitations] = useState<any>([])
    const [base64Images, setBase64Images] = useState<Map<string, string>>(new Map());
    const fetchImagesRef = useRef(false); // Ref to track image fetch calls

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
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    const navigateSeminar = (item: any) => {
        const selectedGroupChat: any = groupChatList.find((x: any) => x.groupId === item._id)
        console.log("navigate events", item);
        navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
        dispatch(setChosenGroupChatDetails(selectedGroupChat));
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
        const now = new Date().getTime();

        const updatedSessions = events.filter((item: any) => (new Date(item.end).getTime() >= now) && (item.status === 'accepted'));
        const updatedPendingInvitations = events.filter((item: any) => (new Date(item.end).getTime() >= now || !item.duration) && (item.status === 'pending'));
        const updatedGroupChats = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now);
        const updatedSeminars = groupChat.filter((item: any) => new Date(item.end).getTime() >= now);
        // console.log("updatedSeminars: ", updatedSeminars);
        // console.log("updatedgroupChats: ", updatedGroupChats);
        // console.log("updatedSessions: ", updatedSessions);

        set_sessions(updatedSessions);
        set_pendingInvitations(updatedPendingInvitations);
        set_groupChats(updatedGroupChats);
        set_acceptedSeminars(updatedSeminars);

        // Combine sessions and pendingInvitations to fetch images
        const allCustomers = [...updatedSessions, ...updatedPendingInvitations, ...groupChats, ...updatedSeminars];
        fetchImages(allCustomers);
    }, [events, pendingGroupChats, groupChat]);

    const fetchImages = async (sessionList: any[]) => {
        const uniqueCustomers = new Map<string, string>();
        sessionList.forEach((item) => {
            if (item.customer && item.customer._id && item.customer.image) {
                uniqueCustomers.set(item.customer._id, item.customer.image);
            }

            else if (item.customerId && item.customerId._id && item.customerId.image) {
                uniqueCustomers.set(item.customerId._id, item.customerId.image);
            }

            else if (item.admin && item.admin._id && item.admin.image) {
                uniqueCustomers.set(item.admin._id, item.admin.image);
            }
        });

        const imagePromises = Array.from(uniqueCustomers.entries()).map(
            async ([customerId, imageUrl]) => {
                try {
                    const base64 = await profileImageFetch(imageUrl, "small");
                    return { id: customerId, base64 };
                } catch (error) {
                    console.error(`Error fetching image for customer ${customerId}:`, error);
                    return null;
                }
            }
        );

        const images = await Promise.all(imagePromises);
        const newImageMap = new Map(base64Images);

        images.forEach((image) => {
            if (image) newImageMap.set(image.id, image.base64);
        });

        setBase64Images(newImageMap);
    };

    useEffect(() => {
        dispatch(updateMe())
    }, [])

    return (

        <Dashboard
            userId={_id}
            userStatus={status}
            userRole={"expert"}
            base64Images={base64Images}
            pendingGroupChats={pendingGroupChats}
            groupChats={groupChats}
            events={events}
            groupChatList={groupChatList}
        ></Dashboard>
        // <div className="w-full h-full mx-auto p-6 text-white overflow-y-auto">
        //     <div className="text-center text-2xl mb-6">Booked Seminar Sessions</div>
        //     {
        //         acceptedSeminars.length ?
        //             <div className="flex flex-wrap justify-center gap-6">
        //                 {
        //                     acceptedSeminars.map((item: any, index: number) => (
        //                         // <div key={index} className="w-fit p-4 bg-darkgrey">
        //                         <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
        //                             <div className="flex space-x-3 items-center">
        //                                 <Avatar
        //                                     username={item.admin.username}
        //                                     // image={item.customerId.image}
        //                                     image={base64Images.get(item.admin._id)}
        //                                 />
        //                                 <div>
        //                                     <div className="text-lg">{item.name}</div>
        //                                     {/*<div className="text-sm">{item.description}</div>*/}
        //                                 </div>
        //                             </div>
        //                             <hr className="my-2"/>
        //                             {/*<div><span className="font-bold">Expert  : </span> {item.admin.username}</div>*/}
        //                             {/*<div><span className="font-bold">Email  : </span> {item.admin.email}</div>*/}
        //                             <div><span className="font-bold">Description  : </span> {item.description}</div>
        //                             <div><span
        //                                 className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}
        //                             </div>
        //                             <div><span className="font-bold">Duration  : </span> {item.duration} min
        //                             </div>
        //                             <div><span className="font-bold">Price  : </span> ${item.price}</div>
        //                             <hr className="my-2"/>
        //                             <button
        //                                 className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                 onClick={() => navigateSeminar(item)}
        //                             >
        //                                 Go To Seminar
        //                             </button>
        //                         </div>
        //                     ))
        //                 }
        //             </div> :
        //             <div className="text-center text-lightgrey my-10">No Booked Seminar sessions</div>
        //     }

        //     <div className="text-center text-2xl my-6">Pending Seminar Sessions</div>
        //     {
        //         groupChats.length ?
        //             <div className="flex flex-wrap justify-center gap-6">
        //                 {
        //                     groupChats.map((item: any, index: number) => (
        //                         // <div key={index} className="w-fit p-4 bg-darkgrey">
        //                         <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
        //                             <div className="flex space-x-3 items-center">
        //                                 <Avatar
        //                                     username={item.customerId.username}
        //                                     image={base64Images.get(item.customerId._id)}
        //                                 />
        //                                 <div>
        //                                     <div className="text-lg">{item.customerId.username}</div>
        //                                     <div className="text-sm">{item.customerId.email}</div>
        //                                 </div>
        //                             </div>
        //                             <hr className="my-2"/>
        //                             <div><span className="font-bold">Title  : </span> {item.groupChatId.name}</div>
        //                             <div><span className="font-bold">Description  : </span> {item.groupChatId.description}</div>
        //                             <div><span
        //                                 className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}
        //                             </div>
        //                             <div><span className="font-bold">Duration  : </span> {item.groupChatId.duration} min
        //                             </div>
        //                             <div><span className="font-bold">Price  : </span> ${item.groupChatId.price}</div>
        //                             <hr className="my-2"/>
        //                             <button
        //                                 className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                 disabled={status === 'review'}
        //                                 onClick={() => acceptSeminarAppointment(item)}
        //                             >
        //                                 Accept
        //                             </button>
        //                         </div>
        //                     ))
        //                 }
        //             </div> :
        //             <div className="text-center text-lightgrey my-10">No pending seminar sessions</div>
        //     }
        //     <div className="text-center text-2xl my-6">Booked Individual Sessions</div>
        //     {
        //         sessions.length ?
        //             <div className="flex flex-wrap justify-center gap-6">
        //                 {
        //                     sessions.map((item: any, index: number) => (
        //                         // <div key={index} className="w-fit p-4 bg-darkgrey">
        //                         <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
        //                             <div className="flex space-x-3 items-center">
        //                                 <Avatar
        //                                     username={item.customer.username}
        //                                     image={base64Images.get(item.customer._id)}
        //                                 />
        //                                 <div>
        //                                     <div className="text-lg">{item.customer.username}</div>
        //                                     <div className="text-sm">{item.customer.email}</div>
        //                                 </div>
        //                             </div>
        //                             <hr className="my-2"/>
        //                             <div><span className="font-bold">Title  : </span> {item.title}</div>
        //                             <div><span
        //                                 className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}
        //                             </div>
        //                             <div><span className="font-bold">Duration  : </span> {item.duration} min</div>
        //                             <div><span className="font-bold">Price  : </span> ${item.price}</div>
        //                             <hr className="my-3"/>
        //                             {/* <button
        //                                 className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                 disabled={status === 'review'}
        //                                 onClick={() => acceptEvent(item)}
        //                             >
        //                                 Accept
        //                             </button> */}
        //                             <button
        //                                 className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                 onClick={() => navigateCustomer(item.customer)}
        //                             >
        //                                 Go to chat
        //                             </button>
        //                         </div>
        //                     ))
        //                 }
        //             </div> :
        //             <div className="text-center text-lightgrey my-10">No booked individual sessions</div>
        //     }
        //     <div className="text-center text-2xl my-6">Pending Individual Sessions</div>
        //     {
        //         pendingInvitations.length ?
        //             <div className="flex flex-wrap justify-center gap-6">
        //                 {
        //                     pendingInvitations.map((item: any, index: number) => (
        //                         // <div key={index} className="w-fit p-4 bg-darkgrey">
        //                         <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
        //                             <div className="flex space-x-3 items-center">
        //                                 <Avatar
        //                                     username={item.customer.username}
        //                                     image={base64Images.get(item.customer._id)}
        //                                 />
        //                                 <div>
        //                                     <div className="text-lg">{item.customer.username}</div>
        //                                     <div className="text-sm">{item.customer.email}</div>
        //                                 </div>
        //                             </div>
        //                             <hr className="my-2"/>
        //                             <div><span className="font-bold">Title  : </span> {item.title}</div>
        //                             <div><span
        //                                 className="font-bold">Starts at : </span> {item.start ? formatDateYYYY_MM_DD_h_m(item.start) : 'undefined'}
        //                             </div>
        //                             <div><span
        //                                 className="font-bold">Duration  : </span> {item.duration ? `${item.duration} min` : 'undefined'}
        //                             </div>
        //                             <div><span className="font-bold">Price  : </span> ${item.price}</div>
        //                             <hr className="my-3"/>
        //                             {item.paidBy === 'none' ?
        //                                 <button
        //                                     className="py-1 w-full border border-lightgrey rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                     onClick={() => cancelInvitation(item)}
        //                                 >
        //                                     Cancel
        //                                 </button>
        //                                 : <button
        //                                     className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
        //                                     onClick={() => acceptEvent(item)}
        //                                 >
        //                                     Accept
        //                                 </button>
        //                             }
        //                         </div>
        //                     ))
        //                 }
        //             </div> :
        //             <div className="text-center text-lightgrey my-10">No pending individual session</div>
        //     }
        //     <div
        //         style={{
        //             position: "fixed",
        //             bottom: "20px",
        //             right: "20px",
        //             zIndex: 1000,
        //         }}
        //     >
        //         <Chatbot/>
        //     </div>
        // </div>
    );
};

export default ExpertDashboard;
