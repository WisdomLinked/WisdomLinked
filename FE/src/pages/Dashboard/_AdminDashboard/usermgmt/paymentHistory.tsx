import React, { useEffect, useState } from "react";
import { doFilterPaymentHistories } from "../../../../api/api";
import { formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";

const PaymentHistory = ({
    userDetails
}: any) => {

    const [numPerPage, set_numPerPage] = useState(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(0)
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
            set_histories([...response.result])
            set_totalCount(response.totalCount)
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
            <div className="w-full rounded-[16px] overflow-hidden border border-wl-line bg-wl-card">
                <div className="w-full p-4">
                    <div>Total of {totalCount} histories</div>
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
                <Pagination
                    currentPage={currentPage}
                    totalCount={Math.max(0, totalCount)}
                    pageSize={Number(numPerPage)}
                    onPage={set_currentPage}
                    onPageSize={size => {
                        set_numPerPage(size)
                        set_currentPage(0)
                    }}
                />
            </div>
        </div>
    );
};

export default PaymentHistory;
