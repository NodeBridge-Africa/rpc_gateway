FROM node:18-alpine

WORKDIR /app
# copy current dir items to work dir
COPY . .
# install all packages
RUN yarn
# transpile the typescript code
RUN yarn transpile

CMD ["node", "dist/server.js"]
# port to run the app
EXPOSE 8888
