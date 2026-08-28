import { Request, Response } from 'express';
const chatBotQA = require('../models/chatBotQA');
import { safeErrorMessage } from '../utils/httpUserFacingCopy';

const createChatBotQA = async (req, res) => {
    try {
        const { answer, role } = req.body;
        const question = String(req.body?.question ?? '');

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
        return res.status(500).send(safeErrorMessage(err));
    }
};

const getChatBotAnswer = async (req, res) => {
    try {
        const { role } = req.user || {};
        const question = String(req.body?.question ?? '');

        const results = await chatBotQA.find(
            { $text: { $search: question } },
            { score: { $meta: "textScore" } }
        ).sort({ score: { $meta: "textScore" } });

        const filteredResults = role
            ? results.filter(item => item.role === "user" || item.role === role)
            : results;

        const mainMatch = filteredResults[0];

        if (!mainMatch) {
            const newChatBotQA = new chatBotQA({
                question,
                answer: "Pending answer...",
                role: role || "user"
            });
            await newChatBotQA.save();

            return res.status(200).json({
                success: true,
                answer: "I’ve saved your question for review - please check back later.",
                similarQuestions: [],
                saved: true,
                newChatBotQA
            });
        }
        const similarQuestions = filteredResults
            .slice(1)
            .filter(item =>
                item.question.trim().toLowerCase() !== mainMatch?.question.trim().toLowerCase()
            )
            .slice(0, 4)
            .map(item => ({
                id: item._id,
                question: item.question
            }));

        return res.status(200).json({
            success: true,
            answer: mainMatch.answer,
            similarQuestions,
            saved: false
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};



const getChatBotQA = async (req, res) => {
    try {
        const { page, limit } = req.query;
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
        return res.status(500).send(safeErrorMessage(err));
    }
};

const updateChatBotQA = async (req, res) => {
    try {
        const id = String(req.params?.id ?? '');
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
        return res.status(500).send(safeErrorMessage(err));
    }
};

const deleteChatBotQA = async (req, res) => {
    try {
        const id = String(req.params?.id ?? '');
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
        return res.status(500).send(safeErrorMessage(err));
    }
}

module.exports = {
    createChatBotQA,
    getChatBotAnswer,
    getChatBotQA,
    updateChatBotQA,
    deleteChatBotQA
}