import { createApp } from './app.js'
import { startScheduler } from './scheduler.js'

const port = Number(process.env.PORT || process.env.MAIKA_API_PORT || 8787)
const host = process.env.MAIKA_API_HOST || '127.0.0.1'

const app = await createApp()
startScheduler()

app.listen(port, host, () => {
    console.log(`Maika API listening on http://${host}:${port}`)
})
