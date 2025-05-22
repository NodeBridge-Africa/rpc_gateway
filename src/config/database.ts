import mongoose from "mongoose";
import { validateEnv } from "./env.example";

export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log("Already connected to MongoDB");
      return;
    }

    try {
      // Validate environment variables
      validateEnv();

      const mongoUri = process.env.MONGO_URI!;

      // const options: mongoose.ConnectOptions = {
      //   maxPoolSize: 10, // Maintain up to 10 socket connections
      //   serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      //   socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      //   bufferCommands: false, // Disable mongoose buffering
      //   // bufferMaxEntries: 0, // Disable mongoose buffering
      // };

      await mongoose.connect(mongoUri);

      this.isConnected = true;
      console.log("Connected to MongoDB successfully");

      // Handle connection events
      mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        console.log("MongoDB disconnected");
        this.isConnected = false;
      });

      mongoose.connection.on("reconnected", () => {
        console.log("MongoDB reconnected");
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.disconnect();
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        await this.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  public getConnection(): mongoose.Connection {
    return mongoose.connection;
  }

  public isConnectionHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public async healthCheck(): Promise<{ status: string; readyState: number }> {
    try {
      const adminDb = mongoose.connection.db.admin();
      await adminDb.ping();

      return {
        status: "healthy",
        readyState: mongoose.connection.readyState,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        readyState: mongoose.connection.readyState,
      };
    }
  }
}

export const database = DatabaseConfig.getInstance();
export default database;
