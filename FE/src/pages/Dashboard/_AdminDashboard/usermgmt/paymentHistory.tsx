import React, { useEffect, useState } from "react";
import LoadingPlaceHolder from "../../../../components/LoadingPlaceholder";
import { adminCheckPaymentIntent, doFilterPaymentHistories } from "../../../../api/api";
import { formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";
import OverlayPortal from "../../../../components/OverayPortal";
import CloseIcon from '@mui/icons-material/Close';
import { adminRefundPayment } from "../../../../api/api";

const PaymentHistory = ({
    userDetails
}: any) => {

    const [numPerPage, set_numPerPage] = useState<any>(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(-1)
    const [totalPage, set_totalPage] = useState(0)
    const [histories, set_histories] = useState<Array<any>>([])
    const [isFirstLoad, set_isFirstLoad] = useState(true)
    const [refundItem, set_refundItem] = useState<any>(null);
    const openRefundModal = (item:any) => set_refundItem(item);
    const closeRefundModal = () => set_refundItem(null);

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

    {refundItem && (
        <OverlayPortal closeModal={closeRefundModal}>
          <div className="fixed inset-0 flex items-center justify-center">
            <div className="bg-black border border-midgrey rounded-lg p-4 w-full max-w-md relative">
              <button className="absolute top-2 right-2" onClick={closeRefundModal}><CloseIcon/></button>
              <div className="text-lg mb-2">Refund Payment</div>
              <div className="text-sm mb-4 text-grey">
                PI: {refundItem.paymentIntent} • Mode: {refundItem.stripeMode}
              </div>
              <label className="text-sm">Amount (USD, optional for partial):</label>
              <input id="refund-amount" type="number" step="0.01" className="w-full bg-transparent border rounded px-2 py-1 mb-3"/>
              <label className="text-sm">Admin note (optional):</label>
              <textarea id="refund-note" className="w-full bg-transparent border rounded px-2 py-1 mb-4" />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 border rounded" onClick={closeRefundModal}>Cancel</button>
                <button className="px-3 py-1 border rounded bg-green hover:opacity-80" onClick={async ()=>{
                  const amountStr = (document.getElementById('refund-amount') as HTMLInputElement)?.value;
                  const note = (document.getElementById('refund-note') as HTMLTextAreaElement)?.value;
                  const amount = amountStr ? parseFloat(amountStr) : undefined;
                  SetLoadingStatus(true);
                  const res = await adminRefundPayment({
                    payment_intent: refundItem.paymentIntent,
                    stripeMode: refundItem.stripeMode,
                    amount,
                    note,
                  });
                  SetLoadingStatus(false);
                  if (res?.ok) alert("Refund submitted");
                  closeRefundModal();
                }}>Submit</button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

    return (
        <div className="w-full h-full overflow-y-auto pt-6">
            <div className="w-full rounded-[16px]">
                <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                    <div>
                        <div className="">Total of {totalCount} histories</div>
                    </div>
                    {/* <button
                        className="px-3 py-2 border rounded mb-3"
                        onClick={()=> set_showAdhoc(true)}
                    >
                        Create Ad‑hoc Payment
                    </button> */}

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
                                <th scope="col" className="px-6 py-3 text-center">
                                    Actions
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
                                            <td className='px-2 text-center'>
                                                {item.paymentType === 'adhoc' ? 'Ad-hoc' : (item.event ? 'Event' : 'Seminar')}
                                            </td>
                                            <td className='px-2 max-w-[200px] truncate'>{item.description}</td>
                                            <td className='px-2 text-center'>{item.stripeMode}</td>
                                            <td className='px-2 text-center'>{item.paymentType}</td>
                                            <td className='px-2'>{item.paymentIntent}</td>
                                            <td className='px-2 text-center'>
                                                <div className="flex gap-2 justify-center">
                                                    {/* Retry: generate a pay link the customer can use */}
                                                    <button
                                                    className="px-2 py-1 border rounded hover:bg-midgrey"
                                                    onClick={() => {
                                                        const amountUSD = (item.amount || 0) / 100;
                                                        const params = new URLSearchParams({
                                                        amount: String(amountUSD),
                                                        mode: item.stripeMode || 'test',
                                                        desc: item.description || 'Payment',
                                                        });
                                                        const base = process.env.REACT_APP_AUTH_URL || '/user/';
                                                        const url = `${window.location.origin}${base}customerdashboard/payment?${params.toString()}`;
                                                        navigator.clipboard.writeText(url);
                                                        alert("Retry link copied to clipboard:\n" + url);
                                                    }}
                                                    >
                                                    Retry (link)
                                                    </button>

                                                    {/* Check PI status */}
                                                    <button
                                                    className="px-2 py-1 border rounded hover:bg-midgrey"
                                                    onClick={async () => {
                                                        const res = await adminCheckPaymentIntent({ payment_intent: item.paymentIntent, stripeMode: item.stripeMode });
                                                        alert(res?.succeeded ? "Status: Succeeded" : "Status: Not succeeded");
                                                    }}
                                                    >
                                                    Check
                                                    </button>

                                                    {/* Refund */}
                                                    <button
                                                    className="px-2 py-1 border rounded hover:bg-midgrey"
                                                    onClick={() => openRefundModal(item)}
                                                    disabled={!item.paymentIntent}
                                                    >
                                                    Refund
                                                    </button>
                                                </div>
                                            </td>

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
    );
};

export default PaymentHistory;
