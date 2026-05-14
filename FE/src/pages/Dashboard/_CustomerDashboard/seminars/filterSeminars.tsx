import React, { useEffect, useState } from "react";
import { doFilterSeminars, doGetKeywordsAndServices } from "../../../../api/api";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import { useAppSelector } from "../../../../store";
import OverlayPortal from "../../../../components/OverayPortal";
import SeminarDetails from "../../seminarDetails";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { filterApiServicesToCanonical } from "../../../../constants/serviceOptions";

const FilterSeminars = ({
    selectedSeminar,
    selectSeminar,
    myEvents
}: any) => {

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
    const [seminars, set_seminars] = useState<Array<any>>([])
    const [availableSeminars, set_availableSeminars] = useState<Array<any>>([])
    const [filterModalShow, set_filterModalShow] = useState(false)
    const [mobileView, set_mobileView] = useState(window.innerWidth <= 768)

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(filterApiServicesToCanonical(response.services || []))
        }
    }

    const filterSeminars = async () => {
        SetLoadingStatus(true)
        const response = await doFilterSeminars({
            name: nameFilter,
            keywords: selectedKeywords,
            services: selectedServices,
            sortBy: sortBy.value
        });

        if (response) {
            set_seminars([...response.result])
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        let temp: any = []        
        for (let i = 0; i < seminars.length; i++) {
            let available = true
            if (seminars[i].type === 'individual')
                continue
            for (let j = 0; j < myEvents.length; j++) {
                const seminarStartTime = new Date(seminars[i].start).getTime()
                const seminarEndTime = new Date(seminars[i].end).getTime()
                const eventStartTime = new Date(myEvents[j].start).getTime()
                const eventEndTime = new Date(myEvents[j].end).getTime()
                if (
                    (seminarStartTime <= eventStartTime && seminarEndTime > eventStartTime) ||
                    (seminarStartTime < eventEndTime && seminarEndTime >= eventEndTime) ||
                    (seminarStartTime > eventStartTime && seminarEndTime < eventEndTime)
                ) {
                    available = false
                    break;
                }
            }
            temp.push({
                ...seminars[i],
                isAvailable: available
            })
        }
        set_availableSeminars([...temp])
    }, [seminars, myEvents])

    useEffect(() => {
        let timer = setTimeout(() => {
            filterSeminars()
        }, 500)
        return (() => clearTimeout(timer))
    }, [nameFilter, selectedKeywords, selectedServices, sortBy])

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
            <div className="hidden w-full py-1 bg-darkgrey-1 md:grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    availableSeminars.map((seminar: any) => (
                        <div
                            key={`seminar_${seminar._id}`}
                            className={`w-[250px] p-3 rounded-md bg-darkgrey overflow-clip relative ${selectedSeminar?._id === seminar._id ? 'border-[2px] border-green' : ''}`}
                        >
                            <SeminarDetails
                                title={seminar?.name}
                                description={seminar?.description}
                                start={seminar?.start}
                                duration={seminar?.duration}
                                price={seminar?.price}
                                admin={seminar?.admin}
                                participants={seminar?.participants}
                                keywords={seminar?.keywords}
                                services={seminar?.services}
                            />
                            <div className="w-full flex space-x-4 mt-4">
                                <button
                                    className="w-[calc(50%-8px)] rounded-lg border text-lightgrey border-lightgrey flex items-center justify-center"
                                >
                                    See admin
                                </button>
                                <button
                                    className="w-[calc(50%-8px)] p-2 mx-auto rounded-[14px] flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                                    disabled={seminar?.participants?.findIndex((p: any) => p._id === userDetails?._id) > -1 || !seminar.isAvailable}
                                    onClick={() => selectSeminar(seminar)}
                                >
                                    Select
                                </button>
                            </div>
                        </div>
                    ))
                }
            </div>
            <button
                className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-grey shadow-md text-white md:hidden flex items-center justify-center"
                onClick={() => set_filterModalShow(true)}
            >
                <FilterListIcon fontSize="large" />
            </button>
            {
                filterModalShow && mobileView ?
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

export default FilterSeminars;
