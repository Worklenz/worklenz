# FIRST STAGE: Install Dependencies

# Use the official Node.js 18-alpine3.20 image as a base
FROM node:18-alpine3.20 as base

# Create and set the working directory
WORKDIR /usr/src/app

# Install global dependencies
RUN npm install -g ts-node typescript grunt grunt-cli

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# SECOND STAGE: RUN THE APPLICATION


FROM node:18-alpine3.20 as prod

WORKDIR /usr/src/app

COPY --from=base /usr/src/app .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
