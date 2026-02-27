# Stage 1: Build the React Application
FROM node:18-alpine as build

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (using legacy peer deps for older React 17 compatibility just in case)
RUN npm install --legacy-peer-deps

# Copy the full frontend source code
COPY . .

# Accept build arguments from GitHub Actions
ARG REACT_APP_SERVER_URL
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_HOST_URL
ARG REACT_APP_TURN_URL
ARG REACT_APP_BASE_URL
ARG REACT_APP_AUTH_URL
ARG REACT_APP_PAYPAL_TEST_CLIENT_ID
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST
ARG REACT_APP_PAYPAL_REAL_CLIENT_ID
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE

# Set them as Environment Variables so React bakes them into the static /build folder
ENV REACT_APP_SERVER_URL=$REACT_APP_SERVER_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_HOST_URL=$REACT_APP_HOST_URL
ENV REACT_APP_TURN_URL=$REACT_APP_TURN_URL
ENV REACT_APP_BASE_URL=$REACT_APP_BASE_URL
ENV REACT_APP_AUTH_URL=$REACT_APP_AUTH_URL
ENV REACT_APP_PAYPAL_TEST_CLIENT_ID=$REACT_APP_PAYPAL_TEST_CLIENT_ID
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST=$REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST
ENV REACT_APP_PAYPAL_REAL_CLIENT_ID=$REACT_APP_PAYPAL_REAL_CLIENT_ID
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE=$REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE

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
