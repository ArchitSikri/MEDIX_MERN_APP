import dns from "node:dns";
import mongoose from "mongoose";
import config from "./config.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function connectToDb() {
    const mongoUri = config.MONGO_URL;

    if (!mongoUri) {
        throw new Error("MONGO_URL is not configured in the backend environment");
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log("Connected to db");
    } catch (err) {
        console.error("Failed to connect to MongoDB");
        console.error("Name:", err.name);
        console.error("Message:", err.message);

        if (err.cause?.message) {
            console.error("Cause:", err.cause.message);
        }

        if (err.reason) {
            console.error("Reason:", err.reason);
        }

        throw err;
    }
}

export default connectToDb;