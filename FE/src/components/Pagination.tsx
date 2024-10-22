import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const Pagination = ({ currentPage, totalPage, goPrev, goNext, goFirst, goLast }: any) => {
    return (
        <div className="text-sm sm:text-base sm:min-w-[360px] flex items-center gap-2">
            <button
                className="h-7 flex items-center bg-green border border-green rounded-lg text-white px-2 hover:bg-transparent hover:text-green disabled:opacity-50 disabled:pointer-events-none"
                disabled={currentPage === 0}
                onClick={goFirst}
            >
                First
            </button>
            <button
                className="h-7 flex items-center bg-green border border-green rounded-lg text-white px-2 hover:bg-transparent hover:text-green disabled:opacity-50 disabled:pointer-events-none"
                disabled={currentPage === 0}
                onClick={goPrev}
            >
                <ArrowBackIosNewIcon fontSize='small' />
            </button>
            <div
                className="h-7 flex items-center bg-green text-white rounded-lg px-3"
            >
                Page {currentPage + 1} of {totalPage + 1}
            </div>
            <button
                className="h-7 flex items-center bg-green border border-green rounded-lg text-white px-2 hover:bg-transparent hover:text-green disabled:opacity-50 disabled:pointer-events-none"
                disabled={currentPage >= totalPage}
                onClick={goNext}
            >
                <ArrowForwardIosIcon fontSize='small' />
            </button>
            <button
                className="h-7 flex items-center bg-green border border-green rounded-lg text-white px-2 hover:bg-transparent hover:text-green disabled:opacity-50 disabled:pointer-events-none"
                disabled={currentPage >= totalPage}
                onClick={goLast}
            >
                Last
            </button>
        </div>
    )
}

export default Pagination