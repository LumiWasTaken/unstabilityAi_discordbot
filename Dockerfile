# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install app dependencies
RUN npm install

# Build TypeScript code
RUN npm run build

# Set the command to run when the container starts
CMD ["node", "build/index.js"]
