import React, { useEffect, useState } from "react";
import { doFilterPaymentHistories, getStripeMode, setStripeMode } from "../../../api/api";
import { SetLoadingStatus } from "../../../actions/appActions";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import { DateRangePicker, createStaticRanges } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import Pagination from "../../../components/Pagination";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentDate = new Date().getDate();

const Payment = () => {
    const modes = [
        {
            value: "",
            label: "All"
        },
        {
            value: "test",
            label: "Test"
        },
        {
            value: "live",
            label: "Live"
        }
    ]
    const types = [
        {
            value: "",
            label: "All"
        },
        {
            value: "charge",
            label: "Charge"
        },
        {
            value: "refund",
            label: "Refund"
        }
    ]
    const [stripeMode, set_stripeMode] = useState('test');
    const [email, set_email] = useState('');
    const [selectedMode, set_selectedMode] = useState(modes[0]);
    const [selectedType, set_selectedType] = useState(types[0]);
    const [dateRange, set_dateRange] = useState({
        dateFrom: '',
        dateTo: '',
    });
    const [datePickerShow, set_datePickerShow] = useState(false);

    const [numPerPage, set_numPerPage] = useState<any>(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(-1)
    const [totalPage, set_totalPage] = useState(0)
    const [histories, set_histories] = useState<Array<any>>([])
    const [isFirstLoad, set_isFirstLoad] = useState(true)

    const customStaticRanges = [
        ...createStaticRanges([
            {
                label: ' Last month',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 2, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last quarter',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 4, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last 6 months',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 7, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last year',
                range: () => ({
                    startDate: new Date(currentYear - 1, currentMonth - 1, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
        ]),
    ];

    const formatDateYYYY_MM_DD = (dateString: string) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const day = `0${date.getDate()}`.slice(-2);
        return `${year}-${month}-${day}`;
    };

    const [selectionRange, set_selectionRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: 'selection',
    });

    const clearDateRange = () => {
        set_dateRange({
            dateFrom: '',
            dateTo: '',
        });
        set_selectionRange({
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection',
        });
    };

    const handleSelect = (ranges: any) => {
        console.log(ranges);
        set_dateRange({
            dateFrom: formatDateYYYY_MM_DD(ranges.selection.startDate),
            dateTo: formatDateYYYY_MM_DD(ranges.selection.endDate),
        });
        set_selectionRange({
            startDate: new Date(ranges.selection.startDate),
            endDate: new Date(ranges.selection.endDate),
            key: 'selection',
        });
    };

    const updateStripeMode = async (stripeMode: string) => {
        SetLoadingStatus(true)
        const response = await setStripeMode({ stripeMode });
        console.log(response, '///////');
        set_stripeMode(stripeMode);
        SetLoadingStatus(false)
    }

    const getCurrentStripeMode = async () => {
        const response = await getStripeMode();
        console.log(response, '///////');
        if (response)
            set_stripeMode(response.stripeMode || 'test');
    }

    useEffect(() => {
        getCurrentStripeMode();
    }, [])

    const filterHisotries = async (pageNum: number) => {
        set_currentPage(pageNum)
        SetLoadingStatus(true)
        const response = await doFilterPaymentHistories({
            currentPage: pageNum,
            numPerPage: numPerPage,
            email: email,
            stripeMode: selectedMode.value,
            paymentType: selectedType.value,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
            sortBy: 'createdAt',
            sort: 'DESC',
        })
        if (response) {
            console.log(response, '/////')
            set_histories([...response.result])
            set_totalCount(response.totalCount)
            set_totalPage(response.totalCount % numPerPage ? Math.floor(response.totalCount / numPerPage) : response.totalCount / numPerPage - 1)
        }
        set_isFirstLoad(false)
        SetLoadingStatus(false)
    }

    useEffect(() => {
        if (!isFirstLoad) {
            let timer = setTimeout(() => {
                filterHisotries(0)
            }, 500)
            return (() => clearTimeout(timer))
        }
    }, [dateRange, email, selectedMode, selectedType])

    useEffect(() => {
        if (!isFirstLoad) {
            filterHisotries(0)
        }
    }, [numPerPage])

    useEffect(() => {
        if (!isFirstLoad) {
            filterHisotries(currentPage)
        }
    }, [currentPage])

    useEffect(() => {
        filterHisotries(0)
    }, [])

    return (
        <div className="w-full h-full pt-10 overflow-y-auto text-white px-[18px]">
            <div className="w-full max-w-[1500px] mx-auto text-white">
                <div className="text-center text-2xl">Payment Management</div>
                <div className="flex items-center justify-center space-x-6 mt-6">
                    <div>Toggle Stripe Mode</div>
                    <div className="rounded-full border border-white overflow-clip">
                        <button
                            className={`w-16 h-8 ${stripeMode === 'test' ? 'bg-white text-black' : ''} hover:bg-grey`}
                            disabled={stripeMode === 'test'}
                            onClick={() => updateStripeMode('test')}
                        >
                            Test
                        </button>
                        <button
                            className={`w-16 h-8 ${stripeMode === 'live' ? 'bg-white text-black' : ''} hover:bg-grey`}
                            disabled={stripeMode === 'live'}
                            onClick={() => updateStripeMode('live')}
                        >
                            Live
                        </button>
                    </div>
                </div>
                <div className="max-w-[800px] mx-auto w-full py-1">
                    <div className="flex justify-between mt-4">
                        <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by email</div>
                            <input
                                className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                                placeholder="Input email"
                                value={email}
                                onChange={(e) => set_email(e.target.value)}
                            />
                        </div>
                        <div className="w-[150px] sm:w-[300px]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by stripe Mode</div>
                            <SelectionWithCheckBox
                                options={modes}
                                selectedOptions={selectedMode}
                                set_selectedOptions={set_selectedMode}
                                placeholder="Filter by mode"
                                isMulti={false}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between mt-2">
                        <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)] relative">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Time periods</div>
                            <div
                                className={`w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px] flex items-center justify-between cursor-pointer ${dateRange.dateFrom && dateRange.dateTo
                                    ? 'text-white'
                                    : 'text-white/50 hover:text-white'
                                    }`}
                                onClick={() => set_datePickerShow(!datePickerShow)}
                            >

                                <div className="w-[calc(100%-30px)] text-[13px] leading-[16px] sm:text-[16px] sm:leading-[20px] flex justify-between items-center">
                                    {dateRange.dateFrom && dateRange.dateTo ? (
                                        <span>
                                            {dateRange.dateFrom} ~ {dateRange.dateTo}
                                        </span>
                                    ) : (
                                        <span>Date Range</span>
                                    )}
                                    <button
                                        className={`ml-3 text-[16px] leading-[20px] font-bold tracking-[-0.18px] z-10 text-green ${dateRange.dateFrom && dateRange.dateTo ? 'hidden sm:block' : 'hidden'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearDateRange();
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <svg
                                    className={`${datePickerShow ? 'rotate-180' : ''} transition-all`}
                                    width="14"
                                    height="9"
                                    viewBox="0 0 14 9"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M13.7812 1.46094C13.9375 1.58594 13.9375 1.83594 13.7812 1.99219L7.25 8.52344C7.09375 8.67969 6.875 8.67969 6.71875 8.52344L0.1875 1.99219C0.03125 1.83594 0.03125 1.58594 0.1875 1.46094L0.78125 0.835938C0.9375 0.679688 1.1875 0.679688 1.3125 0.835938L7 6.49219L12.6562 0.835938C12.7812 0.679688 13.0312 0.679688 13.1875 0.835938L13.7812 1.46094Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </div>
                            {datePickerShow ? (
                                <>
                                    <div
                                        className="fixed top-0 left-0 z-10 w-full h-full"
                                        onClick={() => set_datePickerShow(false)}
                                    ></div>
                                    <div
                                        id="dateRangePickerInSearch"
                                        className={`left-0 absolute top-20 md:top-[80px] border border-[#CECECE] text-darkgrey w-fit z-10 pb-0`}
                                    >
                                        <DateRangePicker
                                            rangeColors={['#31B099']}
                                            ranges={[selectionRange]}
                                            onChange={handleSelect}
                                            staticRanges={customStaticRanges}
                                            inputRanges={[]}
                                            direction="vertical"
                                        />
                                        {dateRange.dateFrom && dateRange.dateTo ? (
                                            <button
                                                className={`left-7 absolute hidden sm:block bottom-7  text-[16px] leading-[20px] font-bold tracking-[-0.18px] text-darkgrey`}
                                                onClick={clearDateRange}
                                            >
                                                Reset
                                            </button>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div className="w-[150px] sm:w-[300px]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by payment type</div>
                            <SelectionWithCheckBox
                                options={types}
                                selectedOptions={selectedType}
                                set_selectedOptions={set_selectedType}
                                placeholder="Filter by type"
                                isMulti={false}
                            />
                        </div>
                    </div>
                </div>
                <div className="w-full rounded-[16px]">
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                        <div>
                            <div className="">Total of {totalCount} histories</div>
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => set_currentPage(0)}
                            goPrev={() => set_currentPage((currentPage - 1) || 0)}
                            goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => set_currentPage(totalPage)}
                        />
                    </div>
                    <div className="relative overflow-x-auto w-full px-4">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-darkgrey">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        No
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Date
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Amount
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Currency
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Expert
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Customer
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Event Type
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Description
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Mode
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Payment Type
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Payment Intent
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    histories.map((item, index) => {
                                        return (
                                            <tr key={index} className="border-b border-grey hover:bg-midgrey">
                                                <td className='py-2 px-2 text-center'>{numPerPage * currentPage + index + 1}</td>
                                                <td className='px-2'>{formatDateYYYY_MM_DD_h_m(new Date(item.createdAt))}</td>
                                                <td className='text-center px-2'>{item.amount / 100}</td>
                                                <td className='text-center px-2'>{item.currency}</td>
                                                <td className='text-center px-2'>{item.expert?.email}</td>
                                                <td className='text-center px-2'>{item.customer?.email}</td>
                                                <td className='px-2 text-center'>{item.event ? 'Event' : 'Seminar'}</td>
                                                <td className='px-2 max-w-[200px] truncate'>{item.description}</td>
                                                <td className='px-2 text-center'>{item.stripeMode}</td>
                                                <td className='px-2 text-center'>{item.paymentType}</td>
                                                <td className='px-2'>{item.paymentIntent}</td>
                                            </tr>
                                        )
                                    })
                                }
                            </tbody>
                        </table>
                    </div>
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                        <div className='flex gap-6'>
                            <div className="">Show rows:</div>
                            <select
                                className='bg-black text-white border rounded-md border-midgrey px-2 outline-none'
                                value={numPerPage}
                                onChange={(e) => set_numPerPage(e.target.value)}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => set_currentPage(0)}
                            goPrev={() => set_currentPage((currentPage - 1) || 0)}
                            goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => set_currentPage(totalPage)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Payment;
