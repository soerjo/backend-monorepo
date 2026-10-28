<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ bun install
```

## Compile and run the project

```bash
# development
$ bun run start

# watch mode
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Run tests

```bash
# unit tests
$ bun run test

# e2e tests
$ bun run test:e2e

# test coverage
$ bun run test:cov
```

## Environment variables

Create a `.env` file (see `.env.example`) before running the app. Key variables:

| Variable                 | Required | Default       | Description                                                                       |
| ------------------------ | -------- | ------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`               | No       | `development` | development \| production \| test                                                 |
| `PORT`                   | No       | `3000`        | Server port                                                                       |
| `DATABASE_URL`           | Yes      | —             | PostgreSQL connection string                                                      |
| `JWT_ACCESS_SECRET`      | Yes      | —             | Signs access tokens                                                               |
| `JWT_REFRESH_SECRET`     | Yes      | —             | Signs refresh tokens                                                              |
| `JWT_ACCESS_EXPIRATION`  | No       | `15m`         | Access token expiry (`s`/`m`/`h`/`d` suffix, or bare seconds)                      |
| `JWT_REFRESH_EXPIRATION` | No       | `7d`          | Refresh token expiry (`s`/`m`/`h`/`d` suffix, or bare seconds)                     |
| `GOOGLE_CLIENT_ID`       | Yes      | —             | Google OAuth client ID                                                            |
| `GOOGLE_CLIENT_SECRET`   | Yes      | —             | Google OAuth client secret                                                        |
| `GOOGLE_CALLBACK_URL`    | No       | see `.env.example` | Google OAuth callback URL                                                    |
| `FRONTEND_URL`           | No       | `http://localhost:5173` | Frontend base URL (Google OAuth redirect)                                |
| `CORS_ORIGINS`           | No       | —             | Comma-separated allowed origins; unset/empty enables CORS for all origins (dev)   |
| `WMS_APPROVAL_THRESHOLD` | No       | `0`           | Stock adjustments with `requestedValue` at or below this value are auto-approved   |
| `WMS_DEV_EVENT_ENDPOINT` | No       | `0`           | Set to `1` to enable the dev POS event endpoint (`POST /api/v1/dev/pos-event`)     |

## WMS API routes (under `/api/v1`)

| Domain            | Method | Path                                             | Description                                        |
| ----------------- | ------ | ------------------------------------------------ | -------------------------------------------------- |
| Warehouses        | GET    | `/v1/warehouses`                                 | List warehouses (filter by type / active status)   |
| Warehouses        | POST   | `/v1/warehouses`                                 | Create warehouse                                   |
| Warehouses        | GET    | `/v1/warehouses/:id`                             | Warehouse detail                                   |
| Warehouses        | PATCH  | `/v1/warehouses/:id`                             | Update warehouse                                   |
| Storage Bins      | GET    | `/v1/warehouses/:warehouseId/bins`               | List bins for a warehouse (filter by status/zone)  |
| Storage Bins      | POST   | `/v1/warehouses/:warehouseId/bins`               | Create bin under a warehouse                       |
| Storage Bins      | PATCH  | `/v1/bins/:id`                                   | Update bin status (`ACTIVE`/`QUARANTINE`/`LOCKED`) |
| Inventory         | GET    | `/v1/inventory/on-hand`                          | On-hand stock (filter by warehouse / SKU / batch)  |
| Inventory         | GET    | `/v1/inventory/ledger`                           | Stock ledger (filter by warehouse / SKU / type / date) |
| Inventory         | GET    | `/v1/inventory/low-stock`                        | Items below the stock threshold                    |
| Inbound           | POST   | `/v1/inbound/receipts`                           | Goods receipt into a receiving/staging bin         |
| Inbound           | POST   | `/v1/inbound/putaway`                            | Move received goods from staging to storage bin    |
| Transfers         | POST   | `/v1/transfers`                                  | Create transfer request (`DRAFT`)                  |
| Transfers         | POST   | `/v1/transfers/:id/dispatch`                     | Dispatch (`IN_TRANSIT`), deducts origin stock      |
| Transfers         | POST   | `/v1/transfers/:id/receive`                      | Receive (`COMPLETED`), adds destination stock      |
| Transfers         | POST   | `/v1/transfers/bin-transfer`                     | Immediate bin-to-bin move in the same warehouse    |
| Adjustments       | POST   | `/v1/inventory/adjustments`                      | Create adjustment (auto-approve below threshold)   |
| Adjustments       | POST   | `/v1/inventory/adjustments/:id/approve`          | Approve a pending adjustment                       |
| POS Dev Events    | POST   | `/v1/dev/pos-event`                              | Simulate `ORDER_COMPLETED`/`ORDER_REFUNDED` (guarded by `WMS_DEV_EVENT_ENDPOINT=1`) |

Swagger UI is available at `/docs`.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ bun install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
