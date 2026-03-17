import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'

dotenv.config({ path: '.env.local' })
dotenv.config()

const MONDAY_TIMEOUT_MS = Number(process.env.MONDAY_TIMEOUT_MS || 15000)

async function fetchMonday(query, variables, token) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MONDAY_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })

    const payload = await response.json()

    if (!response.ok || payload.errors) {
      return {
        ok: false,
        status: 502,
        body: {
          error: 'monday API request failed',
          details: payload.errors || payload,
        },
      }
    }

    return { ok: true, payload }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        body: {
          error: `monday API timed out after ${MONDAY_TIMEOUT_MS}ms`,
        },
      }
    }

    return {
      ok: false,
      status: 500,
      body: {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : String(error),
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

const app = express()
const port = Number(process.env.LOCAL_API_PORT || 8787)

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'monday local API',
    frontend: 'http://127.0.0.1:5173',
    endpoints: {
      health: '/health',
      fields: '/fields?boardId=7045235564',
      boardData: '/board-data?boardId=7045235564',
    },
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/fields', async (req, res) => {
  const boardId = Number(req.query.boardId || process.env.VITE_MONDAY_BOARD_ID)
  const token = process.env.MONDAY_API_TOKEN

  if (!token) {
    return res.status(500).json({
      error: 'Missing MONDAY_API_TOKEN in .env.local',
    })
  }

  if (!boardId) {
    return res.status(400).json({
      error: 'Missing or invalid boardId query parameter',
    })
  }

  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `

  const mondayResult = await fetchMonday(query, { boardId: [boardId] }, token)
  if (!mondayResult.ok) {
    return res.status(mondayResult.status).json(mondayResult.body)
  }

  const board = mondayResult.payload.data?.boards?.[0]

  if (!board) {
    return res.status(404).json({ error: 'Board not found' })
  }

  return res.json({
    id: board.id,
    name: board.name,
    columns: board.columns,
  })
})

app.get('/board-data', async (req, res) => {
  const boardId = Number(req.query.boardId)
  const token = process.env.MONDAY_API_TOKEN

  if (!token) {
    return res.status(500).json({
      error: 'Missing MONDAY_API_TOKEN in .env.local',
    })
  }

  if (!boardId) {
    return res.status(400).json({
      error: 'Missing or invalid boardId query parameter',
    })
  }

  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        name
        items_page(limit: 500) {
          items {
            created_at
            column_values {
              id
              text
              value
              column {
                id
                title
                type
              }
            }
          }
        }
      }
    }
  `

  const mondayResult = await fetchMonday(query, { boardId: [boardId] }, token)
  if (!mondayResult.ok) {
    return res.status(mondayResult.status).json(mondayResult.body)
  }

  const board = mondayResult.payload.data?.boards?.[0]

  if (!board) {
    return res.status(404).json({ error: 'Board not found' })
  }

  return res.json({
    name: board.name,
    items: board.items_page?.items || [],
  })
})

app.listen(port, () => {
  console.log(`Local monday API server running on http://127.0.0.1:${port}`)
})
