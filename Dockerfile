# mohammaddev/mo_dev_portfolio

FROM node:12.16.3-alpine

ENV COMPlus_EnabledDiagnostics=0
WORKDIR /usr/share/mo_dev_portfolio

RUN apk update && apk upgrade \
    && apk add --no-cache git \
    && apk --no-cache add --virtual builds-deps build-base python

ENV PORT 6002
EXPOSE 6002

COPY . /usr/share/mo_dev_portfolio
RUN cd /usr/share/mo_dev_portfolio
RUN yarn

CMD ["yarn", "start"]