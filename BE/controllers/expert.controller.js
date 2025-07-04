const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const {shareMeetingId} = require("../services/notifications")

const updateTimeSlots = async (req, res) => {
    try {
        const { email } = req.user
        const { timeSlots } = req.body
        const newUser = await User.findOneAndUpdate({ email: email }, { timeSlots: timeSlots }, { new: true })
        newUser.token = null
        newUser.password = null
        return res.status(200).json({
            newUser: newUser
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const getDailyTimeSlots = async (req, res) => {
    try {
        const { email } = req.user
        const { startTime, endTime, userId } = req.body
        const user = await User.findOne(userId ? { _id: userId } : { email: email }).select('dailyTimeSlots')
        if (!user) {
            throw new Error("User not found")
        }
        let slots = []
        user.dailyTimeSlots.map(slot => {
            if (slot >= startTime && slot <= endTime) {
                slots.push(slot)
            }
        })
        return res.status(200).json({
            dailyTimeSlots: slots
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const updateDailyTimeSlots = async (req, res) => {
    try {
        const { email } = req.user
        const { newSlots, startTime, endTime } = req.body
        const user = await User.findOne({ email: email }).select('dailyTimeSlots')
        if (!user) {
            throw new Error("User not found")
        }
        let slots = newSlots
        user.dailyTimeSlots.forEach(slot => {
            if (slot >= startTime && slot <= endTime) {
                // do nothing
            } else {
                slots.push(slot)
            }
        })
        await User.findOneAndUpdate({ email: email }, { dailyTimeSlots: slots }, { new: true })

        return res.status(200).json({
            dailyTimeSlots: slots
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const  getCustomerById =async (req,res) =>{
    try{
        console.log("inside getCustomerByid")
        const {id} = req.params
        let query = await User.findById(id)
        console.log("inside getCustomerByid",query)
        return res.status(200).json({
            result: query
        })
    }
    catch(err){
        console.log(err)
        return res.status(500).send(err.message);
    }
}
const filterCustomers = async (req, res) => {
    try {
        const { email } = req.user
        const { _id, username, keywords, services, sortBy } = req.body
        let query = User.find({ role: 'customer', status: { $ne: 'blocked' } })
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
            }
        ])
        const customers = await query.exec();

        return res.status(200).json({
            result: customers
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const shareMeetingViaEmail = async (req, res) => {
    try{
        const {email, groupchatId} = req.body;
        const groupChat = await GroupChat.findById(groupchatId);

        const user = await User.findOne({email:email.toLowerCase() })
        const name = user?.username ?? "Guest"

        shareMeetingId(email,name,groupchatId,groupChat.name)

        return res.status(200).send("Shared meeting Id via email successfully!");

    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

module.exports = {
    updateTimeSlots,
    getDailyTimeSlots,
    updateDailyTimeSlots,
    filterCustomers,
    getCustomerById,
    shareMeetingViaEmail
}
