const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword")

const filterExperts = async (req, res) => {
    try {
        const { email } = req.user
        const { _id, username, keywords, services, sortBy } = req.body
        let query = User.find({ role: 'expert', status: { $ne: 'blocked' } })
        if (_id) {
            query.where({ _id: _id })
        } else {
            if (username) {
                query.where({ username: { '$regex': username, '$options': 'i' } })
            }
            if (keywords?.length) {
                let _keywords = []
                for (let i = 0; i < keywords.length; i++) {
                    if (keywords[i].new) {
                        const sameKeywordExist = await Keyword.find({ value: keywords[i].value })
                        if (sameKeywordExist.length) {
                            _keywords.push(sameKeywordExist[0]._id)
                        } else {
                            const temp = new Keyword(keywords[i])
                            const newKeyword = await temp.save()
                            _keywords.push(newKeyword._id)
                        }
                    } else {
                        _keywords.push(keywords[i]._id)
                    }
                }
                query.where({ keywords: { $in: _keywords } })
            }
            if (services?.length) {
                query.where({ services: { $in: services } })
            }
        }
        switch (sortBy) {
            case "Name in ASC":
                query.sort({ username: 1 })
                break;
            case "Name in DESC":
                query.sort({ username: -1 })
                break;
            case "Price in ASC":
                query.sort({ price: 1 })
                break;
            case "Price in DESC":
                query.sort({ price: -1 })
                break;
            default:
                break;
        }

        query.populate([
            "events",
            "services",
            "keywords",
            "groupChats",
            {
                path: 'pendingGroupChats',
                populate: [
                    {
                        path: 'customerId',
                        select: 'email username image role status'
                    },
                    'groupChatId'
                ]
            }])
        const experts = await query.exec();

        return res.status(200).json({
            result: experts
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const filterSeminars = async (req, res) => {
    try {
        const { userId } = req.user
        const { name, keywords, services, sortBy } = req.body

        let query = GroupChat.find({
            $or: [
                {
                    start: { $gt: new Date() },
                },
                {
                    start: { $lt: new Date() },
                    end: { $gt: new Date() }
                }
            ],
            participants: { $nin: userId }
        })
        if (name) {
            query.where({ name: { '$regex': name, '$options': 'i' } })
        }
        if (keywords?.length) {
            let _keywords = []
            for (let i = 0; i < keywords.length; i++) {
                if (keywords[i].new) {
                    const sameKeywordExist = await Keyword.find({ value: keywords[i].value })
                    if (sameKeywordExist.length) {
                        _keywords.push(sameKeywordExist[0]._id)
                    } else {
                        const temp = new Keyword(keywords[i])
                        const newKeyword = await temp.save()
                        _keywords.push(newKeyword._id)
                    }
                } else {
                    _keywords.push(keywords[i]._id)
                }
            }
            query.where({ keywords: { $in: _keywords } })
        }
        if (services?.length) {
            query.where({ services: { $in: services } })
        }
        switch (sortBy) {
            case "Name in ASC":
                query.sort({ name: 1 })
                break;
            case "Name in DESC":
                query.sort({ name: -1 })
                break;
            case "Price in ASC":
                query.sort({ price: 1 })
                break;
            case "Price in DESC":
                query.sort({ price: -1 })
                break;
            default:
                break;
        }

        query.populate([
            {
                path: 'admin',
                select: 'email username image role status title description services keywords status',
                populate: ['keywords', 'services']
            },
            {
                path: 'participants',
                select: 'email username image role status'
            },
            "keywords",
            "services"
        ])
        const seminars = (await query.exec()).filter(x => x.admin.status === 'active');

        return res.status(200).json({
            result: seminars
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}


const  getExpertById =async (req,res) =>{
    try{
        console.log("inside getExpertById")
        const {id} = req.params
        let query = await User.findById(id)
        console.log("inside getExpertById",query)
        return res.status(200).json({
            result: query
        })
    }
    catch(err){
        console.log(err)
        return res.status(500).send(err.message);
    }
}

module.exports = {
    filterExperts,
    filterSeminars,
    getExpertById,
}