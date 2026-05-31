FROM node:20-slim
WORKDIR /app
RUN npm install -g founden-mcp
ENTRYPOINT ["founden-mcp"]
