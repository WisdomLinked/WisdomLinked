import React, { useEffect, useState } from "react";
import LoadingPlaceHolder from "../../../../components/LoadingPlaceholder";
import { doFilterPaymentHistories } from "../../../../api/api";
import { formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";

const PaymentHistory = ({
    userDetails
}: any) => {

    const [numPerPage, set_numPerPage] = useState<any>(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(-1)
    const [totalPage, set_totalPage] = useState(0)
    const [histories, set_histories] = useState<Array<any>>([])
    const [isFirstLoad, set_isFirstLoad] = useState(true)

    const filterHisotries = async (pageNum: number) => {
        set_currentPage(pageNum)
        SetLoadingStatus(true)
        const response = await doFilterPaymentHistories({
            email: userDetails.email,
            currentPage: pageNum,
            numPerPage: numPerPage,
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
        <div className="w-full h-full overflow-y-auto pt-6">
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
                        <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
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
                                        <tr key={index} className="border-b border-wl-line hover:bg-wl-pageAlt text-wl-ink">
                                            <td className='py-2 px-2 text-center'>{numPerPage * currentPage + index + 1}</td>
                                            <td className='px-2'>{formatDateYYYY_MM_DD_h_m(new Date(item.createdAt))}</td>
                                            <td className='text-center px-2'>{item.amount / 100}</td>
                                            <td className='text-center px-2'>{item.currency}</td>
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
                            className='bg-wl-card text-wl-ink border rounded-md border-wl-line px-2 outline-none'
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
    );
};

export default PaymentHistory;
