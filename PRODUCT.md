# TwNotifier

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Telegram Mini App for managing Twitch and Kick subscriptions and stream notifications, with an administrator area for users, channels, subscriptions, logs, keys, broadcasts, and infrastructure.

## Users and Operating Context

The current improvement prioritizes administrators. The full Mini App is in scope. It runs inside Telegram and supports Russian and English.

## Capabilities and Constraints

Preserve existing bot functions, permissions, API compatibility, and both languages. Long collections should use pagination instead of accumulating rows with “Load more.” Short forms and informational screens do not need artificial pagination.

## Product Principles

- Keep large collections manageable in bounded pages.
- Make forward and backward navigation explicit.
- Keep filters consistent while switching pages.
- Preserve existing functions while improving navigation.

## Open Decisions

No replacement brand or visual identity was requested in the clarified scope. Existing theme remains the visual reference.
