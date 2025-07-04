import React, {useState, useEffect} from 'react'
import Pagination from '../../../components/Pagination'
import { getChatBotQA, createChatBotQA, updateChatBotQA, deleteChatBotQA } from '../../../api/api'
import { SetLoadingStatus } from '../../../actions/appActions'
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react'

const ChatBotQA = () => {
    const [numPerPage, setNumPerPage] = useState(5)
    const [currentPage, setCurrentPage] = useState(0)
    const [totalCount, setTotalCount] = useState(-1)
    const [totalPage, setTotalPage] = useState(1)
    interface QAItem {
        _id : string,
        role: string;
        question: string;
        answer: string;
    }
    const [editID, setEditID] = useState('')
    const [qAndA, setQAndA] = useState<QAItem[]>([])

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)

    const [formData, setFormData] = useState({
        role: 'user',
        question: '',
        answer: ''
    })

    const loadData = async () => {
        SetLoadingStatus(true)
        const query = {page:currentPage, limit:numPerPage}
        const result = await getChatBotQA(query)
        setQAndA(result.chatBotQAs)
        setTotalCount(result.total)
        setTotalPage(Math.ceil(result.total / numPerPage)-1)
        SetLoadingStatus(false)
    }

    useEffect(() => {
        loadData()
    }, [currentPage, numPerPage])

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
        console.log(item)
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
        <div className="w-full h-full pt-10 overflow-y-auto text-white px-[18px]">
            <div className="w-full max-w-[1500px] mx-auto text-white">
                <div className="text-center text-3xl font-bold mb-8">Chat Bot Q&A Management</div>
                
                <div className="w-full bg-gray-800 rounded-[16px] shadow-lg">
                    {/* Header Section */}
                    <div className="w-full flex flex-col lg:flex-row lg:justify-between lg:items-center p-6 gap-4 border-b border-gray-700">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="text-lg font-medium">
                                Total of <span className="text-blue-400 font-bold">{totalCount}</span> questions
                            </div>
                            
                            {/* Search Bar */}
                            {/* <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search questions, answers, or roles..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-80"
                                />
                            </div> */}
                        </div>

                        {/* Add New Button */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Plus size={20} />
                            Add New Q&A
                        </button>
                    </div>

                    {/* Pagination Top */}
                    <div className="flex justify-end p-4 border-b border-gray-700">
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => setCurrentPage(0)}
                            goPrev={() => setCurrentPage((currentPage - 1) || 0)}
                            goNext={() => setCurrentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => setCurrentPage(totalPage)}
                        />
                    </div>

                    {/* Table */}
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-gray-900 text-gray-300">
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
                                {qAndA ? (
                                    qAndA.map((item, index) => (
                                        <tr key={index} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                                            <td className="py-4 px-6 text-center font-medium text-gray-300">
                                                {numPerPage * currentPage + index + 1}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    item.role === 'user' 
                                                        ? 'bg-blue-600 text-blue-100' 
                                                        : 'bg-purple-600 text-purple-100'
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
                                                    {item.answer}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 rounded-lg transition-colors"
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
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            {'No Q&A items found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Controls */}
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 gap-4 border-t border-gray-700">
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-gray-300">Show rows:</label>
                            <select
                                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">Create New Q&A</h3>
                            <button 
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setFormData({ role: 'user', question: '', answer: '' });
                                }} 
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="user">User</option>
                                    <option value="expert">Expert</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Question</label>
                                <textarea
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Enter the question..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Answer</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={4}
                                    placeholder="Enter the answer..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreate}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    Create
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData({ role: 'user', question: '', answer: '' });
                                    }}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">Edit Q&A</h3>
                            <button 
                                onClick={() => {
                                    setShowEditModal(false);
                                    setFormData({ role: 'user', question: '', answer: '' });
                                }} 
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="user">User</option>
                                    <option value="expert">Expert</option>
                                    <option value="customer">Customer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Question</label>
                                <textarea
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Enter the question..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Answer</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={4}
                                    placeholder="Enter the answer..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleUpdate}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    Update
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setFormData({ role: 'user', question: '', answer: '' });
                                    }}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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