const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

const User = require('./models/User');
const GroupChat = require('./models/GroupChat');

const createAdmin = async () => {
    try {
        const email = "admin@wisdomlinked.com";
        const password = "no9x@mhc#z11l<k";
        const role = "admin";

        console.log(`Checking for existing admin user: ${email}`);
        let admin = await User.findOne({ email: email.toLowerCase() });

        if (!admin) {
            console.log('Admin user not found, creating new admin user...');
            const encryptedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({
                username: 'Admin',
                email: email.toLowerCase(),
                password: encryptedPassword,
                role: role
            });
            admin = await newUser.save();
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists, updating password and role to ensure admin access...');
            const encryptedPassword = await bcrypt.hash(password, 10);
            admin.password = encryptedPassword;
            admin.role = role;
            await admin.save();
            console.log('Admin user updated successfully.');
        }

        // Setup Group Chats for Admin
        console.log('Setting up Global Chat...');
        let globalChat = await GroupChat.findOne({ name: 'Global Chat' });
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
            console.log('Global Chat created.');
        }
        if (admin.generalChats.indexOf(globalChat._id) === -1) {
            admin.generalChats.push(globalChat._id);
        }

        console.log('Setting up Admin Chat...');
        let generalChat = await GroupChat.findOne({ name: 'Admin' });
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
            console.log('Admin Chat created.');
        }
        if (admin.generalChats.indexOf(generalChat._id) === -1) {
            admin.generalChats.push(generalChat._id);
        }

        await admin.save();
        console.log('Admin user setup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
    }
};

createAdmin();
