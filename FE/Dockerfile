# Stage 1: Build the React Application
FROM node:18-alpine as build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (using legacy peer deps for older React 17 compatibility just in case)
RUN npm install --legacy-peer-deps

# Copy the full frontend source code
COPY . .

# Build the static React application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the custom Nginx configuration to support React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React static files from Stage 1 into the Nginx html directory
COPY --from=build /app/build /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
