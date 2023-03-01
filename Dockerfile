FROM node:current-alpine


ENV TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata python3 python3-dev py3-pip
RUN pip3 install openai pymongo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# CMD [ "node", "stream.js" ]
# CMD [ "node", "temperature.js" ]
