import React, {useState, useEffect} from 'react'
import { useSearchParams } from 'react-router-dom'
import Pagination from '../../../components/Pagination'
import { getChatBotQA, createChatBotQA, updateChatBotQA, deleteChatBotQA } from '../../../api/api'
import { SetLoadingStatus } from '../../../actions/appActions'
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react'

const ChatBotQA = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const unansweredFromUrl = searchParams.get('unanswered') === '1'

    const [numPerPage, setNumPerPage] = useState(5)
    const [currentPage, setCurrentPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [totalPage, setTotalPage] = useState(0)
    interface QAItem {
        _id : string,
        role: string;
        question: string;
        answer: string;
    }
    const [editID, setEditID] = useState('')
    const [qAndA, setQAndA] = useState<QAItem[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [unansweredOnly, setUnansweredOnly] = useState(unansweredFromUrl)

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)

    const [formData, setFormData] = useState({
        role: 'user',
        question: '',
        answer: ''
    })

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
        return () => clearTimeout(t)
    }, [searchTerm])

    useEffect(() => {
        setUnansweredOnly(unansweredFromUrl)
    }, [unansweredFromUrl])

    const loadData = async () => {
        SetLoadingStatus(true)
        const result = await getChatBotQA({
            page: currentPage,
            limit: numPerPage,
            search: debouncedSearch || undefined,
            unansweredOnly,
        })
        setQAndA(Array.isArray(result?.chatBotQAs) ? result.chatBotQAs : [])
        const total = result?.total ?? 0
        setTotalCount(total)
        setTotalPage(Math.max(0, Math.ceil(total / numPerPage) - 1))
        SetLoadingStatus(false)
    }

    useEffect(() => {
        loadData()
    }, [currentPage, numPerPage, debouncedSearch, unansweredOnly])

    useEffect(() => {
        setCurrentPage(0)
    }, [debouncedSearch, unansweredOnly, numPerPage])

    const toggleUnanswered = (checked: boolean) => {
        setUnansweredOnly(checked)
        if (checked) {
            setSearchParams({ unanswered: '1' }, { replace: true })
        } else {
            setSearchParams({}, { replace: true })
        }
    }

    const handleCreate = async () => {
        SetLoadingStatus(true)
        await createChatBotQA(formData)
        setShowCreateModal(false)
        setFormData({ role: 'user', question: '', answer: '' })
        await loadData()
        SetLoadingStatus(false)
    }

    const handleEdit = (item: any) => {
        setEditID(item._id)
        setFormData({
            role: item.role,
            question: item.question,
            answer: item.answer
        })
        setShowEditModal(true)
    }

    const handleUpdate = async () => {
        SetLoadingStatus(true)
        await updateChatBotQA(formData,editID)
        setShowEditModal(false)
        setFormData({
            role: 'user',
            question: '',
            answer: ''
        })
        await loadData()
        SetLoadingStatus(false)
    }

    const handleDelete = async(id : string) => {
        if (!window.confirm('Are you sure you want to delete this Q&A?')) return
        SetLoadingStatus(true);
        await deleteChatBotQA(id)
        await loadData()
        SetLoadingStatus(false)
    }

    return (
        <div className="w-full h-full pt-10 overflow-y-auto text-wl-ink px-[18px]">
            <div className="w-full max-w-[1500px] mx-auto text-wl-ink">
                <div className="text-center text-3xl font-semibold text-wl-brand mb-8">Chat Bot Q&A Management</div>
                
                <div className="w-full bg-wl-card rounded-2xl border border-wl-line shadow-[0_10px_30px_rgba(35,76,106,0.08)] overflow-hidden">
                    <div className="w-full flex flex-col lg:flex-row lg:justify-between lg:items-center p-6 gap-4 border-b border-wl-line bg-wl-pageAlt/40">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
                            <div className="text-lg font-medium text-wl-ink">
                                Total of <span className="text-wl-brand font-bold">{totalCount}</span> questions
                                {unansweredOnly ? (
                                    <span className="ml-2 text-sm text-brownyellow font-medium">(unanswered)</span>
                                ) : null}
                            </div>
                            
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-wl-muted" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search questions, answers, or roles..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-white border border-wl-line rounded-lg text-wl-ink placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-wl-brand/30 w-full sm:w-80"
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-wl-ink cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-lightgrey text-wl-brand focus:ring-wl-brand/30"
                                    checked={unansweredOnly}
                                    onChange={(e) => toggleUnanswered(e.target.checked)}
                                />
                                Unanswered only
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 rounded-xl border border-wl-brand bg-wl-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:brightness-95"
                        >
                            <Plus size={20} />
                            Add New Q&A
                        </button>
                    </div>

                    <div className="flex justify-end p-4 border-b border-wl-line">
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => setCurrentPage(0)}
                            goPrev={() => setCurrentPage((currentPage - 1) || 0)}
                            goNext={() => setCurrentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => setCurrentPage(totalPage)}
                        />
                    </div>

                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-center w-16">
                                        No
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-center w-24">
                                        Role
                                    </th>
                                    <th scope="col" className="px-6 py-4">
                                        Question
                                    </th>
                                    <th scope="col" className="px-6 py-4">
                                        Answer
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-center w-32">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {qAndA.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-wl-muted">
                                            {unansweredOnly
                                                ? 'No unanswered questions.'
                                                : 'No Q&A items found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    qAndA.map((item, index) => (
                                        <tr key={item._id || index} className="border-b border-wl-line hover:bg-wl-pageAlt transition-colors">
                                            <td className="py-4 px-6 text-center font-medium text-wl-ink">
                                                {numPerPage * currentPage + index + 1}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    item.role === 'user' 
                                                        ? 'bg-wl-brandSoft text-wl-brand' 
                                                        : 'bg-emerald-50 text-green'
                                                }`}>
                                                    {item.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="truncate" title={item.question}>
                                                    {item.question}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="truncate" title={item.answer}>
                                                    {item.answer || '—'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 text-wl-brand hover:bg-wl-brandSoft rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 gap-4 border-t border-wl-line">
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-wl-muted">Show rows:</label>
                            <select
                                className="bg-wl-card text-wl-ink border border-wl-line rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-wl-brand/30"
                                value={numPerPage}
                                onChange={(e) => {
                                    setNumPerPage(parseInt(e.target.value))
                                    setCurrentPage(0)
                                }}
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
                            goFirst={() => setCurrentPage(0)}
                            goPrev={() => setCurrentPage((currentPage - 1) || 0)}
                            goNext={() => setCurrentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => setCurrentPage(totalPage)}
                        />
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
                    <div className="bg-wl-card border border-wl-line rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-wl-brand">Create New Q&A</h3>
                            <button 
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setFormData({ role: 'user', question: '', answer: '' });
                                }} 
                                className="text-wl-muted hover:text-wl-ink"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                >
                                    <option value="user">User</option>
                                    <option value="expert">Expert</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Question</label>
                                <textarea
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                    rows={3}
                                    placeholder="Enter the question..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Answer</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                    rows={4}
                                    placeholder="Enter the answer..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreate}
                                    className="flex items-center gap-2 px-4 py-2 bg-wl-brand text-white rounded-lg hover:brightness-95 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    Create
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData({ role: 'user', question: '', answer: '' });
                                    }}
                                    className="px-4 py-2 border border-wl-line bg-wl-pageAlt text-wl-ink rounded-lg hover:bg-wl-page transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
                    <div className="bg-wl-card border border-wl-line rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-wl-brand">Edit Q&A</h3>
                            <button 
                                onClick={() => {
                                    setShowEditModal(false);
                                    setFormData({ role: 'user', question: '', answer: '' });
                                }} 
                                className="text-wl-muted hover:text-wl-ink"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                >
                                    <option value="user">User</option>
                                    <option value="expert">Expert</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Question</label>
                                <textarea
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                    rows={3}
                                    placeholder="Enter the question..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-wl-muted mb-2">Answer</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full p-3 bg-wl-card border border-wl-line rounded-lg text-wl-ink focus:outline-none focus:ring-2 focus:ring-wl-brand/30"
                                    rows={4}
                                    placeholder="Enter the answer..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleUpdate}
                                    className="flex items-center gap-2 px-4 py-2 bg-wl-brand text-white rounded-lg hover:brightness-95 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    Update
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setFormData({ role: 'user', question: '', answer: '' });
                                    }}
                                    className="px-4 py-2 border border-wl-line bg-wl-pageAlt text-wl-ink rounded-lg hover:bg-wl-page transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatBotQA
