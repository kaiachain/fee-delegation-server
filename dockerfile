FROM node:22.12.0-alpine AS build

WORKDIR /app

COPY . .

RUN npm install && npm run build

FROM node:22.12.0-alpine AS prod

WORKDIR /app

COPY  package*.json .
COPY --from=build /app/.next/ /app/.next/
COPY --from=build /app/node_modules /app/node_modules 

CMD ["npm", "run", "start"]