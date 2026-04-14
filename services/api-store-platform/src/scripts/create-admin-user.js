"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const config_1 = require("../src/config/config");
const User_1 = __importDefault(require("../src/models/User"));
// Admin user details - CHANGE THESE
const INITIAL_USERS = [
    {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123', // Minimum 6 chars
        role: 'admin',
    },
    {
        username: 'editor',
        email: 'editor@example.com',
        password: 'editor123', // Minimum 6 chars
        role: 'editor',
    },
];
function createInitialUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Connect to MongoDB
            yield mongoose_1.default.connect(config_1.config.mongoDB.connectionString);
            console.log('✅ Connected to MongoDB');
            // Delete all existing users
            yield User_1.default.deleteMany({});
            console.log('🗑️  All existing users deleted');
            // Create initial users
            for (const userData of INITIAL_USERS) {
                // Hash password
                const hashedPassword = yield bcrypt_1.default.hash(userData.password, 10);
                // Create user
                const user = new User_1.default({
                    username: userData.username,
                    email: userData.email,
                    password: hashedPassword,
                    role: userData.role,
                });
                yield user.save();
                console.log(`✅ ${userData.role.toUpperCase()} user created successfully!`);
                console.log('👤 Username:', user.username);
                console.log('📧 Email:', user.email);
                console.log('🎭 Role:', user.role);
                console.log('');
                console.log('🚀 Login at: POST http://localhost:3001/api/business-platform-store/login');
                console.log('📝 Body: {"email": "' +
                    user.email +
                    '", "password": "' +
                    userData.password +
                    '"}');
                console.log('─'.repeat(50));
            }
        }
        catch (error) {
            console.error('❌ Error creating initial users:', error);
            process.exit(1);
        }
        finally {
            yield mongoose_1.default.disconnect();
            console.log('🔌 MongoDB disconnected');
        }
    });
}
createInitialUsers();
