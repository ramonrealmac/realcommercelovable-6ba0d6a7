# Dockerfile do Fiscal Worker
FROM node:20-alpine

# Instala dependências necessárias para o koffi (FFI)
RUN apk add --no-cache python3 make g++

# Diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package.json ./

# Instala dependências
RUN npm install

# Copia o restante do código
COPY src/ ./src/
COPY .env* ./

# Comando para iniciar o worker
CMD ["node", "src/index.js"]
