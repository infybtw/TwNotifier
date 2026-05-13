FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY ./twitch-mock/go.mod ./twitch-mock/go.sum ./
RUN go mod download
COPY ./twitch-mock/ .
RUN go build -o twitch-mock ./cmd/main.go

FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=builder /app/twitch-mock .
EXPOSE 7777 8081 3333
CMD ["./twitch-mock"]
