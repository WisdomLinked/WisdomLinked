import React, { useState } from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../actions/common";
import Avatar from "../../components/Avatar";
import GroupParticipantsDialog from "./Messenger/Messages/GroupParticipantsDialog";
import { useAppSelector } from "../../store";

const SeminarDetails = ({
    title,
    description,
    start,
    duration,
    price, 
    admin,
    participants,
    keywords,
    services
}:any) => {

    const [showParticipants, set_showParticipants] = useState(false);
    const { auth: { userDetails } } = useAppSelector((state) => state);

    return (
        <div className="w-full text-white">
            <div className="text-2xl font-bold  text-center">{title}</div>
            <div className="text-base text-center">{description}</div>
            <hr className="my-2"/>
            {
                keywords?.length &&
                <div className="flex flex-wrap gap-1">
                    <span className="font-bold">Majors : </span>
                    {
                        keywords?.map((keyword:any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={keyword._id}>{keyword.value}</span>)
                    }
                </div>
            }
            {
                services?.length &&
                <div className="flex flex-wrap gap-1 mt-0.5">
                    <span className="font-bold">Services : </span>
                    {
                        services?.map((service:any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={service._id}>{service.value}</span>)
                    }
                </div>
            }
            <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(start)}</div>
            <div><span className="font-bold">Duration  : </span> {duration} min</div>
            <div><span className="font-bold">Price  : </span> ${price}</div>
            <hr className="my-2"/>
            <div className="font-bold">Admin</div>
            <div className="flex space-x-3 items-center">
                <Avatar username={admin.username} isOnline={false} image={admin.image}/>
                <div>
                    <div className="text-xl font-bold">{admin.username}</div>
                    <div className="text-base">{admin.email}</div>
                </div>
            </div>
            <div className="font-bold mt-2">Participants ({participants.length - 1})</div>
            {
                participants.length > 1 ?
                    <div className="flex items-center justify-between">
                        <div className="flex -space-x-3 mt-1">
                            {
                                participants.slice(1,4).map((participant:any, index: number) => 
                                    <div key={index} className="w-fit h-fit rounded-full bg-black" style={{zIndex: index}}>
                                        <Avatar username={participant.username} isOnline={false} image={participant.image}/>
                                    </div>
                                )
                            }
                        </div>
                        <button className="text-green font-bold" onClick={() => set_showParticipants(true)}>View All</button>
                    </div> :
                    <div className="text-grey text-center font-bold">No Participants</div>
            }
            
            <GroupParticipantsDialog
                isDialogOpen={showParticipants}
                closeDialogHandler={() => set_showParticipants(false)}
                groupDetails={{
                    groupName: title,
                    participants: participants,
                    admin: participants[0]
                }}
                currentUserId={userDetails._id}
            />
        </div>
    );
};

export default SeminarDetails;
