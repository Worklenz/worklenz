# Use Ubuntu 23.04 as the base image
FROM ubuntu:23.04

# Docblock
LABEL author="@worklenz"
LABEL maintainers=""
LABEL description="Backend for Worklenz application"
LABEL website="https://worklenz.com"
LABEL origin="https://github.com/Worklenz/worklenz"
LABEL version="1.0.0"
LABEL license="AGPL-3.0"

# Set non-root user and project name args.
ARG USER
ARG APP

# Set non-interactive to avoid prompts during build.
ENV DEBIAN_FRONTEND=noninteractive

# Set the timezone to EST (Eastern Standard Time).
ENV TZ=America/New_York

# Update the package list and install necessary dependencies.
RUN apt-get update && apt-get install -y \
    sudo \
    locales \
    tzdata \
    curl \
    gnupg \
    build-essential \
    libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Setup UTF-8 locale and set env.
RUN sed -i '/^#.* en_US.UTF-8 UTF-8/s/^#//' /etc/locale.gen && \
    locale-gen en_US.UTF-8

ENV LANG en_US.UTF-8
ENV LC_ALL en_US.UTF-8

# Set the timezone to EST (Eastern Standard Time).
RUN ln -fs /usr/share/zoneinfo/America/New_York /etc/localtime && \
    dpkg-reconfigure --frontend noninteractive tzdata

# Install Node.js and npm.
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install TypeScript, ts-node, Grunt, and Grunt CLI globally.
RUN npm install -g ts-node typescript grunt grunt-cli

# Create a non-root user and group.
RUN groupadd ${USER} && \
    useradd -m -s /bin/bash -g ${USER} ${USER} && \
    echo "${USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${USER} && \
    chmod 0440 /etc/sudoers.d/${USER}

# Switch to non-root user.
USER ${USER}

# Set the working directory.
WORKDIR /home/${USER}/${APP}

# Copy the application code to the container.
COPY . .

# Change the ownership of the working directory.
RUN sudo chown -R ${USER}:${USER} /home/${USER}/${APP}

# Install project dependencies.
RUN npm ci

# Run the build script to compile TypeScript to JavaScript.
RUN npm run build

# Expose the port the app runs.
EXPOSE 3000

# Start the application.
CMD ["npm", "start"]
