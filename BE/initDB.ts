const Service = require("./models/Service")
const User = require("./models/User")
const GroupChat = require("./models/GroupChat")
const AppState = require("./models/AppState")
const bcrypt = require("bcryptjs");

const appendDefaultServices = async () => {
    try {
        const count = await Service.countDocuments()
        const services = [
            {
                value: "Study abroad consultation",
                label: "Study abroad consultation",
            },
            {
                value: "Scientific paper guidance",
                label: "Scientific paper guidance",
            },
            {
                value: "Overseas work consultation",
                label: "Overseas work consultation",
            },
            {
                value: "Overseas life sharing",
                label: "overseas life sharing"
            }
        ]
        if (!count) {
            await Service.insertMany(services)
        }
    } catch (err: any) {
        console.log('[appendDefaultServices]', err.message)
    }
}

const appendAdminUserAndGroupChat = async () => {
    try {
        const email = "admin@wisdomlinked.com",
            password = "no9x@mhc#z11l<k",
            role = "admin";

        let admin = await User.findOne({ email: email.toLowerCase() })
        if (!admin) {
            const encryptedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({
                username: 'Admin',
                email: email.toLowerCase(),
                password: encryptedPassword,
                role: role,
                status: 'active'
            });
            admin = await newUser.save();
        }

        let globalChat = await GroupChat.findOne({ name: 'Global Chat' })
        if (!globalChat) {
            globalChat = await GroupChat.create({
                name: 'Global Chat',
                description: 'Global Chat',
                start: 0,
                end: 0,
                duration: 0,
                price: 0,
                participants: [admin._id],
                admin: admin._id,
                createdBy: admin._id,
            });
        }
        if (admin.generalChats.indexOf(globalChat._id) === -1) {
            admin.generalChats.push(globalChat._id);
        }

        let generalChat = await GroupChat.findOne({ name: 'Admin' })
        if (!generalChat) {
            generalChat = await GroupChat.create({
                name: 'Admin',
                description: 'Admin',
                start: 0,
                end: 0,
                duration: 0,
                price: 0,
                participants: [admin._id],
                admin: admin._id,
                createdBy: admin._id,
            });
        }
        if (admin.generalChats.indexOf(generalChat._id) === -1) {
            admin.generalChats.push(generalChat._id);
        }
        await admin.save();
    } catch (err: any) {
        console.log('[appendAdminUserAndGroupChat]', err.message)
        return
    }
}

const initAppStates = async () => {
    const appState = await AppState.findOne()
    if (!appState) {
        const newAppState = new AppState({
            stripeMode: 'test'
        })
        await newAppState.save()
    }
}

module.exports = {
    appendDefaultServices,
    appendAdminUserAndGroupChat,
    initAppStates,
}