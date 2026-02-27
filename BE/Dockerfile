# Use a lightweight Node.js Alpine base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to cache dependencies
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose the backend port (defaulting to 5000 based on standard setup)
EXPOSE 5000

# Start the Node.js server
CMD ["npm", "start"]
