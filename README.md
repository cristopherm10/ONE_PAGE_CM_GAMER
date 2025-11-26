# ONE_PAGE_CM_GAMER_BACK

Backend Express app

## Run locally
```bash
npm ci
npm start
```

Health: http://localhost:4000/health
Items: http://localhost:4000/items

## Docker
```bash
docker build -t gamer-back:local ONE_PAGE_CM_GAMER_BACK
docker run --rm -p 4000:4000 gamer-back:local
```

## Tests
```bash
npm ci
npm test
```
