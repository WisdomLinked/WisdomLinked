const chatBotQA = require('../models/chatBotQA');

const createChatBotQA = async (req, res) => {
    try {
        const { question, answer, role } = req.body;

        // Check if a document with this question already exists
        const existingQA = await chatBotQA.findOne({ question });
        if (existingQA) {
            return res.status(200).json({
                success: true,
                message: "ChatBotQA document already exists"
            });
        }
        // Create a new ChatBotQA document
        const newChatBotQA = new chatBotQA({
            question,
            answer,
            role
        })
        await newChatBotQA.save();
        return res.status(200).json({
            success: true,
            message: "ChatBotQA created successfully",
            chatBotQA: newChatBotQA
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

const getChatBotAnswer = async (req, res) => {
    try {
        const { role } = req.user;
        const { question } = req.body;
        const chatBotQAItem = await chatBotQA.findOne({ question: question })
        console.log(chatBotQAItem)
        if (!chatBotQAItem || (chatBotQAItem.role !=="user" && chatBotQAItem.role !== role)) {
            return res.status(200).json({
                success: true,
                answer: "Sorry, I don't understand the question. Please select an action or type a question."
            });
        } 
        return res.status(200).json({
            success: true,
            answer: chatBotQAItem.answer
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

const getChatBotQA = async (req, res) => {
    try {
        const {page , limit } = req.query;
        const skip = (page) * limit;
        const total = await chatBotQA.countDocuments();
        const chatBotQAs = await chatBotQA.find().skip(skip).limit(limit);
        // const chatBotQAs = await chatBotQA.find();
        return res.status(200).json({
            success: true,
            total,
            page,
            limit,
            chatBotQAs
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

const updateChatBotQA = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, role } = req.body;

        // Find the ChatBotQA document by ID
        const chatBotQAItem = await chatBotQA.findById(id);
        if (!chatBotQAItem) {
            return res.status(404).json({
                success: false,
                message: "ChatBotQA not found"
            });
        }

        // Update the fields
        chatBotQAItem.question = question || chatBotQAItem.question;
        chatBotQAItem.answer = answer || chatBotQAItem.answer;
        chatBotQAItem.role = role || chatBotQAItem.role;

        // Save the updated document
        await chatBotQAItem.save();

        return res.status(200).json({
            success: true,
            message: "ChatBotQA updated successfully",
            chatBotQA: chatBotQAItem
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

const deleteChatBotQA = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedChatBotQA = await chatBotQA.findByIdAndDelete(id);
        if (!deletedChatBotQA) {
            return res.status(404).json({
                success: false,
                message: "ChatBotQA not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "ChatBotQA deleted successfully",
            chatBotQA: deletedChatBotQA
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
}

module.exports = {
    createChatBotQA,
    getChatBotAnswer,
    getChatBotQA,
    updateChatBotQA,
    deleteChatBotQA
}