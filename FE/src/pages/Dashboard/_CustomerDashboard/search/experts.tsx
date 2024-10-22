import React, { useEffect, useState } from "react";
import { doFilterExperts, doGetKeywordsAndServices, joinGeneralChat } from "../../../../api/api";
import { getAvatarTitle } from "../../../../actions/common";
import { Rating } from "@mui/material";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import { useAppSelector } from "../../../../store";
import OverlayPortal from "../../../../components/OverayPortal";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { updateMe } from "../../../../actions/authActions";
import { useDispatch } from "react-redux";
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";

const Experts = ({
    qExpertId,
    selectedExpert,
    selectExpert
}: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const sorts = [
        {
            value: "Name in ASC",
            label: "Name in ASC"
        },
        {
            value: "Name in DESC",
            label: "Name in DESC"
        },
        {
            value: "Price in ASC",
            label: "Price in ASC"
        },
        {
            value: "Price in DESC",
            label: "Price in DESC"
        }
    ]
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>(userDetails.keywords || [])
    const [selectedServices, set_selectedServices] = useState<Array<any>>(userDetails.services || [])
    const [sortBy, set_sortBy] = useState(sorts[0])
    const [nameFilter, set_nameFilter] = useState('')
    const [experts, set_experts] = useState<Array<any>>([])
    const [filterModalShow, set_filterModalShow] = useState(false)
    const [mobileView, set_mobileView] = useState(window.innerWidth <= 768)

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(response.services || [])
        }
    }

    const filterExperts = async () => {
        SetLoadingStatus(true)
        const response = await doFilterExperts({
            _id: qExpertId,
            username: nameFilter,
            keywords: selectedKeywords,
            services: selectedServices,
            sortBy: sortBy.value
        });

        if (response) {
            console.log(response.result, '========')
            set_experts([...response.result])
            if (qExpertId) {
                selectExpert(response.result?.[0])
            }
        }
        SetLoadingStatus(false)
    }

    const joinGeneralChatOfExpert = async (otherUserId: string) => {
        SetLoadingStatus(true)
        const response = await joinGeneralChat(otherUserId)
        if (response) {
            const currentGeneralChat = response.user.generalChats.find((x: any) => x.admin._id === otherUserId)
            dispatch({
                type: 'updateUserDetails',
                payload: response.user
            })
            dispatch(setChosenGroupChatDetails({
                ...currentGeneralChat,
                groupId: currentGeneralChat._id,
                groupName: currentGeneralChat.name,
            }))
            navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`)
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        let timer = setTimeout(() => {
            filterExperts()
        }, 500)
        return (() => clearTimeout(timer))
    }, [qExpertId, nameFilter, selectedKeywords, selectedServices, sortBy])

    useEffect(() => {
        getKeywordsAndServices()
        window.addEventListener('resize', () => {
            set_mobileView(window.innerWidth <= 768)
        })
        return () => {
            window.removeEventListener('resize', () => {
                set_mobileView(window.innerWidth <= 768)
            })
        }
    }, [])

    return (
        <div className="w-full h-full relative text-white">
            <div className={`hidden w-full py-1 bg-darkgrey-1 md:grid grid-cols-1 md:grid-cols-2 gap-4 ${qExpertId ? 'md:hidden' : ''}`}>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by name</div>
                    <input
                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                        placeholder="Input name"
                        value={nameFilter}
                        onChange={(e) => set_nameFilter(e.target.value)}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort by</div>
                    <SelectionWithCheckBox
                        options={sorts}
                        selectedOptions={sortBy}
                        set_selectedOptions={set_sortBy}
                        placeholder="Sort by"
                        isMulti={false}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by majors</div>
                    <SelectionWithCheckBox
                        options={keywords}
                        selectedOptions={selectedKeywords}
                        set_selectedOptions={set_selectedKeywords}
                        placeholder="Select majors"
                        isMulti={true}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by services</div>
                    <SelectionWithCheckBox
                        options={services}
                        selectedOptions={selectedServices}
                        set_selectedOptions={set_selectedServices}
                        placeholder="Select services"
                        isMulti={true}
                    />
                </div>
            </div>
            <div className="w-full flex flex-wrap justify-center mt-6 gap-6 pb-6">
                {
                    experts.map((expert) => (
                        <div
                            key={`expert_${expert._id}`}
                            className={`w-[250px] rounded-md bg-darkgrey overflow-clip hoverBox relative ${selectedExpert?._id === expert._id ? 'border-[2px] border-green' : ''}`}
                        >
                            <div className="absolute top-0 left-0 w-full h-[250px] bg-black bg-opacity-10 backdrop-blur-sm hidden">
                                <div className="w-full max-h-full overflow-y-auto">
                                    <div className="w-full h-fit m-auto overflow-y-auto !flex flex-col justify-center items-center text-base space-y-2 p-4 text-white">
                                        <div className="w-full">
                                            <span className="text-green font-bold">Bio : </span>
                                            {expert.description}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-green font-bold">Majors : </span>
                                            {
                                                expert.keywords?.map((keyword: any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={keyword._id}>{keyword.value}</span>)
                                            }
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-green font-bold">Services : </span>
                                            {
                                                expert.services?.map((service: any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={service._id}>{service.value}</span>)
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full h-[250px] bg-midgrey !flex items-center justify-center">
                                {
                                    expert.image ?
                                        <img src={`${process.env.REACT_APP_SERVER_URL}/${expert.image}`} className="w-full h-full object-cover object-center" /> :
                                        <div className="w-[100px] h-[100px] rounded-full border-2 border-lightgrey text-4xl text-white font-bold !flex items-center justify-center">
                                            {getAvatarTitle(expert.username)}
                                        </div>
                                }
                            </div>
                            <div className="w-full p-2 pb-3 !flex flex-col items-center justify-center">
                                <div className="text-2xl text-center text-white font-bold">{expert.username}</div>
                                <div className="text-md text-center text-lightgrey">{expert.title}</div>
                                <div className="text-md text-center text-lightgrey">${expert.price} / hour</div>
                                <Rating name="read-only" className="mt-2" value={expert.rating || 0} readOnly />
                                <div className="w-full flex space-x-4 mt-4">
                                    <button
                                        className="w-[calc(50%-8px)] rounded-lg border text-lightgrey border-lightgrey flex items-center justify-center"
                                        onClick={() => joinGeneralChatOfExpert(expert._id)}
                                    >
                                        General Chat
                                    </button>
                                    <button
                                        className="w-[calc(50%-8px)] p-2 mx-auto rounded-[14px] flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                                        disabled={expert.status === 'review'}
                                        onClick={() => selectExpert(expert)}
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
            <button
                className={`fixed bottom-4 right-4 w-14 h-14 rounded-full bg-grey shadow-md text-white md:hidden flex items-center justify-center ${qExpertId ? 'hidden' : ''}`}
                onClick={() => set_filterModalShow(true)}
            >
                <FilterListIcon fontSize="large" />
            </button>
            {
                filterModalShow && mobileView && !qExpertId ?
                    <OverlayPortal closeModal={() => set_filterModalShow(false)}>
                        <div className="absolute bottom-0 left-0 w-full h-full bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-end">
                            <div className="absolute top-0 left-0 w-full h-full" onClick={() => set_filterModalShow(false)}></div>
                            <div className="relative z-10 px-6 py-10 bg-darkgrey-1 text-white w-full h-max max-h-[90vh] overflow-y-auto">
                                <button
                                    className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                    onClick={() => set_filterModalShow(false)}
                                >
                                    <CloseIcon />
                                </button>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by name</div>
                                    <input
                                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                                        placeholder="Input name"
                                        value={nameFilter}
                                        onChange={(e) => set_nameFilter(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort by</div>
                                    <SelectionWithCheckBox
                                        options={sorts}
                                        selectedOptions={sortBy}
                                        set_selectedOptions={set_sortBy}
                                        placeholder="Sort by"
                                        isMulti={false}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by majors</div>
                                    <SelectionWithCheckBox
                                        options={keywords}
                                        selectedOptions={selectedKeywords}
                                        set_selectedOptions={set_selectedKeywords}
                                        placeholder="Select majors"
                                        isMulti={true}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by services</div>
                                    <SelectionWithCheckBox
                                        options={services}
                                        selectedOptions={selectedServices}
                                        set_selectedOptions={set_selectedServices}
                                        placeholder="Select services"
                                        isMulti={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </OverlayPortal> :
                    null
            }

        </div>
    );
};

export default Experts;
