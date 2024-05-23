# Use Ubuntu 23.04 as the base image
FROM ubuntu:23.04

# Update the package list and install necessary dependencies
RUN apt-get update && apt-get install -y \
  curl \
  gnupg \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js and npm
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs

# Set the working directory
WORKDIR /usr/src/app

# Copy the application code to the container
COPY . /usr/src/app

# Install Angular CLI globally
RUN npm install -g @angular/cli

# Install project dependencies
RUN npm install

# Expose the port the app runs
EXPOSE 4200

# Start the application
CMD ["npm", "start"]
