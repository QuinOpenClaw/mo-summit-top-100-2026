import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const boardId = Number(process.env.VITE_MONDAY_BOARD_ID)
const token = process.env.MONDAY_API_TOKEN

if (!token) {
  console.error('Missing MONDAY_API_TOKEN in .env.local')
  process.exit(1)
}

if (!boardId) {
  console.error('Missing or invalid VITE_MONDAY_BOARD_ID in .env.local')
  process.exit(1)
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

const response = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: {
    Authorization: token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables: { boardId: [boardId] },
  }),
})

const payload = await response.json()
if (!response.ok || payload.errors) {
  console.error('monday API request failed')
  console.error(JSON.stringify(payload.errors || payload, null, 2))
  process.exit(1)
}

const board = payload.data?.boards?.[0]
if (!board) {
  console.error('Board not found')
  process.exit(1)
}

const columns = board.columns || []

const findBest = (tests) => {
  for (const test of tests) {
    const match = columns.find(test)
    if (match) return match.id
  }
  return ''
}

const sourceId = findBest([
  (column) => /type of contact/i.test(column.title),
  (column) => /source|contact type/i.test(column.title),
])

const statusId = findBest([
  (column) => /outreach status/i.test(column.title),
  (column) => /status|outreach/i.test(column.title),
])

const industryId = findBest([
  (column) => /industry/i.test(column.title),
])

console.log(`Board: ${board.name} (${board.id})`)
console.log('\nColumns:')
for (const column of columns) {
  console.log(`- ${column.id}\t${column.title}\t${column.type}`)
}

console.log('\nSuggested env mapping:')
if (sourceId) console.log(`VITE_SOURCE_COLUMN_ID=${sourceId}`)
if (statusId) console.log(`VITE_STATUS_COLUMN_ID=${statusId}`)
if (industryId) console.log(`VITE_INDUSTRY_COLUMN_ID=${industryId}`)
console.log('VITE_CONVERTED_STATUS_VALUES=converted,won,closed')
