const mongoose = require('mongoose');
const logger = require('../utils/logger').logger;

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connect() {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_management';
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        retryWrites: true,
        w: 'majority'
      };

      logger.info('Attempting to connect to MongoDB...', { uri: mongoURI.replace(/\/\/.*@/, '//***:***@') });
      
      const conn = await mongoose.connect(mongoURI, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('MongoDB connected successfully', { 
        host: conn.connection.host,
        name: conn.connection.name,
        port: conn.connection.port 
      });

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
        this.handleReconnection();
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected successfully');
        this.isConnected = true;
        this.retryCount = 0;
      });

      process.on('SIGINT', this.gracefulClose.bind(this));
      process.on('SIGTERM', this.gracefulClose.bind(this));

      return conn;
      
    } catch (error) {
      this.isConnected = false;
      logger.error('MongoDB connection failed:', error);

      // So the app can run without a DB (health/status endpoints), avoid exiting.
      // Retry a limited number of times, then continue without a DB connection.
      if (this.retryCount < Math.min(this.maxRetries, 2)) {
        this.retryCount++;
        logger.info(`Retrying connection in ${this.retryDelay / 1000} seconds... (Attempt ${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }

      logger.warn('Proceeding without MongoDB connection. Some features will be unavailable.');
      return null;
    }
  }

  async handleReconnection() {
    if (!this.isConnected && this.retryCount < this.maxRetries) {
      this.retryCount++;
      logger.info(`Attempting to reconnect... (Attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.connect();
      }, this.retryDelay);
    }
  }

  async gracefulClose() {
    logger.info('Closing MongoDB connection...');
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      process.exit(1);
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      port: mongoose.connection.port
    };
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = {
  connectDB: () => dbConnection.connect(),
  getConnectionStatus: () => dbConnection.getConnectionStatus(),
  isConnected: () => dbConnection.isConnected
};